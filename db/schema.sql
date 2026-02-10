-- Users table
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url VARCHAR(500),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  subscription_status VARCHAR(50) DEFAULT 'free' CHECK (subscription_status IN ('free', 'active', 'expired')),
  subscription_plan VARCHAR(50) DEFAULT 'free' CHECK (subscription_plan IN ('free', 'starter', 'pro', 'business_plus')),
  subscription_expires_at TIMESTAMP,
  phone TEXT,
  telegram_username TEXT,
  referral_code TEXT,
  referred_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  referred_at TIMESTAMP,
  tokens_remaining NUMERIC(10, 2) DEFAULT 0,
  google_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code_unique
  ON users (referral_code)
  WHERE referral_code IS NOT NULL;

-- Subscription plans table
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  duration_months INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  tokens_included INT NOT NULL,
  features JSONB,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User subscriptions history table
CREATE TABLE subscriptions_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  price_paid DECIMAL(10, 2),
  tokens_allocated INT,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Referral rewards: award once per referred user
CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan VARCHAR(50) NOT NULL CHECK (plan IN ('starter', 'pro', 'business_plus')),
  tokens_awarded NUMERIC(10, 2) NOT NULL CHECK (tokens_awarded > 0),
  tokens_remaining NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (tokens_remaining >= 0),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_user_id);

-- Token usage tracking
CREATE TABLE token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tokens_used NUMERIC(10, 2) NOT NULL,
  service_type VARCHAR(100) NOT NULL,
  model_used VARCHAR(100),
  prompt TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin logs
CREATE TABLE admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  changes JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pricing plans metadata
CREATE TABLE pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name VARCHAR(100) NOT NULL,
  monthly_price DECIMAL(10, 2),
  quarterly_price DECIMAL(10, 2),
  semi_annual_price DECIMAL(10, 2),
  annual_price DECIMAL(10, 2),
  tokens_included INT NOT NULL,
  features JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Telegram admin chat tracking
CREATE TABLE telegram_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  telegram_chat_id VARCHAR(255) UNIQUE NOT NULL,
  telegram_username VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_subscriptions_user ON subscriptions_history(user_id);
CREATE INDEX idx_token_usage_user ON token_usage(user_id);
CREATE INDEX idx_admin_logs_admin ON admin_logs(admin_id);
CREATE INDEX idx_admin_logs_target ON admin_logs(target_user_id);

-- ============================================================
-- Image generation queue (DB-backed, persistent)
-- ============================================================

CREATE TABLE IF NOT EXISTS image_jobs (
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
);

CREATE INDEX IF NOT EXISTS idx_image_jobs_user_created ON image_jobs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_image_jobs_batch ON image_jobs(batch_id, batch_index);
CREATE INDEX IF NOT EXISTS idx_image_jobs_queue ON image_jobs(plan, status, priority, created_at);

