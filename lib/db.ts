import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.DB_USER || 'umari-ai',
  password: process.env.DB_PASSWORD || 'umari-ai-password',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'umari_studio',
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
  max: parseInt(process.env.DB_POOL_MAX || '10', 10),
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableDbError = (err: unknown): boolean => {
  const anyErr = err as any;
  const code = String(anyErr?.code || '').trim();
  const message = String(anyErr?.message || '').toLowerCase();

  // Postgres SQLSTATE codes for transient/connection-related failures.
  // 57P03: cannot connect now (startup/recovery)
  // 57P01/57P02: admin shutdown/crash shutdown
  // 08xxx: connection exception class
  const pgRetryableCodes = new Set([
    '57P03',
    '57P01',
    '57P02',
    '08000',
    '08001',
    '08003',
    '08004',
    '08006',
    '08007',
  ]);

  const nodeRetryableCodes = new Set([
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'EAI_AGAIN',
    'ENOTFOUND',
  ]);

  if (pgRetryableCodes.has(code)) return true;
  if (nodeRetryableCodes.has(code)) return true;

  if (message.includes('not yet accepting connections')) return true;
  if (message.includes('the database system is starting up')) return true;
  if (message.includes('the database system is in recovery mode')) return true;
  if (message.includes('consistent recovery state has not been reached')) return true;

  return false;
};

const getRetryConfig = () => {
  const attempts = Math.max(0, parseInt(process.env.DB_RETRY_ATTEMPTS || '10', 10));
  const baseDelayMs = Math.max(0, parseInt(process.env.DB_RETRY_BASE_DELAY_MS || '250', 10));
  const maxDelayMs = Math.max(baseDelayMs, parseInt(process.env.DB_RETRY_MAX_DELAY_MS || '3000', 10));
  return { attempts, baseDelayMs, maxDelayMs };
};

export const query = async (text: string, params?: any[]) => {
  const { attempts, baseDelayMs, maxDelayMs } = getRetryConfig();

  let lastErr: unknown;
  for (let i = 0; i <= attempts; i++) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      lastErr = err;
      if (i >= attempts || !isRetryableDbError(err)) throw err;

      const delay = Math.min(maxDelayMs, Math.round(baseDelayMs * Math.pow(1.7, i)));
      if (i === 0) {
        const anyErr = err as any;
        console.warn('DB query failed; retrying...', {
          code: anyErr?.code,
          message: anyErr?.message,
          delayMs: delay,
        });
      }
      await sleep(delay);
    }
  }

  throw lastErr;
};

export const getClient = async () => {
  const { attempts, baseDelayMs, maxDelayMs } = getRetryConfig();

  let lastErr: unknown;
  for (let i = 0; i <= attempts; i++) {
    try {
      return await pool.connect();
    } catch (err) {
      lastErr = err;
      if (i >= attempts || !isRetryableDbError(err)) throw err;

      const delay = Math.min(maxDelayMs, Math.round(baseDelayMs * Math.pow(1.7, i)));
      if (i === 0) {
        const anyErr = err as any;
        console.warn('DB connect failed; retrying...', {
          code: anyErr?.code,
          message: anyErr?.message,
          delayMs: delay,
        });
      }
      await sleep(delay);
    }
  }

  throw lastErr;
};

export default pool;
