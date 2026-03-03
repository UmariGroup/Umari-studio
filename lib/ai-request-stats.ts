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
      total_tokens INT,
      meta JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

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
      output_images, total_tokens, meta
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9,
      $10, $11,
      $12, $13, $14::jsonb
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
