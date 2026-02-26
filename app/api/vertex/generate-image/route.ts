
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
  BillingError,
  getAuthenticatedUserAccount,
  getImagePolicy,
  getNextPlan,
  recordTokenUsage,
  reserveTokens,
} from '@/lib/subscription';
import { getClient, query } from '@/lib/db';
import {
  ensureImageJobsTable,
  getImageDailyLimit,
  getImageParallelLimit,
  getImageRateLimit,
} from '@/lib/image-queue';
import { generateMarketplaceImage } from '@/services/gemini';
import { checkImagePromptSafety } from '@/lib/content-safety';

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

function isUpstreamRateLimitError(message: string): boolean {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('(429') ||
    text.includes('quota') ||
    text.includes('resource_exhausted') ||
    text.includes('too many requests') ||
    text.includes('rate limit')
  );
}

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  let reservedTokens = 0;
  let reservedTokensRemaining = 0;

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

    const modelLc = model.toLowerCase();
    const inferredMode =
      requestedMode === 'basic' || requestedMode === 'pro' || requestedMode === 'ultra'
        ? requestedMode
        : modelLc.includes('flash-image')
          ? 'basic'
          : modelLc.includes('gemini-3-pro-image-preview')
            ? 'ultra'
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

    const promptSafety = checkImagePromptSafety(safePrompt);
    if (!promptSafety.allowed) {
      return NextResponse.json(
        {
          error:
            "18+ yoki axloqsiz/pornografik kontentga ruxsat berilmaydi. Iltimos, promptni neytral va marketplace formatida yozing.",
          code: 'PROMPT_POLICY_BLOCKED',
        },
        { status: 400 }
      );
    }

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
            suffix:
              '\n\nCAMERA VIEW (STRICT): CLOSE-UP / MACRO. Crop/zoom so the frame is filled ~70–90% by the product or its key surface. ' +
              'Show texture/material clearly, shallow depth of field, crisp detail. Do NOT show the entire product if that reduces detail.',
          },
          {
            id: 'wide',
            label: 'Umumiy',
            productImages: safeProductImages,
            suffix:
              '\n\nCAMERA VIEW (STRICT): HERO/WIDE. Full product visible, centered, straight-on, no heavy crop, clean studio background. ' +
              'No environmental/lifestyle scene — keep it marketplace studio style.',
          },
        ];
      }
      if (policy.outputCount === 3) {
        return [
          {
            id: 'hero',
            label: 'Umumiy',
            productImages: safeProductImages,
            suffix:
              '\n\nCAMERA VIEW (STRICT): HERO. Straight-on front view, full product visible, centered, clean composition, studio background, marketplace-ready.',
          },
          {
            id: 'close',
            label: 'Close-up',
            productImages: safeProductImages,
            suffix:
              '\n\nCAMERA VIEW (STRICT): 3/4 ANGLE CLOSE SHOT. Rotate viewpoint ~30–45°. Slight perspective, show depth and side surfaces. ' +
              'Tighter framing than hero (product fills ~60–80% of frame), but still recognizable as the same product. Crisp lighting.',
          },
          {
            id: 'detail',
            label: 'Detal',
            productImages: safeProductImages,
            suffix:
              '\n\nCAMERA VIEW (STRICT): CLOSE-UP / MACRO DETAIL. Focus on one key area (material, texture, buttons, ports, stitching). ' +
              'Crop/zoom aggressively; show micro-texture; shallow depth of field; premium studio lighting. Avoid changing product design.',
          },
        ];
      }
      return [
        {
          id: 'hero',
          label: 'Hero',
          productImages: safeProductImages,
          suffix:
            '\n\nCAMERA VIEW (STRICT): HERO. Straight-on front view, full product visible, centered, clean background, studio lighting. No text.',
        },
        {
          id: 'close',
          label: 'Close-up',
          productImages: safeProductImages,
          suffix:
            '\n\nCAMERA VIEW (STRICT): CLOSE/ANGLE. 3/4 angle close shot (~30–45°). Product fills ~60–85% of the frame. ' +
            'Show depth/dimension and key details. Keep background clean studio.',
        },
        {
          id: 'detail',
          label: 'Detal',
          productImages: safeProductImages,
          suffix:
            '\n\nCAMERA VIEW (STRICT): MACRO DETAIL. Extreme close-up crop of a key detail/texture (material, ports, seams, buttons). ' +
            'Shallow depth of field, high clarity, realistic texture. Do NOT show the whole product.',
        },
        {
          id: 'lifestyle',
          label: 'Lifestyle',
          productImages: safeProductImages,
          suffix:
            '\n\nCAMERA VIEW (STRICT): TRUE SIDE PROFILE 90°. Rotate to a real side view; silhouette clearly visible; minimal perspective. ' +
            'Keep it studio/marketplace-safe: plain white/neutral background, optional simple pedestal only. No busy lifestyle scene.',
        },
      ];
    })();

    const costPerRequest = policy.costPerRequest;
    reservedTokens = Number(costPerRequest.toFixed(2));
    reservedTokensRemaining = user.role === 'admin' ? 999999 : Number(user.tokens_remaining || 0);
    if (user.role !== 'admin' && reservedTokensRemaining < reservedTokens) {
      throw new BillingError({
        status: 402,
        code: 'INSUFFICIENT_TOKENS',
        message: "Tokenlaringiz yetarli emas. Tarifni yangilang yoki yuqori tarifga o'ting.",
        recommendedPlan: getNextPlan(plan),
      });
    }

    const batchId = randomUUID();
    const selectedModel =
      policy.allowedModels.length > 0 ? (model || policy.allowedModels[0] || '').trim() : model.trim();

    const maxPerRequest = Math.max(1, Number(process.env.IMAGE_SYNC_MAX_CONCURRENT_PER_REQUEST || 1));
    const maxConcurrent = Math.min(Math.max(1, parallelLimit), maxPerRequest, variations.length);

    type ImageOutput = {
      id: string;
      index: number;
      label: string | null;
      status: 'succeeded' | 'failed';
      imageUrl: string | null;
      error: string | null;
      prompt: string;
      productImages: string[];
      startedAt: Date;
      finishedAt: Date;
    };

    const outputs: ImageOutput[] = new Array(variations.length);
    let cursor = 0;

    const runOne = async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= variations.length) return;

        const variation = variations[index];
        const startedAt = new Date();
        const fullPrompt = `${safePrompt}${variation.suffix}\n\nOUTPUT REQUIREMENT: The final image must be exactly 1080x1440 pixels (3:4).`;
        const productImagesForVariation =
          variation.productImages?.length > 0 ? variation.productImages : safeProductImages;

        const angleIndexForVariation = (() => {
          const id = String(variation?.id || '').trim().toLowerCase();
          // Keep view-specific sets (front/back) consistent and avoid conflicting angle hints.
          if (id === 'front' || id === 'back') return 0;
          if (id === 'side') return 3;
          if (id === 'detail') return 1; // macro close-up

          // Marketplace generic variations
          if (id === 'hero' || id === 'wide') return 0;
          if (id === 'close') return variations.length <= 2 ? 1 : 2; // 2 outputs: true close-up; otherwise use 3/4 close view
          if (id === 'lifestyle') return 3; // side profile

          return index;
        })();

        try {
          const dataUrl = await generateMarketplaceImage(
            fullPrompt,
            productImagesForVariation,
            safeStyleImages,
            aspectRatio,
            {
              model: selectedModel || undefined,
              fallbackModels: policy.allowedModels.filter((value) => value !== selectedModel),
              imageIndex: angleIndexForVariation,
            }
          );

          outputs[index] = {
            id: randomUUID(),
            index,
            label: variation?.label || variation?.id || `Image ${index + 1}`,
            status: 'succeeded',
            imageUrl: dataUrl,
            error: null,
            prompt: fullPrompt,
            productImages: productImagesForVariation,
            startedAt,
            finishedAt: new Date(),
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          outputs[index] = {
            id: randomUUID(),
            index,
            label: variation?.label || variation?.id || `Image ${index + 1}`,
            status: 'failed',
            imageUrl: null,
            error: msg.slice(0, 5000),
            prompt: fullPrompt,
            productImages: productImagesForVariation,
            startedAt,
            finishedAt: new Date(),
          };
        }
      }
    };

    await Promise.all(Array.from({ length: maxConcurrent }, () => runOne()));

    const ordered = outputs
      .filter(Boolean)
      .sort((a, b) => a.index - b.index);
    const succeeded = ordered.filter((item) => item.status === 'succeeded');
    const failed = ordered.filter((item) => item.status === 'failed');

    const anySucceeded = succeeded.length > 0;
    let tokensRefunded = 0;
    let tokensCharged = 0;

    if (user.role !== 'admin' && anySucceeded) {
      const costPerImage = policy.costPerRequest / policy.outputCount;
      const tokensToCharge = Math.max(0, costPerImage * succeeded.length);
      tokensCharged = Number(tokensToCharge.toFixed(2));

      if (tokensCharged > 0) {
        const reserveResult = await reserveTokens({ userId: user.id, tokens: tokensCharged });
        reservedTokensRemaining = reserveResult.tokensRemaining;

        await recordTokenUsage({
          userId: user.id,
          tokensUsed: tokensCharged,
          serviceType: 'image_generate',
          modelUsed: selectedModel || null,
          prompt: safePrompt,
        });
      }
    }

    // Keep image_jobs table for limits/analytics, but skip queued/worker flow.
    try {
      const client = await getClient();
      try {
        await client.query('BEGIN');
        for (const item of ordered) {
          await client.query(
            `INSERT INTO image_jobs (
               id, batch_id, batch_index, user_id,
               plan, mode, provider, model, aspect_ratio,
               label, base_prompt, prompt, product_images, style_images,
               status, priority, result_url, error_text,
               tokens_reserved, tokens_refunded, usage_recorded,
               created_at, updated_at, started_at, finished_at
             ) VALUES (
               $1, $2, $3, $4,
               $5, $6, 'gemini', $7, $8,
               $9, $10, $11, $12::jsonb, $13::jsonb,
               $14, 0, $15, $16,
               $17, $18, $19,
               NOW(), NOW(), $20, $21
             )`,
            [
              item.id,
              batchId,
              item.index,
              user.id,
              plan,
              inferredMode,
              selectedModel || null,
              aspectRatio,
              item.label,
              safePrompt || null,
              item.prompt,
              JSON.stringify(item.productImages || []),
              JSON.stringify(safeStyleImages || []),
              item.status,
              item.imageUrl,
              item.error,
              // Only log the full charge on the first successful item for simplicity in analytics.
              user.role === 'admin' ? 0 : item.status === 'succeeded' && item.index === succeeded[0]?.index ? tokensCharged : 0,
              0,
              user.role === 'admin' ? true : item.status === 'succeeded' && item.index === succeeded[0]?.index,
              item.startedAt,
              item.finishedAt,
            ]
          );
        }
        await client.query('COMMIT');
      } catch {
        try {
          await client.query('ROLLBACK');
        } catch {
          // ignore
        }
      } finally {
        client.release();
      }
    } catch {
      // ignore logging errors
    }

    const allFailedByQuota =
      !anySucceeded &&
      failed.length > 0 &&
      failed.every((item) => isUpstreamRateLimitError(item.error || ''));

    if (allFailedByQuota) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Rasm generatsiyasi vaqtincha limitga urildi (429/quota). Avto fallback ishlatildi, lekin hammasi band. 20-60 soniyada qayta urinib ko'ring.",
          code: 'UPSTREAM_RATE_LIMIT',
          batch_id: batchId,
          items: ordered.map((item) => ({
            id: item.id,
            index: item.index,
            status: item.status,
            label: item.label,
            imageUrl: item.imageUrl,
            error: item.error,
          })),
          parallel_limit: parallelLimit,
          retry_after_seconds: 25,
          tokens_reserved: reservedTokens,
          tokens_charged: user.role === 'admin' ? 0 : tokensCharged,
          tokens_refunded: user.role === 'admin' ? 0 : tokensRefunded,
          tokens_remaining: user.role === 'admin' ? 999999 : Number(reservedTokensRemaining.toFixed(2)),
        },
        {
          status: 429,
          headers: {
            'Retry-After': '25',
          },
        }
      );
    }

    const status = failed.length === 0 ? 'succeeded' : anySucceeded ? 'partial' : 'failed';
    return NextResponse.json({
      success: true,
      status,
      batch_id: batchId,
      images: succeeded.map((item) => item.imageUrl).filter(Boolean),
      items: ordered.map((item) => ({
        id: item.id,
        index: item.index,
        status: item.status,
        label: item.label,
        imageUrl: item.imageUrl,
        error: item.error,
      })),
      progress: {
        done: ordered.length,
        total: ordered.length,
        percent: 100,
        queued: 0,
        processing: 0,
        succeeded: succeeded.length,
        failed: failed.length,
        canceled: 0,
      },
      parallel_limit: parallelLimit,
      tokens_reserved: reservedTokens,
      tokens_charged: user.role === 'admin' ? 0 : tokensCharged,
      tokens_refunded: user.role === 'admin' ? 0 : tokensRefunded,
      tokens_remaining: user.role === 'admin' ? 999999 : Number(reservedTokensRemaining.toFixed(2)),
      note: 'Synchronous generation completed.',
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

    const lower = message.toLowerCase();
    if (isUpstreamRateLimitError(lower)) {
      return NextResponse.json(
        {
          error:
            "Rasm generatsiyasi limitga urildi (429/quota). Iltimos 20-60 soniya kutib qayta urinib ko'ring.",
          code: 'UPSTREAM_RATE_LIMIT',
        },
        {
          status: 429,
          headers: {
            'Retry-After': '25',
          },
        }
      );
    }

    const isPolicyBlocked =
      lower.includes('safety') ||
      lower.includes('sexually explicit') ||
      lower.includes('prompt_policy_blocked') ||
      lower.includes('blocked by gemini safety');
    if (isPolicyBlocked) {
      return NextResponse.json(
        {
          error:
            "So'rov xavfsizlik siyosatiga mos kelmadi. 18+ yoki axloqsiz kontentga ruxsat yo'q.",
          code: 'PROMPT_POLICY_BLOCKED',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
