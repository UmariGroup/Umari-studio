-- Seed data for development

-- Insert default subscription plans
INSERT INTO subscription_plans (name, duration_months, price, tokens_included, features, description)
VALUES 
  (
    'Starter',
    1,
    9.00,
    140,
    '["140 token/oy", "Image: Basic+Pro", "Video: Veo 3 Fast", "Copywriter: 18 blok (qisqa)"]',
    'Tez va arzon boshlash uchun'
  ),
  (
    'Pro',
    1,
    19.00,
    350,
    '["400 token/oy", "Pro image + pro video", "Marketplace/katalog uchun"]',
    'Marketplace va reklama uchun'
  ),
  (
    'Business+',
    1,
    29.00,
    600,
    '["600 token/oy", "Eng kuchli image rejim", "Ko\u02bbb video va rakurs"]',
    'Agency / SMM / katalog uchun'
  )
ON CONFLICT DO NOTHING;

-- Insert test user (admin@umari.com with hashed password)
-- Password: Admin@123 (hashed with bcrypt 12 rounds)
-- Hash: $2a$12$6UymcXfYo/R2Q62bKHFvqejS.It7eQNjDQiIPrmHIYUQv8dPglcMm
INSERT INTO users (email, password_hash, first_name, last_name, role, subscription_status, subscription_plan, tokens_remaining)
VALUES 
  (
    'admin@umari.com',
    '$2a$12$6UymcXfYo/R2Q62bKHFvqejS.It7eQNjDQiIPrmHIYUQv8dPglcMm',
    'Admin',
    'User',
    'admin',
    'active',
    'business_plus',
    999999
  ),
  (
    'test@umari.com',
    '$2a$12$6UymcXfYo/R2Q62bKHFvqejS.It7eQNjDQiIPrmHIYUQv8dPglcMm',
    'Test',
    'User',
    'user',
    'free',
    'free',
    0
  )
ON CONFLICT DO NOTHING;

-- Insert pricing tiers for admin panel
INSERT INTO pricing_tiers (tier_name, monthly_price, tokens_included, features, is_active)
VALUES
  ('Starter', 9.00, 150, '{"description": "Tez va arzon boshlash uchun", "features": ["150 token/oy", "Basic+Pro image", "Veo 2.0 video"]}', true),
  ('Pro', 19.00, 400, '{"description": "Marketplace va reklama uchun", "features": ["400 token/oy", "Pro image", "Pro video"]}', true),
  ('Business+', 29.00, 700, '{"description": "Agency / SMM / katalog uchun", "features": ["700 token/oy", "Premium video", "Ko\u02bbp rakurs"]}', true)
ON CONFLICT DO NOTHING;
