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

export function getAmoCrmNewPipelineId(): number {
  return Number(process.env.AMOCRM_NEW_PIPELINE_ID || '0');
}

export function getAmoCrmNewStageName(): string {
  return String(process.env.AMOCRM_NEW_STAGE_NAME || 'Yangi mijoz (AI)').trim();
}

export function getAmoCrmResaleStatusId(): number {
  return Number(process.env.AMOCRM_RESALE_STATUS_ID || '0');
}

export function getAmoCrmResalePipelineId(): number {
  return Number(process.env.AMOCRM_RESALE_PIPELINE_ID || '0');
}

export function getAmoCrmResaleStageName(): string {
  return String(process.env.AMOCRM_RESALE_STAGE_NAME || 'Qayta sotuv').trim();
}

export function getAmoCrmContactTelegramUsernameFieldId(): number {
  // Optional: amoCRM contact custom field id to store Telegram username.
  // Create a custom field in amoCRM Contacts (e.g. "Telegram username"), then set its numeric ID here.
  return Number(process.env.AMOCRM_CONTACT_TELEGRAM_USERNAME_FIELD_ID || '0');
}

let cachedTelegramUsernameFieldId: number | null = null;

export async function resolveAmoCrmContactTelegramUsernameFieldId(): Promise<number | null> {
  const explicit = getAmoCrmContactTelegramUsernameFieldId();
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  if (cachedTelegramUsernameFieldId !== null) {
    return cachedTelegramUsernameFieldId > 0 ? cachedTelegramUsernameFieldId : null;
  }

  const resp = await amoFetch<any>('/api/v4/contacts/custom_fields', { method: 'GET' });
  if (!resp.ok || !resp.json) {
    cachedTelegramUsernameFieldId = 0;
    return null;
  }

  const fields = resp.json?._embedded?.custom_fields;
  if (!Array.isArray(fields) || fields.length === 0) {
    cachedTelegramUsernameFieldId = 0;
    return null;
  }

  const matches = fields
    .map((f: any) => ({
      id: Number(f?.id || 0),
      name: String(f?.name || '').trim(),
    }))
    .filter((f: any) => Number.isFinite(f.id) && f.id > 0 && f.name)
    .filter((f: any) => {
      const n = f.name.toLowerCase();
      const hasTelegram = n.includes('telegram') || n.includes('телеграм');
      const hasUsername = n.includes('username') || n.includes('user name') || n.includes('юзер') || n.includes('имя пользователя');
      return hasTelegram && hasUsername;
    });

  // Avoid guessing if multiple fields match.
  if (matches.length === 1) {
    cachedTelegramUsernameFieldId = matches[0].id;
    return matches[0].id;
  }

  cachedTelegramUsernameFieldId = 0;
  return null;
}

export function getAmoCrmLowTokenThreshold(): number {
  const raw = process.env.AMOCRM_LOW_TOKEN_THRESHOLD;
  const parsed = raw == null ? NaN : Number(raw);
  if (!Number.isFinite(parsed)) return 30;
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

let refreshInFlight: Promise<{ baseUrl: string; accessToken: string } | null> | null = null;

async function forceRefreshAccessToken(): Promise<{ baseUrl: string; accessToken: string } | null> {
  const latest = await getLatestTokens();
  if (!latest) return null;

  const refreshed = await refreshTokens(latest.baseUrl, latest.refreshToken);
  await saveTokens({
    baseUrl: latest.baseUrl,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresAt: refreshed.expiresAt,
  });

  return { baseUrl: latest.baseUrl, accessToken: refreshed.accessToken };
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

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        return await forceRefreshAccessToken();
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return await refreshInFlight;
}

export async function amoFetch<T = unknown>(
  path: string,
  init?: RequestInit & { skipAuth?: boolean }
): Promise<{ status: number; ok: boolean; json: T | null; text: string }>
{
  const makeUrl = (baseUrl: string) =>
    `${normalizeBaseUrl(baseUrl)}${path.startsWith('/') ? path : `/${path}`}`;

  const doRequest = async (accessToken: string | null, baseUrl: string) => {
    const url = makeUrl(baseUrl);
    const headers = new Headers(init?.headers);
    if (!headers.has('content-type') && init?.body) headers.set('content-type', 'application/json');
    if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);

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
  };

  if (init?.skipAuth) {
    const baseUrl = getAmoCrmBaseUrl();
    return doRequest(null, baseUrl);
  }

  const access = await getValidAccessToken();
  if (!access) {
    return { status: 401, ok: false, json: null, text: 'amoCRM is not connected' };
  }

  const first = await doRequest(access.accessToken, access.baseUrl);
  if (first.status !== 401) return first;

  // Token might be revoked/invalidated before expiry; force refresh once and retry.
  try {
    const refreshed = refreshInFlight ? await refreshInFlight : await forceRefreshAccessToken();
    if (!refreshed) return first;
    return await doRequest(refreshed.accessToken, refreshed.baseUrl);
  } catch {
    return first;
  }
}

export type AmoComplexLeadPayload = {
  status_id: number;
  name: string;
  price?: number;
  _embedded?: {
    contacts?: Array<{
      name?: string;
      custom_fields_values?: Array<{
        field_code?: 'EMAIL' | 'PHONE' | string;
        field_id?: number;
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

export async function listContactCustomFields() {
  return amoFetch('/api/v4/contacts/custom_fields', { method: 'GET' });
}

export async function listPipelineStatuses(pipelineId: number) {
  return amoFetch(`/api/v4/leads/pipelines/${pipelineId}/statuses`, { method: 'GET' });
}

export type AmoContactUpdatePayload = {
  name?: string;
  custom_fields_values?: Array<{
    field_code?: 'EMAIL' | 'PHONE' | string;
    field_id?: number;
    values: Array<{ value: string; enum_code?: string }>;
  }>;
};

function normalizeEmail(input: string): string {
  return String(input || '').trim().toLowerCase();
}

function extractEmailValues(contact: any): string[] {
  const cfs = contact?.custom_fields_values;
  if (!Array.isArray(cfs)) return [];
  const emailField = cfs.find((f: any) => String(f?.field_code || '').toUpperCase() === 'EMAIL');
  const values = emailField?.values;
  if (!Array.isArray(values)) return [];
  return values.map((v: any) => String(v?.value || '')).filter(Boolean);
}

export async function findContactIdByEmail(email: string): Promise<number | null> {
  const needle = normalizeEmail(email);
  if (!needle) return null;

  const resp = await amoFetch<any>(`/api/v4/contacts?query=${encodeURIComponent(email)}`, { method: 'GET' });
  if (!resp.ok || !resp.json) return null;

  const contacts = resp.json?._embedded?.contacts;
  if (!Array.isArray(contacts) || contacts.length === 0) return null;

  const exact = contacts.find((c: any) =>
    extractEmailValues(c).some((e) => normalizeEmail(e) === needle)
  );
  const picked = exact || contacts[0];
  const id = Number(picked?.id || 0);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function updateContact(contactId: number, payload: AmoContactUpdatePayload) {
  const id = Number(contactId || 0);
  if (!Number.isFinite(id) || id <= 0) {
    return { status: 400, ok: false, json: null as any, text: 'invalid_contact_id' };
  }

  return amoFetch(`/api/v4/contacts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

function extractStatuses(payload: any): Array<{ id: number; name: string }> {
  const statuses = payload?._embedded?.statuses;
  if (!Array.isArray(statuses)) return [];
  return statuses
    .map((s: any) => ({ id: Number(s?.id || 0), name: String(s?.name || '').trim() }))
    .filter((s: any) => Number.isFinite(s.id) && s.id > 0 && s.name);
}

export async function resolveStatusIdByPipelineAndStageName(opts: {
  pipelineId: number;
  stageName: string;
}): Promise<number | null> {
  const pipelineId = Number(opts.pipelineId || 0);
  const stageName = String(opts.stageName || '').trim();
  if (!pipelineId || !stageName) return null;

  const resp = await listPipelineStatuses(pipelineId);
  if (!resp.ok || !resp.json) return null;

  const statuses = extractStatuses(resp.json);

  const exact = statuses.find((s) => s.name === stageName);
  if (exact) return exact.id;

  const lower = stageName.toLowerCase();
  const ci = statuses.find((s) => s.name.toLowerCase() === lower);
  return ci ? ci.id : null;
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
