import { query } from '@/lib/db';

export type AiRequestStatInsert = {
  userId: string;
  batchId?: string | null;
  serviceType: string;
  provider: string;
  model: string | null;
  plan: string | null;
  mode: string | null;
  promptWords: number;
  promptChars: number;
  inputProductImages: number;
  inputStyleImages: number;
  outputImages: number;
  inputTokensTotal?: number | null;
  inputUserPromptTokens?: number | null;
  inputSystemPromptTokens?: number | null;
  inputImageTokens?: number | null;
  outputTokensTotal?: number | null;
  outputImageTokens?: number | null;
  outputTextTokens?: number | null;
  totalTokens: number | null;
  meta?: unknown;
};

export async function ensureAiRequestStatsTable(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS ai_request_stats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      batch_id UUID,
      service_type VARCHAR(64) NOT NULL,
      provider VARCHAR(32) NOT NULL,
      model VARCHAR(128),
      plan VARCHAR(50),
      mode VARCHAR(16),
      prompt_words INT NOT NULL DEFAULT 0,
      prompt_chars INT NOT NULL DEFAULT 0,
      input_product_images INT NOT NULL DEFAULT 0,
      input_style_images INT NOT NULL DEFAULT 0,
      output_images INT NOT NULL DEFAULT 0,
      input_tokens_total INT,
      input_user_prompt_tokens INT,
      input_system_prompt_tokens INT,
      input_image_tokens INT,
      output_tokens_total INT,
      output_image_tokens INT,
      output_text_tokens INT,
      total_tokens INT,
      meta JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

  // Forward-compatible: add columns if table already existed.
  await query(`ALTER TABLE ai_request_stats ADD COLUMN IF NOT EXISTS input_tokens_total INT`);
  await query(`ALTER TABLE ai_request_stats ADD COLUMN IF NOT EXISTS input_user_prompt_tokens INT`);
  await query(`ALTER TABLE ai_request_stats ADD COLUMN IF NOT EXISTS input_system_prompt_tokens INT`);
  await query(`ALTER TABLE ai_request_stats ADD COLUMN IF NOT EXISTS input_image_tokens INT`);
  await query(`ALTER TABLE ai_request_stats ADD COLUMN IF NOT EXISTS output_tokens_total INT`);
  await query(`ALTER TABLE ai_request_stats ADD COLUMN IF NOT EXISTS output_image_tokens INT`);
  await query(`ALTER TABLE ai_request_stats ADD COLUMN IF NOT EXISTS output_text_tokens INT`);

  await query(`CREATE INDEX IF NOT EXISTS idx_ai_request_stats_created_at ON ai_request_stats(created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ai_request_stats_user ON ai_request_stats(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ai_request_stats_service ON ai_request_stats(service_type)`);
}

export async function recordAiRequestStat(stat: AiRequestStatInsert): Promise<void> {
  await ensureAiRequestStatsTable();

  const safeWords = Number.isFinite(stat.promptWords) ? Math.max(0, Math.floor(stat.promptWords)) : 0;
  const safeChars = Number.isFinite(stat.promptChars) ? Math.max(0, Math.floor(stat.promptChars)) : 0;
  const safeInProd = Number.isFinite(stat.inputProductImages) ? Math.max(0, Math.floor(stat.inputProductImages)) : 0;
  const safeInStyle = Number.isFinite(stat.inputStyleImages) ? Math.max(0, Math.floor(stat.inputStyleImages)) : 0;
  const safeOut = Number.isFinite(stat.outputImages) ? Math.max(0, Math.floor(stat.outputImages)) : 0;

  const safeInputTokensTotal =
    stat.inputTokensTotal === null || stat.inputTokensTotal === undefined
      ? null
      : Number.isFinite(Number(stat.inputTokensTotal))
        ? Math.max(0, Math.floor(Number(stat.inputTokensTotal)))
        : null;
  const safeInputUserPromptTokens =
    stat.inputUserPromptTokens === null || stat.inputUserPromptTokens === undefined
      ? null
      : Number.isFinite(Number(stat.inputUserPromptTokens))
        ? Math.max(0, Math.floor(Number(stat.inputUserPromptTokens)))
        : null;
  const safeInputSystemPromptTokens =
    stat.inputSystemPromptTokens === null || stat.inputSystemPromptTokens === undefined
      ? null
      : Number.isFinite(Number(stat.inputSystemPromptTokens))
        ? Math.max(0, Math.floor(Number(stat.inputSystemPromptTokens)))
        : null;
  const safeInputImageTokens =
    stat.inputImageTokens === null || stat.inputImageTokens === undefined
      ? null
      : Number.isFinite(Number(stat.inputImageTokens))
        ? Math.max(0, Math.floor(Number(stat.inputImageTokens)))
        : null;
  const safeOutputTokensTotal =
    stat.outputTokensTotal === null || stat.outputTokensTotal === undefined
      ? null
      : Number.isFinite(Number(stat.outputTokensTotal))
        ? Math.max(0, Math.floor(Number(stat.outputTokensTotal)))
        : null;
  const safeOutputImageTokens =
    stat.outputImageTokens === null || stat.outputImageTokens === undefined
      ? null
      : Number.isFinite(Number(stat.outputImageTokens))
        ? Math.max(0, Math.floor(Number(stat.outputImageTokens)))
        : null;
  const safeOutputTextTokens =
    stat.outputTextTokens === null || stat.outputTextTokens === undefined
      ? null
      : Number.isFinite(Number(stat.outputTextTokens))
        ? Math.max(0, Math.floor(Number(stat.outputTextTokens)))
        : null;

  const safeTokens = stat.totalTokens === null || stat.totalTokens === undefined
    ? null
    : Number.isFinite(Number(stat.totalTokens))
      ? Math.max(0, Math.floor(Number(stat.totalTokens)))
      : null;

  const batchId = stat.batchId ? String(stat.batchId) : null;
  const metaJson = stat.meta === undefined ? null : JSON.stringify(stat.meta);

  await query(
    `INSERT INTO ai_request_stats (
      user_id, batch_id, service_type, provider, model, plan, mode,
      prompt_words, prompt_chars,
      input_product_images, input_style_images,
      output_images,
      input_tokens_total, input_user_prompt_tokens, input_system_prompt_tokens, input_image_tokens,
      output_tokens_total, output_image_tokens, output_text_tokens,
      total_tokens, meta
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9,
      $10, $11,
      $12,
      $13, $14, $15, $16,
      $17, $18, $19,
      $20, $21::jsonb
    )`,
    [
      stat.userId,
      batchId,
      stat.serviceType,
      stat.provider,
      stat.model,
      stat.plan,
      stat.mode,
      safeWords,
      safeChars,
      safeInProd,
      safeInStyle,
      safeOut,
      safeInputTokensTotal,
      safeInputUserPromptTokens,
      safeInputSystemPromptTokens,
      safeInputImageTokens,
      safeOutputTokensTotal,
      safeOutputImageTokens,
      safeOutputTextTokens,
      safeTokens,
      metaJson,
    ]
  );
}

export function countWords(text: string): number {
  const s = String(text || '').trim();
  if (!s) return 0;
  return s.split(/\s+/).filter(Boolean).length;
}
