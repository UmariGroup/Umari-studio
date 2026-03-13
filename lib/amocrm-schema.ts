import type { PoolClient } from 'pg';

export async function ensureAmoCrmSchema(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS amocrm_oauth_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      base_url TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      account_id BIGINT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_amocrm_oauth_tokens_updated ON amocrm_oauth_tokens(updated_at DESC);`
  );

  await client.query(`
    CREATE TABLE IF NOT EXISTS amocrm_user_sync (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      amocrm_contact_id BIGINT,
      amocrm_lead_id_new BIGINT,
      amocrm_lead_id_resale BIGINT,
      new_synced_at TIMESTAMP,
      resale_synced_at TIMESTAMP,
      last_tokens_remaining NUMERIC(10, 2),
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_amocrm_user_sync_updated ON amocrm_user_sync(updated_at DESC);`
  );
}
