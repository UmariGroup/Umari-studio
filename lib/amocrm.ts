import { getClient, query } from '@/lib/db';
import { ensureAmoCrmSchema } from '@/lib/amocrm-schema';

type AmoTokensRow = {
  id: string;
  base_url: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  account_id: number | null;
  created_at: string;
  updated_at: string;
};

type AmoTokenResponse = {
  token_type: 'Bearer' | string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
};

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export function getAmoCrmBaseUrl(): string {
  const explicit = (process.env.AMOCRM_BASE_URL || '').trim();
  if (explicit) return normalizeBaseUrl(explicit);

  const subdomain = (process.env.AMOCRM_SUBDOMAIN || '').trim();
  if (!subdomain) return '';

  const domain = (process.env.AMOCRM_DOMAIN || 'amocrm.ru').trim();
  return normalizeBaseUrl(`https://${subdomain}.${domain}`);
}

export function isAmoCrmEnabled(): boolean {
  return String(process.env.AMOCRM_ENABLED || '').toLowerCase() === 'true';
}

export function getAmoCrmOAuthConfig(): {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const baseUrl = getAmoCrmBaseUrl();
  const clientId = (process.env.AMOCRM_CLIENT_ID || '').trim();
  const clientSecret = (process.env.AMOCRM_CLIENT_SECRET || '').trim();
  const redirectUri = (process.env.AMOCRM_REDIRECT_URI || '').trim();

  if (!baseUrl || !clientId || !clientSecret || !redirectUri) {
    throw new Error('amoCRM OAuth is not configured');
  }

  return { baseUrl, clientId, clientSecret, redirectUri };
}

export function getAmoCrmNewStatusId(): number {
  return Number(process.env.AMOCRM_NEW_STATUS_ID || '0');
}

export function getAmoCrmResaleStatusId(): number {
  return Number(process.env.AMOCRM_RESALE_STATUS_ID || '0');
}

export function getAmoCrmLowTokenThreshold(): number {
  const raw = process.env.AMOCRM_LOW_TOKEN_THRESHOLD;
  const parsed = raw == null ? NaN : Number(raw);
  if (!Number.isFinite(parsed)) return 10;
  return parsed;
}

export function getAmoCrmLowTokenBatchLimit(): number {
  const raw = process.env.AMOCRM_LOW_TOKEN_BATCH;
  const parsed = raw == null ? NaN : Number(raw);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(500, Math.floor(parsed)));
}

export function buildAmoCrmAuthorizeUrl(state: string): string {
  const { clientId } = getAmoCrmOAuthConfig();

  // Docs: https://www.amocrm.ru/oauth
  const url = new URL('https://www.amocrm.ru/oauth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('state', state);
  url.searchParams.set('mode', 'post_message');
  return url.toString();
}

async function saveTokens(tokens: {
  baseUrl: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  accountId?: number | null;
}) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await ensureAmoCrmSchema(client);

    await client.query(
      `INSERT INTO amocrm_oauth_tokens (base_url, access_token, refresh_token, expires_at, account_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [tokens.baseUrl, tokens.accessToken, tokens.refreshToken, tokens.expiresAt, tokens.accountId ?? null]
    );

    await client.query('COMMIT');
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
}

export async function getLatestTokens(): Promise<
  | {
      baseUrl: string;
      accessToken: string;
      refreshToken: string;
      expiresAt: Date;
      accountId: number | null;
    }
  | null
> {
  const res = await query(
    `SELECT id, base_url, access_token, refresh_token, expires_at, account_id, created_at, updated_at
     FROM amocrm_oauth_tokens
     ORDER BY updated_at DESC
     LIMIT 1`
  ).catch(() => null);

  if (!res || res.rows.length === 0) return null;
  const row = res.rows[0] as AmoTokensRow;

  return {
    baseUrl: row.base_url,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: new Date(row.expires_at),
    accountId: row.account_id,
  };
}

export async function exchangeCodeForTokens(code: string): Promise<void> {
  const { baseUrl, clientId, clientSecret, redirectUri } = getAmoCrmOAuthConfig();

  const resp = await fetch(`${baseUrl}/oauth2/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = (await resp.json().catch(() => null)) as AmoTokenResponse | null;
  if (!resp.ok || !data?.access_token || !data?.refresh_token || !data?.expires_in) {
    throw new Error(`amoCRM token exchange failed (${resp.status})`);
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);
  await saveTokens({
    baseUrl,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  });
}

async function refreshTokens(baseUrl: string, refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const { clientId, clientSecret, redirectUri } = getAmoCrmOAuthConfig();

  const resp = await fetch(`${baseUrl}/oauth2/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      redirect_uri: redirectUri,
    }),
  });

  const data = (await resp.json().catch(() => null)) as AmoTokenResponse | null;
  if (!resp.ok || !data?.access_token || !data?.refresh_token || !data?.expires_in) {
    throw new Error(`amoCRM token refresh failed (${resp.status})`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

async function getValidAccessToken(): Promise<{ baseUrl: string; accessToken: string } | null> {
  const latest = await getLatestTokens();
  if (!latest) return null;

  const now = Date.now();
  const expiresAtMs = latest.expiresAt.getTime();
  const needsRefresh = expiresAtMs - now < 60_000;

  if (!needsRefresh) {
    return { baseUrl: latest.baseUrl, accessToken: latest.accessToken };
  }

  const refreshed = await refreshTokens(latest.baseUrl, latest.refreshToken);
  await saveTokens({
    baseUrl: latest.baseUrl,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresAt: refreshed.expiresAt,
  });

  return { baseUrl: latest.baseUrl, accessToken: refreshed.accessToken };
}

export async function amoFetch<T = unknown>(
  path: string,
  init?: RequestInit & { skipAuth?: boolean }
): Promise<{ status: number; ok: boolean; json: T | null; text: string }>
{
  const access = init?.skipAuth ? null : await getValidAccessToken();
  if (!init?.skipAuth && !access) {
    return { status: 401, ok: false, json: null, text: 'amoCRM is not connected' };
  }

  const baseUrl = access?.baseUrl || getAmoCrmBaseUrl();
  const url = `${normalizeBaseUrl(baseUrl)}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(init?.headers);
  if (!headers.has('content-type') && init?.body) headers.set('content-type', 'application/json');
  if (access) headers.set('authorization', `Bearer ${access.accessToken}`);

  const resp = await fetch(url, {
    ...init,
    headers,
  });

  const text = await resp.text();
  const json = (() => {
    try {
      return text ? (JSON.parse(text) as T) : null;
    } catch {
      return null;
    }
  })();

  return { status: resp.status, ok: resp.ok, json, text };
}

export type AmoComplexLeadPayload = {
  status_id: number;
  name: string;
  price?: number;
  _embedded?: {
    contacts?: Array<{
      name?: string;
      custom_fields_values?: Array<{
        field_code: 'EMAIL' | 'PHONE' | string;
        values: Array<{ value: string; enum_code?: string }>;
      }>;
    }>;
  };
};

export async function createComplexLead(payload: AmoComplexLeadPayload) {
  return amoFetch('/api/v4/leads/complex', {
    method: 'POST',
    body: JSON.stringify([payload]),
  });
}

export async function listPipelines() {
  return amoFetch('/api/v4/leads/pipelines', { method: 'GET' });
}

export async function upsertUserSync(values: {
  userId: string;
  amocrmContactId?: number | null;
  amocrmLeadIdNew?: number | null;
  amocrmLeadIdResale?: number | null;
  newSyncedAt?: Date | null;
  resaleSyncedAt?: Date | null;
  lastTokensRemaining?: number | null;
}) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await ensureAmoCrmSchema(client);

    await client.query(
      `INSERT INTO amocrm_user_sync (
          user_id,
          amocrm_contact_id,
          amocrm_lead_id_new,
          amocrm_lead_id_resale,
          new_synced_at,
          resale_synced_at,
          last_tokens_remaining,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          amocrm_contact_id = COALESCE(EXCLUDED.amocrm_contact_id, amocrm_user_sync.amocrm_contact_id),
          amocrm_lead_id_new = COALESCE(EXCLUDED.amocrm_lead_id_new, amocrm_user_sync.amocrm_lead_id_new),
          amocrm_lead_id_resale = COALESCE(EXCLUDED.amocrm_lead_id_resale, amocrm_user_sync.amocrm_lead_id_resale),
          new_synced_at = COALESCE(EXCLUDED.new_synced_at, amocrm_user_sync.new_synced_at),
          resale_synced_at = COALESCE(EXCLUDED.resale_synced_at, amocrm_user_sync.resale_synced_at),
          last_tokens_remaining = COALESCE(EXCLUDED.last_tokens_remaining, amocrm_user_sync.last_tokens_remaining),
          updated_at = NOW()`,
      [
        values.userId,
        values.amocrmContactId ?? null,
        values.amocrmLeadIdNew ?? null,
        values.amocrmLeadIdResale ?? null,
        values.newSyncedAt ?? null,
        values.resaleSyncedAt ?? null,
        values.lastTokensRemaining ?? null,
      ]
    );

    await client.query('COMMIT');
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
}

export async function getUserSync(userId: string): Promise<{
  user_id: string;
  amocrm_contact_id: number | null;
  amocrm_lead_id_new: number | null;
  amocrm_lead_id_resale: number | null;
  new_synced_at: string | null;
  resale_synced_at: string | null;
  last_tokens_remaining: string | null;
} | null> {
  const res = await query(
    `SELECT user_id, amocrm_contact_id, amocrm_lead_id_new, amocrm_lead_id_resale, new_synced_at, resale_synced_at, last_tokens_remaining
     FROM amocrm_user_sync
     WHERE user_id = $1`,
    [userId]
  ).catch(() => null);

  if (!res || res.rows.length === 0) return null;
  return res.rows[0];
}
