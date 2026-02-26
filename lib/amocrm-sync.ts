import { query } from '@/lib/db';
import {
  createComplexLead,
  findContactIdByEmail,
  resolveAmoCrmContactTelegramUsernameFieldId,
  getAmoCrmLowTokenThreshold,
  getAmoCrmNewPipelineId,
  getAmoCrmNewStageName,
  getAmoCrmNewStatusId,
  getAmoCrmResalePipelineId,
  getAmoCrmResaleStageName,
  getAmoCrmResaleStatusId,
  getLatestTokens,
  getUserSync,
  isAmoCrmEnabled,
  resolveStatusIdByPipelineAndStageName,
  upsertUserSync,
} from '@/lib/amocrm';

function pickId(value: any): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildContactName(user: {
  first_name: string | null;
  last_name: string | null;
  email: string;
}) {
  const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  return full || user.email;
}

function buildLeadName(prefix: string, user: { first_name: string | null; last_name: string | null; email: string }) {
  const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  return `${prefix}: ${full || user.email}`;
}

async function canSync(): Promise<boolean> {
  if (!isAmoCrmEnabled()) return false;
  const connected = await getLatestTokens();
  return Boolean(connected?.accessToken);
}

export async function syncNewUserToAmoCrm(userId: string): Promise<{ ok: boolean; reason?: string }>
{
  try {
    if (!(await canSync())) return { ok: false, reason: 'not_configured_or_connected' };

    const explicitStatusId = getAmoCrmNewStatusId();
    const statusId = explicitStatusId ||
      (await resolveStatusIdByPipelineAndStageName({
        pipelineId: getAmoCrmNewPipelineId(),
        stageName: getAmoCrmNewStageName(),
      }));
    if (!statusId) return { ok: false, reason: 'missing_new_status_or_pipeline_stage' };

    const existing = await getUserSync(userId);
    if (existing?.new_synced_at) return { ok: true, reason: 'already_synced' };

    const userRes = await query(
      `SELECT id, email, first_name, last_name, phone, telegram_username, tokens_remaining
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) return { ok: false, reason: 'user_not_found' };

    const user = userRes.rows[0] as {
      id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      phone: string | null;
      telegram_username: string | null;
      tokens_remaining: string | number | null;
    };

    const contactFields: Array<{
      field_code?: string;
      field_id?: number;
      values: Array<{ value: string; enum_code?: string }>;
    }> = [
      {
        field_code: 'EMAIL',
        values: [{ value: user.email, enum_code: 'WORK' }],
      },
    ];

    if (user.phone) {
      contactFields.push({ field_code: 'PHONE', values: [{ value: user.phone, enum_code: 'WORK' }] });
    }

    const tgFieldId = await resolveAmoCrmContactTelegramUsernameFieldId();
    if (user.telegram_username && tgFieldId && tgFieldId > 0) {
      contactFields.push({ field_id: tgFieldId, values: [{ value: user.telegram_username }] });
    }

    const leadPayload = {
      status_id: statusId,
      name: buildLeadName('Yangi mijoz (AI)', user),
      _embedded: {
        contacts: [
          {
            name: buildContactName(user),
            custom_fields_values: contactFields,
          },
        ],
      },
    };

    const resp = await createComplexLead(leadPayload);
    if (!resp.ok) return { ok: false, reason: `amo_error_${resp.status}` };

    const lead = Array.isArray(resp.json) ? (resp.json[0] as any) : null;
    const leadId = pickId(lead?.id);
    let contactId = pickId(lead?._embedded?.contacts?.[0]?.id);
    if (!contactId) {
      contactId = await findContactIdByEmail(user.email);
    }

    await upsertUserSync({
      userId,
      amocrmContactId: contactId,
      amocrmLeadIdNew: leadId,
      newSyncedAt: new Date(),
      lastTokensRemaining: user.tokens_remaining == null ? null : Number(user.tokens_remaining),
    });

    return { ok: true };
  } catch (err) {
    console.warn('amoCRM syncNewUser failed:', err);
    return { ok: false, reason: 'exception' };
  }
}

export async function syncLowTokenUserToAmoCrm(userId: string): Promise<{ ok: boolean; reason?: string }>
{
  try {
    if (!(await canSync())) return { ok: false, reason: 'not_configured_or_connected' };

    const explicitStatusId = getAmoCrmResaleStatusId();
    const statusId = explicitStatusId ||
      (await resolveStatusIdByPipelineAndStageName({
        pipelineId: getAmoCrmResalePipelineId(),
        stageName: getAmoCrmResaleStageName(),
      }));
    if (!statusId) return { ok: false, reason: 'missing_resale_status_or_pipeline_stage' };

    const threshold = getAmoCrmLowTokenThreshold();

    const userRes = await query(
      `SELECT id, email, first_name, last_name, phone, telegram_username, tokens_remaining, subscription_status, subscription_plan
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) return { ok: false, reason: 'user_not_found' };

    const user = userRes.rows[0] as {
      id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      phone: string | null;
      telegram_username: string | null;
      tokens_remaining: string | number | null;
      subscription_status: string | null;
      subscription_plan: string | null;
    };

    const status = String(user.subscription_status || '').toLowerCase();
    const plan = String(user.subscription_plan || 'free').toLowerCase();
    if (status !== 'active' || plan === 'free') {
      return { ok: true, reason: 'not_active_subscription' };
    }

    const tokensRemaining = user.tokens_remaining == null ? 0 : Number(user.tokens_remaining);
    if (Number.isFinite(tokensRemaining) && tokensRemaining >= threshold) {
      return { ok: true, reason: 'not_low_token_anymore' };
    }

    const existing = await getUserSync(userId);
    if (existing?.resale_synced_at && existing?.last_tokens_remaining != null) {
      const last = Number(existing.last_tokens_remaining);
      if (Number.isFinite(last) && last <= threshold) {
        return { ok: true, reason: 'already_synced' };
      }
    }

    const contactFields: Array<{
      field_code?: string;
      field_id?: number;
      values: Array<{ value: string; enum_code?: string }>;
    }> = [
      {
        field_code: 'EMAIL',
        values: [{ value: user.email, enum_code: 'WORK' }],
      },
    ];

    if (user.phone) {
      contactFields.push({ field_code: 'PHONE', values: [{ value: user.phone, enum_code: 'WORK' }] });
    }

    const tgFieldId = await resolveAmoCrmContactTelegramUsernameFieldId();
    if (user.telegram_username && tgFieldId && tgFieldId > 0) {
      contactFields.push({ field_id: tgFieldId, values: [{ value: user.telegram_username }] });
    }

    const leadPayload = {
      status_id: statusId,
      name: buildLeadName('Qayta sotuv', user),
      _embedded: {
        contacts: [
          {
            name: buildContactName(user),
            custom_fields_values: contactFields,
          },
        ],
      },
    };

    const resp = await createComplexLead(leadPayload);
    if (!resp.ok) return { ok: false, reason: `amo_error_${resp.status}` };

    const lead = Array.isArray(resp.json) ? (resp.json[0] as any) : null;
    const leadId = pickId(lead?.id);
    let contactId = pickId(lead?._embedded?.contacts?.[0]?.id);
    if (!contactId) {
      contactId = await findContactIdByEmail(user.email);
    }

    await upsertUserSync({
      userId,
      amocrmContactId: contactId,
      amocrmLeadIdResale: leadId,
      resaleSyncedAt: new Date(),
      lastTokensRemaining: tokensRemaining,
    });

    return { ok: true };
  } catch (err) {
    console.warn('amoCRM syncLowTokenUser failed:', err);
    return { ok: false, reason: 'exception' };
  }
}
