
import { NextRequest, NextResponse } from 'next/server';
import { generateMarketplaceImage as generateGeminiMarketplaceImage } from '../../../../services/gemini';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import {
  BillingError,
  getAuthenticatedUserAccount,
  getImagePolicy,
  recordTokenUsage,
  refundTokens,
  reserveTokens,
} from '@/lib/subscription';

function extFromMime(mime: string): string {
  switch (mime) {
    case 'image/png': return 'png';
    case 'image/jpeg': return 'jpg';
    case 'image/webp': return 'webp';
    default: return 'png';
  }
}

async function tryPersistDataUrlToPublic(dataUrl: string): Promise<string | null> {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;

  const mime = match[1];
  const base64 = match[2];
  const ext = extFromMime(mime);
  const fileName = `vertex-${randomUUID()}.${ext}`;

  const dir = path.join(process.cwd(), 'public', 'generated');
  const filePath = path.join(dir, fileName);

  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
    return `/generated/${fileName}`;
  } catch {
    return null;
  }
}

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

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  let reservedTokens = 0;
  let reservedTokensRemaining = 0;
  let costPerImage = 0;

  try {
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
    // We no longer support Vertex for image generation; Gemini-only.
    const provider = 'gemini';
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

    if (!policy.outputCount || policy.costPerImage <= 0) {
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

    const hasAnyProductImage =
      productImages.length > 0 || frontImagesRaw.length > 0 || backImagesRaw.length > 0 || sideImagesRaw.length > 0;

    if (!basePrompt && !hasAnyProductImage) {
      return NextResponse.json({ error: 'Prompt or product image required' }, { status: 400 });
    }

    const safePrompt = basePrompt.slice(0, policy.maxPromptChars);
    const safeProductImages = productImages.slice(0, policy.maxProductImages);
    const safeStyleImages = styleImages.slice(0, policy.maxStyleImages);

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

    const requestedModel = model || undefined;

    // Reserve tokens upfront; refund any unused on partial failures
    costPerImage = policy.costPerImage;
    reservedTokens = Number((policy.costPerImage * policy.outputCount).toFixed(2));
    if (user.role !== 'admin') {
      const reserveResult = await reserveTokens({ userId: user.id, tokens: reservedTokens });
      reservedTokensRemaining = reserveResult.tokensRemaining;
    } else {
      reservedTokensRemaining = 999999;
    }

    // Run in parallel
    const results = await Promise.allSettled(
      variations.map(async (v) => {
        const fullPrompt = `${safePrompt}${v.suffix}\n\nOUTPUT REQUIREMENT: The final image must be exactly 1080x1440 pixels (3:4).`;
        const productImagesForVariation = v.productImages?.length ? v.productImages : safeProductImages;

        return generateGeminiMarketplaceImage(fullPrompt, productImagesForVariation, safeStyleImages, aspectRatio, {
          model: requestedModel,
        });
      })
    );

    const successfulImages: string[] = [];
    const successfulLabels: string[] = [];
    const errors: string[] = [];

    results.forEach((res, idx) => {
      const v = variations[idx];
      if (res.status === 'fulfilled') {
        successfulImages.push(res.value);
        successfulLabels.push(v?.label || v?.id || `Image ${idx + 1}`);
      } else {
        errors.push(res.reason?.message || 'Unknown error');
      }
    });

    if (successfulImages.length === 0) {
      if (user.role !== 'admin' && userId && reservedTokens) {
        await refundTokens({ userId, tokens: reservedTokens });
      }
      throw new Error(errors[0] || 'Failed to generate images');
    }

    const imagesSucceeded = successfulImages.length;
    const imagesRequested = policy.outputCount;
    const unusedCount = Math.max(0, imagesRequested - imagesSucceeded);
    const refundAmount = Number((unusedCount * costPerImage).toFixed(2));
    if (user.role !== 'admin' && userId && refundAmount > 0) {
      await refundTokens({ userId, tokens: refundAmount });
    }

    // Persist to disk
    const persistedUrls = await Promise.all(successfulImages.map(tryPersistDataUrlToPublic));
    const finalUrls = persistedUrls.map((url, i) => url || successfulImages[i]);

    if (user.role !== 'admin') {
      await recordTokenUsage({
        userId: user.id,
        tokensUsed: Number((imagesSucceeded * costPerImage).toFixed(2)),
        serviceType: 'image_generate',
        modelUsed: model || 'gemini',
        prompt: safePrompt,
      });
    }

    return NextResponse.json({
      success: true,
      images: finalUrls, // Return array
      imageUrl: finalUrls[0], // Backwards compat
      image_labels: successfulLabels,
      tokens_charged: Number((imagesSucceeded * costPerImage).toFixed(2)),
      tokens_reserved: reservedTokens,
      tokens_remaining:
        user.role === 'admin'
          ? 999999
          : Number((reservedTokensRemaining + refundAmount).toFixed(2)),
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

    if (userId && reservedTokens) {
      try {
        await refundTokens({ userId, tokens: reservedTokens });
      } catch {
        // ignore
      }
    }

    const status =
      message.includes('(400') ? 400 :
        message.includes('(401') ? 401 :
          message.includes('(403') ? 403 :
            message.includes('(404') ? 404 :
              message.includes('(429') ? 429 :
                message.includes('(503') ? 503 :
                  message.includes('(504') ? 504 :
                    500;

    return NextResponse.json(
      {
        error: message,
        details: message
      },
      { status }
    );
  }
}
