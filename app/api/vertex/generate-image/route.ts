
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
  BillingError,
  getAuthenticatedUserAccount,
  getImagePolicy,
  refundTokens,
  reserveTokens,
} from '@/lib/subscription';
import { getClient, query } from '@/lib/db';
import {
  ensureImageJobsTable,
  estimateAvgImageJobSeconds,
  getImageDailyLimit,
  getImageParallelLimit,
  getImageQueuePriority,
  getImageRateLimit,
} from '@/lib/image-queue';

function mergeImagesUpToLimit(groups: string[][], limit: number): string[] {
  const out: string[] = [];
  for (const group of groups) {
    for (const img of group) {
      if (out.length >= limit) return out;
      out.push(img);
    }
  }
  return out;
}

function workloadSecondsByMode(
  rows: Array<{ mode: string; cnt: number }>,
  basicAvgSeconds: number,
  proAvgSeconds: number
): number {
  let total = 0;
  for (const row of rows) {
    const cnt = Number(row?.cnt || 0);
    if (!Number.isFinite(cnt) || cnt <= 0) continue;

    const mode = String(row?.mode || '').toLowerCase();
    const perJob = mode === 'pro' ? proAvgSeconds : basicAvgSeconds;
    total += cnt * perJob;
  }
  return total;
}

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  let reservedTokens = 0;
  let reservedTokensRemaining = 0;
  let enqueued = false;

  try {
    await ensureImageJobsTable();

    const user = await getAuthenticatedUserAccount();
    userId = user.id;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const basePrompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const productImages = Array.isArray(body?.productImages) ? body.productImages.filter(Boolean) : [];
    const frontImagesRaw = Array.isArray(body?.frontImages) ? body.frontImages.filter(Boolean) : [];
    const backImagesRaw = Array.isArray(body?.backImages) ? body.backImages.filter(Boolean) : [];
    const sideImagesRaw = Array.isArray(body?.sideImages) ? body.sideImages.filter(Boolean) : [];
    const styleImages = Array.isArray(body?.styleImages) ? body.styleImages.filter(Boolean) : [];
    // Marketplace images must be 3:4 (1080×1440). We enforce the aspect ratio server-side.
    const aspectRatio = '3:4';
    const model = typeof body?.model === 'string' ? body.model.trim() : '';
    const requestedMode = typeof body?.mode === 'string' ? body.mode.trim().toLowerCase() : '';

    const inferredMode =
      requestedMode === 'basic' || requestedMode === 'pro'
        ? requestedMode
        : model.toLowerCase().includes('flash-image')
          ? 'basic'
          : 'pro';

    const plan = user.role === 'admin' ? 'business_plus' : user.subscription_plan;
    const policy = getImagePolicy(plan, inferredMode as any);

    if (!policy.outputCount || policy.costPerRequest <= 0) {
      throw new BillingError({
        status: 403,
        code: 'PLAN_RESTRICTED',
        message: "Rasm yaratish uchun tarif kerak. Starter tarifdan boshlang.",
        recommendedPlan: 'starter',
      });
    }

    if (policy.allowedModels.length > 0) {
      const selectedModel = (model || policy.allowedModels[0]).trim();
      if (!policy.allowedModels.includes(selectedModel)) {
        throw new BillingError({
          status: 403,
          code: 'PLAN_RESTRICTED',
          message: `Sizning tarifingizda bu model ishlamaydi. Ruxsat etilgan model(lar): ${policy.allowedModels.join(
            ', '
          )}`,
          recommendedPlan: null,
        });
      }
    }

    console.log(`[GenerateImage] Provider: gemini, Requested Model: ${model || '(default from env)'}`);

    const parallelLimit = getImageParallelLimit(plan);

    const hasAnyProductImage =
      productImages.length > 0 || frontImagesRaw.length > 0 || backImagesRaw.length > 0 || sideImagesRaw.length > 0;

    if (!basePrompt && !hasAnyProductImage) {
      return NextResponse.json({ error: 'Prompt or product image required' }, { status: 400 });
    }

    const safePrompt = basePrompt.slice(0, policy.maxPromptChars);
    const safeProductImages = productImages.slice(0, policy.maxProductImages);
    const safeStyleImages = styleImages.slice(0, policy.maxStyleImages);

    // ============================================================
    // Rate limiting (transparent, plan-based)
    // Counts DISTINCT batches (not per output image)
    // ============================================================
    {
      const dailyLimit = getImageDailyLimit(plan);
      if (dailyLimit) {
        const dailyRes = await query(
          `SELECT COUNT(DISTINCT batch_id)::int AS cnt
           FROM image_jobs
           WHERE user_id = $1
             AND plan = $2
             AND status <> 'canceled'
             AND created_at >= date_trunc('day', NOW())`,
          [user.id, plan]
        );
        const usedToday = Number(dailyRes.rows?.[0]?.cnt ?? 0);
        if (Number.isFinite(usedToday) && usedToday >= dailyLimit) {
          const now = new Date();
          const resetAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
          const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));

          return NextResponse.json(
            {
              error: `Kunlik limit tugadi (${dailyLimit} ta/kun). Keyingi limit: ${resetAt.toISOString()}`,
              code: 'DAILY_LIMIT',
              daily_limit: dailyLimit,
              used_today: usedToday,
              reset_at: resetAt.toISOString(),
              retry_after_seconds: retryAfterSeconds,
              parallel_limit: parallelLimit,
            },
            { status: 429 }
          );
        }
      }

      const cooldown = getImageRateLimit(plan);
      if (cooldown) {
        const res = await query(
          `SELECT COUNT(DISTINCT batch_id)::int AS cnt,
                  MIN(created_at) AS oldest
           FROM image_jobs
           WHERE user_id = $1
             AND plan = $2
             AND status <> 'canceled'
             AND created_at >= (NOW() - ($3 * INTERVAL '1 second'))`,
          [user.id, plan, cooldown.windowSeconds]
        );

        const cnt = Number(res.rows?.[0]?.cnt ?? 0);
        const oldestRaw = res.rows?.[0]?.oldest as Date | null | undefined;

        if (Number.isFinite(cnt) && cnt >= cooldown.maxBatches) {
          const oldest = oldestRaw instanceof Date ? oldestRaw : oldestRaw ? new Date(oldestRaw) : null;
          const nextAvailableAt = oldest
            ? new Date(oldest.getTime() + cooldown.windowSeconds * 1000)
            : new Date(Date.now() + cooldown.windowSeconds * 1000);
          const retryAfterSeconds = Math.max(1, Math.ceil((nextAvailableAt.getTime() - Date.now()) / 1000));

          return NextResponse.json(
            {
              error: `Tarif limit: ${cooldown.maxBatches} ta / ${Math.round(
                cooldown.windowSeconds / 60
              )} minut. Keyingi generatsiya: ${nextAvailableAt.toISOString()}`,
              code: 'RATE_LIMIT',
              limit: cooldown.maxBatches,
              window_seconds: cooldown.windowSeconds,
              next_available_at: nextAvailableAt.toISOString(),
              retry_after_seconds: retryAfterSeconds,
              parallel_limit: parallelLimit,
            },
            { status: 429 }
          );
        }
      }
    }

    // Business+ (and compatible clients): allow strict front/back/side control.
    const hasAngleGroups =
      (frontImagesRaw.length > 0 || backImagesRaw.length > 0 || sideImagesRaw.length > 0) &&
      policy.outputCount >= 3;

    let remaining = policy.maxProductImages;
    const safeFrontImages = frontImagesRaw.slice(0, Math.max(0, remaining));
    remaining -= safeFrontImages.length;
    const safeBackImages = backImagesRaw.slice(0, Math.max(0, remaining));
    remaining -= safeBackImages.length;
    const safeSideImages = sideImagesRaw.slice(0, Math.max(0, remaining));

    type Variation = { id: string; label: string; suffix: string; productImages: string[] };

    const variations: Variation[] = (() => {
      if (hasAngleGroups) {
        const frontSet = safeFrontImages.length > 0 ? safeFrontImages : safeProductImages;
        const backSet = safeBackImages.length > 0 ? safeBackImages : safeProductImages;
        const sideSet =
          safeSideImages.length > 0
            ? mergeImagesUpToLimit([safeFrontImages, safeSideImages], policy.maxProductImages)
            : safeProductImages;

        const baseRule =
          '\n\nCRITICAL VIEW RULE: Each output MUST be a different camera angle. Do NOT reuse the same front-facing pose for all outputs.';

        if (policy.outputCount === 3) {
          return [
            {
              id: 'front',
              label: 'Old',
              productImages: frontSet,
              suffix:
                baseRule +
                '\nVIEW: FRONT (straight-on). Show the FRONT side clearly, centered, marketplace-ready.',
            },
            {
              id: 'back',
              label: 'Orqa',
              productImages: backSet,
              suffix:
                baseRule +
                '\nVIEW: BACK (straight-on). Show the BACK side clearly, centered, same product identity.',
            },
            {
              id: 'side',
              label: 'Yon',
              productImages: sideSet,
              suffix:
                baseRule +
                '\nVIEW: SIDE (profile). Prefer left side. Use the EXTRA reference image to preserve sleeve/side details, but keep the full product visible.',
            },
          ];
        }

        // outputCount >= 4
        const detailSet =
          safeSideImages.length > 0
            ? safeSideImages
            : safeFrontImages.length > 0
              ? safeFrontImages
              : safeProductImages;

        return [
          {
            id: 'front',
            label: 'Old',
            productImages: frontSet,
            suffix:
              baseRule +
              '\nVIEW: FRONT (straight-on). Show the FRONT side clearly, premium studio lighting.',
          },
          {
            id: 'back',
            label: 'Orqa',
            productImages: backSet,
            suffix:
              baseRule +
              '\nVIEW: BACK (straight-on). Show the BACK side clearly, premium studio lighting.',
          },
          {
            id: 'side',
            label: 'Yon',
            productImages: sideSet,
            suffix:
              baseRule +
              '\nVIEW: SIDE (profile). Prefer left side. Use the EXTRA reference image for sleeve/side details.',
          },
          {
            id: 'detail',
            label: 'Detal',
            productImages: detailSet,
            suffix:
              '\n\nDETAIL: Close-up macro shot focusing on fabric texture, seams, sleeve/trim details, high clarity, shallow depth of field.',
          },
        ];
      }

      if (policy.outputCount === 2) {
        return [
          {
            id: 'close',
            label: 'Close-up',
            productImages: safeProductImages,
            suffix: ' (Close-up shot, detailed texture focus, shallow depth of field)',
          },
          {
            id: 'wide',
            label: 'Umumiy',
            productImages: safeProductImages,
            suffix: ' (Wide angle full body shot, environmental context, showing entire product)',
          },
        ];
      }
      if (policy.outputCount === 3) {
        return [
          {
            id: 'hero',
            label: 'Umumiy',
            productImages: safeProductImages,
            suffix: ' (Professional hero shot, clean composition, marketplace-ready)',
          },
          {
            id: 'close',
            label: 'Close-up',
            productImages: safeProductImages,
            suffix: ' (Close-up shot, detailed texture focus, shallow depth of field)',
          },
          {
            id: 'detail',
            label: 'Detal',
            productImages: safeProductImages,
            suffix: ' (Detail shot, macro focus on materials/texture, premium lighting)',
          },
        ];
      }
      return [
        {
          id: 'hero',
          label: 'Hero',
          productImages: safeProductImages,
          suffix: ' (Hero shot, premium advertising look, clean background, studio lighting)',
        },
        {
          id: 'close',
          label: 'Close-up',
          productImages: safeProductImages,
          suffix: ' (Close-up shot, detailed texture focus, shallow depth of field)',
        },
        {
          id: 'detail',
          label: 'Detal',
          productImages: safeProductImages,
          suffix: ' (Detail macro shot, material and craftsmanship focus)',
        },
        {
          id: 'lifestyle',
          label: 'Lifestyle',
          productImages: safeProductImages,
          suffix: ' (Lifestyle/angle shot, real-world context, dynamic composition)',
        },
      ];
    })();

    // Reserve tokens upfront per REQUEST (not per output image)
    const costPerRequest = policy.costPerRequest;
    reservedTokens = Number(costPerRequest.toFixed(2));
    if (user.role !== 'admin') {
      const reserveResult = await reserveTokens({ userId: user.id, tokens: reservedTokens });
      reservedTokensRemaining = reserveResult.tokensRemaining;
    } else {
      reservedTokensRemaining = 999999;
    }

    // Enqueue DB-backed jobs (persistent queue; worker processes async)
    const batchId = randomUUID();
    const priority = getImageQueuePriority(plan);
    const selectedModel =
      policy.allowedModels.length > 0 ? (model || policy.allowedModels[0] || '').trim() : model.trim();

    const client = await getClient();
    const jobIds: string[] = [];
    let firstCreatedAt: Date | null = null;

    try {
      await client.query('BEGIN');

      for (let i = 0; i < variations.length; i++) {
        const v = variations[i];
        const jobId = randomUUID();
        jobIds.push(jobId);

        const fullPrompt = `${safePrompt}${v.suffix}\n\nOUTPUT REQUIREMENT: The final image must be exactly 1080x1440 pixels (3:4).`;
        const productImagesForVariation = v.productImages?.length ? v.productImages : safeProductImages;

        const insertRes = await client.query(
          `INSERT INTO image_jobs (
             id, batch_id, batch_index, user_id,
             plan, mode, provider, model, aspect_ratio,
             label, base_prompt, prompt, product_images, style_images,
             status, priority, tokens_reserved, created_at, updated_at
           ) VALUES (
             $1, $2, $3, $4,
             $5, $6, 'gemini', $7, $8,
             $9, $10, $11, $12::jsonb, $13::jsonb,
             'queued', $14, $15, NOW(), NOW()
           )
           RETURNING created_at`,
          [
            jobId,
            batchId,
            i,
            user.id,
            plan,
            inferredMode,
            selectedModel || null,
            aspectRatio,
            v?.label || v?.id || `Image ${i + 1}`,
            safePrompt || null,
            fullPrompt,
            // IMPORTANT: pg serializes JS arrays as Postgres arrays (`{"..."}`),
            // which is invalid JSON for a JSONB column. Store real JSON.
            JSON.stringify(productImagesForVariation || []),
            JSON.stringify(safeStyleImages || []),
            priority,
            user.role === 'admin' ? 0 : i === 0 ? reservedTokens : 0,
          ]
        );

        if (!firstCreatedAt) {
          const raw = insertRes.rows?.[0]?.created_at;
          firstCreatedAt = raw instanceof Date ? raw : raw ? new Date(raw) : new Date();
        }
      }

      await client.query('COMMIT');
      enqueued = true;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
      throw err;
    } finally {
      client.release();
    }

    // Best-effort queue metrics for transparent UI
    let queuePosition: number | null = null;
    let etaSeconds: number | null = null;

    try {
      const createdAt = firstCreatedAt || new Date();
      const [queuedRes, activeRes, basicAvgSeconds, proAvgSeconds] = await Promise.all([
        query(
          `SELECT mode, COUNT(*)::int AS cnt
           FROM image_jobs
           WHERE plan = $1
             AND status = 'queued'
             AND created_at < $2
           GROUP BY mode`,
          [plan, createdAt]
        ),
        query(
          `SELECT mode, COUNT(*)::int AS cnt
           FROM image_jobs
           WHERE plan = $1
             AND status = 'processing'
           GROUP BY mode`,
          [plan]
        ),
        estimateAvgImageJobSeconds(plan, 'basic'),
        estimateAvgImageJobSeconds(plan, 'pro'),
      ]);

      const queuedRows = Array.isArray(queuedRes.rows)
        ? queuedRes.rows.map((row: any) => ({
            mode: String(row?.mode || ''),
            cnt: Number(row?.cnt || 0),
          }))
        : [];

      const activeRows = Array.isArray(activeRes.rows)
        ? activeRes.rows.map((row: any) => ({
            mode: String(row?.mode || ''),
            cnt: Number(row?.cnt || 0),
          }))
        : [];

      const queuedAhead = queuedRows.reduce(
        (sum, row) => sum + (Number.isFinite(row.cnt) ? Math.max(0, row.cnt) : 0),
        0
      );

      if (Number.isFinite(queuedAhead)) {
        queuePosition = Math.max(1, queuedAhead + 1);
      }

      const basicAvg = Number(basicAvgSeconds);
      const proAvg = Number(proAvgSeconds);
      const currentAvg = inferredMode === 'pro' ? proAvg : basicAvg;

      if (
        Number.isFinite(basicAvg) &&
        basicAvg > 0 &&
        Number.isFinite(proAvg) &&
        proAvg > 0 &&
        Number.isFinite(currentAvg) &&
        currentAvg > 0
      ) {
        const queuedWorkSeconds = workloadSecondsByMode(queuedRows, basicAvg, proAvg);
        const activeWorkSeconds = workloadSecondsByMode(activeRows, basicAvg, proAvg);
        const ownWorkSeconds = Math.max(1, variations.length) * currentAvg;
        etaSeconds = Math.max(5, Math.ceil((queuedWorkSeconds + activeWorkSeconds + ownWorkSeconds) / parallelLimit));
      }
    } catch {
      queuePosition = null;
      etaSeconds = null;
    }

    return NextResponse.json({
      success: true,
      batch_id: batchId,
      job_ids: jobIds,
      status: 'queued',
      queue_position: queuePosition,
      eta_seconds: etaSeconds,
      parallel_limit: parallelLimit,
      tokens_reserved: reservedTokens,
      tokens_remaining: user.role === 'admin' ? 999999 : Number(reservedTokensRemaining.toFixed(2)),
      note:
        'Jobs queued. You can poll /api/image-batches/:id to get progress, queue position, and results.',
    });

  } catch (error) {
    console.error('Generate image error:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (error instanceof BillingError) {
      return NextResponse.json(
        { error: error.message, code: error.code, recommended_plan: error.recommendedPlan ?? null },
        { status: error.status }
      );
    }

    // If jobs were NOT enqueued successfully, refund reserved tokens.
    if (!enqueued && userId && reservedTokens) {
      try {
        await refundTokens({ userId, tokens: reservedTokens });
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
