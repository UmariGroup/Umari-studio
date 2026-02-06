/* eslint-disable no-console */

const { Pool } = require('pg');
const axios = require('axios');
const { randomUUID } = require('crypto');
const { promises: fs } = require('fs');
const path = require('path');

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.API_KEY ||
  '';

const DEFAULT_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash';
const DEFAULT_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

const RETRY_ATTEMPTS = Math.max(1, Number(process.env.GEMINI_RETRY_ATTEMPTS || 3));

const WORKER_ID = (process.env.IMAGE_WORKER_ID || process.env.WORKER_ID || `image-worker-${process.pid}`).trim();

function readInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function getPlanSlots() {
  return {
    free: Math.max(1, readInt(process.env.IMAGE_QUEUE_PARALLEL_FREE, 1)),
    starter: Math.max(1, readInt(process.env.IMAGE_QUEUE_PARALLEL_STARTER, 1)),
    pro: Math.max(1, readInt(process.env.IMAGE_QUEUE_PARALLEL_PRO, 2)),
    business_plus: Math.max(1, readInt(process.env.IMAGE_QUEUE_PARALLEL_BUSINESS_PLUS, 4)),
  };
}

function getDbConfig() {
  return {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: readInt(process.env.DB_PORT, 5432),
    database: process.env.DB_NAME || 'umari_studio',
    max: Math.max(5, readInt(process.env.IMAGE_WORKER_DB_POOL_MAX, 10)),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(value) {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  const s = String(raw).trim();
  const seconds = Number(s);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(60_000, Math.floor(seconds * 1000));
  return null;
}

function requireApiKey() {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is missing. Set GEMINI_API_KEY in env.');
  }
}

function assertGeminiModelName(model) {
  const trimmed = String(model || '').trim();
  if (!trimmed) throw new Error('Gemini model is empty.');
}

function normalizeAspectRatio(aspectRatio) {
  const allowed = new Set([
    '1:1',
    '2:3',
    '3:2',
    '3:4',
    '4:3',
    '4:5',
    '5:4',
    '9:16',
    '16:9',
    '21:9',
  ]);
  return allowed.has(aspectRatio) ? aspectRatio : '1:1';
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl || ''));
  if (!match) return null;
  let mimeType = match[1];
  const data = match[2];
  if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
  return { mimeType, data };
}

function validateInlineImage(mimeType, base64) {
  const allowed = new Set(['image/png', 'image/jpeg', 'image/webp']);
  if (!allowed.has(mimeType)) {
    throw new Error(
      `Unsupported image type '${mimeType}'. Please upload PNG/JPEG/WebP images (HEIC/HEIF/AVIF are not supported).`
    );
  }
  const approxBytes = Math.floor((String(base64 || '').length * 3) / 4);
  const maxBytesPerImage = 9 * 1024 * 1024;
  if (approxBytes > maxBytesPerImage) {
    throw new Error('Image is too large. Please upload an image under 9MB.');
  }
}

function toInlineDataPart(image) {
  const parsed = parseDataUrl(image);
  if (!parsed) return null;
  validateInlineImage(parsed.mimeType, parsed.data);
  return { inlineData: { mimeType: parsed.mimeType, data: parsed.data } };
}

async function geminiGenerateContent(model, body) {
  requireApiKey();
  assertGeminiModelName(model);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  let lastErr;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await axios.post(url, body, {
        params: { key: GEMINI_API_KEY },
        timeout: 120_000,
      });
      return res.data;
    } catch (error) {
      lastErr = error;

      if (!axios.isAxiosError(error)) throw error;

      const status = error.response?.status;
      const retryable = status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

      if (retryable && attempt < RETRY_ATTEMPTS) {
        const retryAfterMs = parseRetryAfterMs(error.response?.headers?.['retry-after']);
        const expBackoffMs = Math.min(15_000, 750 * Math.pow(2, attempt - 1));
        const jitterMs = Math.floor(Math.random() * 250);
        const waitMs = Math.max(retryAfterMs || 0, expBackoffMs) + jitterMs;
        await sleep(waitMs);
        continue;
      }

      const statusText = error.response?.statusText;
      const data = error.response?.data;
      let details = '';
      try {
        details = typeof data === 'string' ? data : JSON.stringify(data);
      } catch {
        details = '';
      }
      if (details.length > 2500) details = details.slice(0, 2500) + '…';

      const suffix = details ? `\nGemini response: ${details}` : '';
      throw new Error(
        `Gemini API error${status ? ` (${status}${statusText ? ` ${statusText}` : ''})` : ''}: ${error.message}${suffix}`
      );
    }
  }

  throw lastErr;
}

function extractFirstImageDataUrl(response) {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;

  for (const part of parts) {
    const inlineData = part?.inlineData || part?.inline_data;
    const mimeType = inlineData?.mimeType || inlineData?.mime_type;
    const data = inlineData?.data;

    if (typeof mimeType === 'string' && typeof data === 'string' && mimeType.startsWith('image/')) {
      return `data:${mimeType};base64,${data}`;
    }
  }

  return null;
}

async function generateMarketplaceImage(prompt, productImages = [], styleImages = [], aspectRatio = '1:1', options = {}) {
  const model = String(options.model || DEFAULT_IMAGE_MODEL).trim();
  const parts = [];

  const hasStyleImages = Array.isArray(styleImages) && styleImages.length > 0;

  let finalPrompt = `Task: Generate a high-quality professional marketplace product image.\n`;
  finalPrompt += `Goal: Place the object described in 'Main Product' section into the context/style of 'Style Reference' section.\n`;
  finalPrompt += `CRITICAL: You MUST preserve the identity of the MAIN PRODUCT exactly. \n`;
  finalPrompt += `CRITICAL: Do NOT generate the object shown in the STYLE REFERENCE. Only copy the background, lighting, and composition/pose from the reference.\n`;
  finalPrompt += `User Prompt/Setting: ${prompt}.\n`;

  parts.push({ text: finalPrompt });

  if (Array.isArray(productImages) && productImages.length > 0) {
    parts.push({ text: '\n[[MAIN PRODUCT IMAGES - The Object to Generate]]\n' });
    for (const img of productImages) {
      const inlinePart = toInlineDataPart(img);
      if (inlinePart) parts.push(inlinePart);
    }
  }

  if (hasStyleImages) {
    parts.push({
      text: '\n[[STYLE REFERENCE IMAGES - Copy only background/lighting/context/pose, IGNORE the object itself]]\n',
    });
    for (const img of styleImages) {
      const inlinePart = toInlineDataPart(img);
      if (inlinePart) parts.push(inlinePart);
    }
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      imageConfig: {
        aspectRatio: normalizeAspectRatio(aspectRatio),
      },
    },
  };

  const response = await geminiGenerateContent(model, body);
  const dataUrl = extractFirstImageDataUrl(response);

  if (!dataUrl) {
    const finishReason = response?.candidates?.[0]?.finishReason;
    if (finishReason === 'NO_IMAGE') {
      throw new Error('Model did not return an image (NO_IMAGE). Try a different image model.');
    }
    throw new Error('No image returned from Gemini API.');
  }

  return dataUrl;
}

function extFromMime(mime) {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default:
      return 'png';
  }
}

async function tryPersistDataUrlToPublic(dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed || !parsed.mimeType.startsWith('image/')) return null;

  const ext = extFromMime(parsed.mimeType);
  const fileName = `gemini-${randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), 'public', 'generated');
  const filePath = path.join(dir, fileName);

  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, Buffer.from(parsed.data, 'base64'));
    return `/generated/${fileName}`;
  } catch {
    return null;
  }
}

async function ensureImageJobsTable(pool) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS image_jobs (
      id UUID PRIMARY KEY,
      batch_id UUID NOT NULL,
      batch_index INT NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan VARCHAR(50) NOT NULL CHECK (plan IN ('free', 'starter', 'pro', 'business_plus')),
      mode VARCHAR(16) NOT NULL CHECK (mode IN ('basic', 'pro')),
      provider VARCHAR(32) NOT NULL DEFAULT 'gemini',
      model VARCHAR(128),
      aspect_ratio VARCHAR(16),
      label TEXT,
      base_prompt TEXT,
      prompt TEXT,
      product_images JSONB,
      style_images JSONB,
      status VARCHAR(32) NOT NULL CHECK (status IN ('queued', 'processing', 'succeeded', 'failed', 'canceled')),
      priority INT NOT NULL DEFAULT 0,
      result_url TEXT,
      error_text TEXT,
      tokens_reserved NUMERIC(10, 2) NOT NULL DEFAULT 0,
      tokens_refunded NUMERIC(10, 2) NOT NULL DEFAULT 0,
      usage_recorded BOOLEAN NOT NULL DEFAULT false,
      worker_id VARCHAR(128),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      started_at TIMESTAMP,
      finished_at TIMESTAMP
    )`
  );

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_image_jobs_user_created ON image_jobs(user_id, created_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_image_jobs_batch ON image_jobs(batch_id, batch_index)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_image_jobs_queue ON image_jobs(plan, status, priority, created_at)`);
}

async function requeueStaleJobs(pool) {
  const staleMinutes = Math.max(5, readInt(process.env.IMAGE_WORKER_STALE_MINUTES, 20));
  try {
    const res = await pool.query(
      `UPDATE image_jobs
       SET status = 'queued',
           worker_id = NULL,
           updated_at = NOW()
       WHERE status = 'processing'
         AND updated_at < (NOW() - ($1 * INTERVAL '1 minute'))`,
      [staleMinutes]
    );
    if ((res.rowCount || 0) > 0) {
      console.log(`[${WORKER_ID}] re-queued stale jobs: ${res.rowCount} (>${staleMinutes}m)`);
    }
  } catch (err) {
    console.error(`[${WORKER_ID}] failed to re-queue stale jobs`, err);
  }
}

function planLockKey(plan, slot) {
  const base =
    plan === 'starter' ? 200_000 :
    plan === 'pro' ? 300_000 :
    plan === 'business_plus' ? 400_000 :
      100_000; // free/other
  return base + slot;
}

async function claimNextJob(client, plan) {
  const res = await client.query(
    `WITH next AS (
       SELECT id
       FROM image_jobs
       WHERE status = 'queued'
         AND plan = $1
       ORDER BY priority DESC, created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE image_jobs j
     SET status = 'processing',
         started_at = NOW(),
         updated_at = NOW(),
         worker_id = $2
     FROM next
     WHERE j.id = next.id
     RETURNING j.*`,
    [plan, WORKER_ID]
  );
  return res.rows?.[0] || null;
}

async function getBatchReservedJobsCount(client, batchId) {
  const res = await client.query(
    `SELECT COUNT(*)::int AS cnt
     FROM image_jobs
     WHERE batch_id = $1
       AND tokens_reserved > 0`,
    [batchId]
  );
  return Number(res.rows?.[0]?.cnt ?? 0);
}

async function finalizeSuccessLegacy(client, jobId, imageUrl) {
  await client.query('BEGIN');
  try {
    const rowRes = await client.query(
      `SELECT user_id, tokens_reserved, usage_recorded, base_prompt, model
       FROM image_jobs
       WHERE id = $1
       FOR UPDATE`,
      [jobId]
    );

    if (!rowRes.rows?.[0]) {
      await client.query('ROLLBACK');
      return;
    }

    const row = rowRes.rows[0];
    const tokensReserved = Number(row.tokens_reserved || 0);
    const usageRecorded = Boolean(row.usage_recorded);

    if (tokensReserved > 0 && !usageRecorded) {
      const prompt = String(row.base_prompt || '').slice(0, 1000) || null;
      await client.query(
        `INSERT INTO token_usage (user_id, tokens_used, service_type, model_used, prompt)
         VALUES ($1, $2, 'image_generate', $3, $4)`,
        [row.user_id, tokensReserved, row.model || null, prompt]
      );
    }

    await client.query(
      `UPDATE image_jobs
       SET status = 'succeeded',
           result_url = $2,
           error_text = NULL,
           usage_recorded = CASE WHEN tokens_reserved > 0 THEN true ELSE usage_recorded END,
           updated_at = NOW(),
           finished_at = NOW()
       WHERE id = $1`,
      [jobId, imageUrl]
    );

    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw err;
  }
}

async function finalizeFailureLegacy(client, jobId, errorText) {
  const safeError = String(errorText || 'Unknown error').slice(0, 5000);

  await client.query('BEGIN');
  try {
    const rowRes = await client.query(
      `SELECT user_id, tokens_reserved, tokens_refunded
       FROM image_jobs
       WHERE id = $1
       FOR UPDATE`,
      [jobId]
    );

    if (!rowRes.rows?.[0]) {
      await client.query('ROLLBACK');
      return;
    }

    const row = rowRes.rows[0];
    const tokensReserved = Number(row.tokens_reserved || 0);
    const alreadyRefunded = Number(row.tokens_refunded || 0);
    const refundAmount = tokensReserved > 0 && alreadyRefunded <= 0 ? tokensReserved : 0;

    if (refundAmount > 0) {
      await client.query(
        `UPDATE users
         SET tokens_remaining = tokens_remaining + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [refundAmount, row.user_id]
      );
    }

    await client.query(
      `UPDATE image_jobs
       SET status = 'failed',
           error_text = $2,
           tokens_refunded = tokens_refunded + $3,
           updated_at = NOW(),
           finished_at = NOW()
       WHERE id = $1`,
      [jobId, safeError, refundAmount]
    );

    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw err;
  }
}

async function finalizeSuccessRequest(client, jobId, imageUrl) {
  await client.query(
    `UPDATE image_jobs
     SET status = 'succeeded',
         result_url = $2,
         error_text = NULL,
         updated_at = NOW(),
         finished_at = NOW()
     WHERE id = $1`,
    [jobId, imageUrl]
  );
}

async function finalizeFailureRequest(client, jobId, errorText) {
  const safeError = String(errorText || 'Unknown error').slice(0, 5000);
  await client.query(
    `UPDATE image_jobs
     SET status = 'failed',
         error_text = $2,
         updated_at = NOW(),
         finished_at = NOW()
     WHERE id = $1`,
    [jobId, safeError]
  );
}

async function settleBatchRequestBilling(client, batchId) {
  await client.query('BEGIN');
  try {
    const billingRes = await client.query(
      `SELECT id, user_id, tokens_reserved, tokens_refunded, usage_recorded, base_prompt, model
       FROM image_jobs
       WHERE batch_id = $1 AND batch_index = 0
       FOR UPDATE`,
      [batchId]
    );

    const billing = billingRes.rows?.[0];
    if (!billing) {
      await client.query('ROLLBACK');
      return;
    }

    const tokensReserved = Number(billing.tokens_reserved || 0);
    const tokensRefunded = Number(billing.tokens_refunded || 0);
    const usageRecorded = Boolean(billing.usage_recorded);

    const countsRes = await client.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'succeeded')::int AS succeeded,
              COUNT(*) FILTER (WHERE status IN ('succeeded','failed','canceled'))::int AS done
       FROM image_jobs
       WHERE batch_id = $1`,
      [batchId]
    );

    const total = Number(countsRes.rows?.[0]?.total ?? 0);
    const succeeded = Number(countsRes.rows?.[0]?.succeeded ?? 0);
    const done = Number(countsRes.rows?.[0]?.done ?? 0);

    if (!Number.isFinite(total) || total <= 0 || done < total) {
      await client.query('COMMIT');
      return;
    }

    // Already settled
    if (usageRecorded || (tokensReserved > 0 && tokensRefunded >= tokensReserved)) {
      await client.query('COMMIT');
      return;
    }

    // Admin / no-billing: mark as settled to avoid rework
    if (!(tokensReserved > 0)) {
      await client.query(
        `UPDATE image_jobs
         SET usage_recorded = true,
             updated_at = NOW()
         WHERE batch_id = $1 AND batch_index = 0`,
        [batchId]
      );
      await client.query('COMMIT');
      return;
    }

    if (succeeded > 0) {
      // Charge ONCE per request
      const prompt = String(billing.base_prompt || '').slice(0, 1000) || null;
      await client.query(
        `INSERT INTO token_usage (user_id, tokens_used, service_type, model_used, prompt)
         VALUES ($1, $2, 'image_generate', $3, $4)`,
        [billing.user_id, tokensReserved, billing.model || null, prompt]
      );

      await client.query(
        `UPDATE image_jobs
         SET usage_recorded = true,
             updated_at = NOW()
         WHERE batch_id = $1 AND batch_index = 0`,
        [batchId]
      );

      await client.query('COMMIT');
      return;
    }

    // All outputs failed/canceled: refund full request
    const refundAmount = Math.max(0, tokensReserved - tokensRefunded);
    if (refundAmount > 0) {
      await client.query(
        `UPDATE users
         SET tokens_remaining = tokens_remaining + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [refundAmount, billing.user_id]
      );

      await client.query(
        `UPDATE image_jobs
         SET tokens_refunded = tokens_refunded + $2,
             updated_at = NOW()
         WHERE batch_id = $1 AND batch_index = 0`,
        [batchId, refundAmount]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw err;
  }
}

async function processJob(client, job) {
  const jobId = String(job?.id || '').trim();
  if (!jobId) return;

  const batchId = String(job?.batch_id || '').trim();
  const reservedJobsCount = batchId ? await getBatchReservedJobsCount(client, batchId) : 0;
  const isLegacyPerOutput = reservedJobsCount > 1;

  const model = String(job?.model || DEFAULT_IMAGE_MODEL).trim() || DEFAULT_IMAGE_MODEL;
  const aspectRatio = String(job?.aspect_ratio || '1:1');
  const prompt = String(job?.prompt || '').trim();

  const productImages = Array.isArray(job?.product_images) ? job.product_images : [];
  const styleImages = Array.isArray(job?.style_images) ? job.style_images : [];

  try {
    const dataUrl = await generateMarketplaceImage(prompt, productImages, styleImages, aspectRatio, { model });
    const persisted = await tryPersistDataUrlToPublic(dataUrl);
    const finalUrl = persisted || dataUrl;
    if (isLegacyPerOutput) {
      await finalizeSuccessLegacy(client, jobId, finalUrl);
    } else {
      await finalizeSuccessRequest(client, jobId, finalUrl);
      if (batchId) await settleBatchRequestBilling(client, batchId);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    try {
      if (isLegacyPerOutput) {
        await finalizeFailureLegacy(client, jobId, msg);
      } else {
        await finalizeFailureRequest(client, jobId, msg);
        if (batchId) await settleBatchRequestBilling(client, batchId);
      }
    } catch (err2) {
      console.error(`[${WORKER_ID}] finalize failed`, err2);
    }
  }
}

async function runPlanSlot(pool, plan, slot) {
  const client = await pool.connect();
  const lockKey = planLockKey(plan, slot);
  const name = `${WORKER_ID}:${plan}:${slot}`;

  try {
    await client.query(`SET application_name TO $1`, [name]);
  } catch {
    // ignore
  }

  console.log(`[${name}] acquiring slot lock ${lockKey}...`);
  await client.query(`SELECT pg_advisory_lock($1)`, [lockKey]);
  console.log(`[${name}] slot lock acquired.`);

  while (true) {
    const job = await claimNextJob(client, plan);
    if (!job) {
      await sleep(750);
      continue;
    }

    await processJob(client, job);
  }
}

async function main() {
  const pool = new Pool(getDbConfig());

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  await ensureImageJobsTable(pool);
  await requeueStaleJobs(pool);

  const slots = getPlanSlots();
  console.log(`[${WORKER_ID}] started. Slots: ${JSON.stringify(slots)}`);

  const plans = Object.keys(slots);
  for (const plan of plans) {
    const count = slots[plan];
    for (let slot = 0; slot < count; slot++) {
      runPlanSlot(pool, plan, slot).catch((err) => {
        console.error(`[${WORKER_ID}] plan slot crashed`, plan, slot, err);
        process.exitCode = 1;
      });
    }
  }

  const sweeper = setInterval(() => {
    void requeueStaleJobs(pool);
  }, Math.max(15_000, readInt(process.env.IMAGE_WORKER_SWEEP_INTERVAL_MS, 60_000)));

  const shutdown = async () => {
    clearInterval(sweeper);
    try {
      await pool.end();
    } catch {
      // ignore
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(`[${WORKER_ID}] fatal error`, err);
  process.exit(1);
});
