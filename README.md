# Umari AI - AI Marketplace Platform

## 🚀 Features

- **Admin Panel** - Complete user management
- **Subscription System** - Flexible pricing plans
- **Token System** - 5 free tokens for new users
- **Authentication** - Email/Password + Google OAuth
- **JWT + Secure Cookies** - Secure authentication
- **Role-Based Access** - Admin vs User roles
- **Database** - PostgreSQL with migrations
- **Docker** - Dev and production configurations
- **Security Hardened** - Protected routes, secure headers

## 📋 Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 16
- Google OAuth credentials
- Telegram Bot Token (optional)

## 🔧 Setup

### 1. Clone & Install

```bash
git clone <repo>
cd <project-folder>
cp .env.example .env.local
npm install
```

### 2. Configure .env.local

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_NAME=umari_ai

# JWT
JWT_SECRET=your_super_secret_jwt_key

# Gemini (Generative Language API)
# Get API key: https://aistudio.google.com/apikey
GEMINI_API_KEY=your_gemini_api_key

# Node Environment
NODE_ENV=development
```

### 3. Run with Docker (Dev)

```bash
npm run docker:dev
```

This starts:
- Next.js app (`nextjs`)
- Postgres (`postgres`)
- Image queue worker (`image_worker`) for async image generation

### 4. Production

```bash
npm run docker:prod
```

## 🔐 Security Features

✅ JWT tokens in secure HTTP-only cookies
✅ Admin role verification
✅ Subscription status checks  
✅ Ports bound to localhost only
✅ Isolated Docker networks
✅ Security headers
✅ Parameterized SQL queries

## 📚 API Routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/admin/users` (admin only)
- `GET /api/subscriptions/plans`
- `POST /api/subscriptions` (subscribe)

## ⏰ Cron (Obuna tugashini tekshirish)

Obuna muddati tugagan userlarni avtomatik `expired` qilish uchun endpoint bor:

- `GET /api/cron/subscriptions`

Bu endpoint **majburiy** `CRON_SECRET` bilan himoyalangan.

1) `.env` (production) ga qo'shing:

```env
CRON_SECRET=your_long_random_secret
```

2) Cronjobs saytingizda (cron-job.org / EasyCron / boshqalar) quyidagini chaqiring:

- URL: `https://umaristudio.uz/api/cron/subscriptions?secret=CRON_SECRET`
- Method: `GET`

Muqobil variant (query o'rniga header):

- Header: `Authorization: Bearer CRON_SECRET`

Javobda nechta user/subscription `expired` bo'lganini qaytaradi.

## 🤝 amoCRM (OAuth + lead sync)

Admin panelda: `/admin/amocrm` (Auth • Setup • Debug)

`.env.local` yoki production env ga qo'shing:

```env
AMOCRM_ENABLED=true

# Variant A: to'liq base URL
AMOCRM_BASE_URL=https://YOUR_SUBDOMAIN.amocrm.ru

# yoki Variant B: subdomain + domain
# AMOCRM_SUBDOMAIN=YOUR_SUBDOMAIN
# AMOCRM_DOMAIN=amocrm.ru

AMOCRM_CLIENT_ID=...
AMOCRM_CLIENT_SECRET=...
AMOCRM_REDIRECT_URI=https://YOUR_APP_DOMAIN/api/admin/amocrm/oauth/callback

# Pipeline va stage sozlamalari
# Agar siz leadlar ANIQ bir pipeline’ga tushsin desangiz (masalan pipeline ID: 10567594),
# pipeline ID + stage nomini berishingiz mumkin.
# Kod o‘sha pipeline ichidan stage nomi bo‘yicha `status_id`ni avtomatik topib, lead yaratadi.

# Yangi userlar uchun
AMOCRM_NEW_PIPELINE_ID=10567594
AMOCRM_NEW_STAGE_NAME=Yangi mijoz (AI)

# Low-token (qayta sotuv) uchun
AMOCRM_RESALE_PIPELINE_ID=10567594
AMOCRM_RESALE_STAGE_NAME=Qayta sotuv

# Ixtiyoriy: agar status_id ni oldindan bilsangiz, to‘g‘ridan-to‘g‘ri qo‘ysangiz ham bo‘ladi
# (bunda pipeline/stage name qidiruvi ishlatilmaydi):
# AMOCRM_NEW_STATUS_ID=123
# AMOCRM_RESALE_STATUS_ID=456

# Low-token trigger
AMOCRM_LOW_TOKEN_THRESHOLD=10
AMOCRM_LOW_TOKEN_BATCH=50
```

Eslatma (local/dev):

- `AMOCRM_REDIRECT_URI` amoCRM integratsiyadagi redirect URI bilan **1:1** (harfma-harf) mos bo'lishi shart.
- Agar siz localda ishlayotgan bo'lsangiz, odatda admin sahifa `http://localhost:3000/admin/amocrm` bo'ladi.
   - Local callback: `http://localhost:3000/api/admin/amocrm/oauth/callback`
   - Ammo amoCRM serverlari `localhost`ga kira olmaydi. Shu sabab dev test uchun ko'pincha `ngrok/cloudflared` kabi tunnel kerak bo'ladi yoki bevosita production domenni ishlatasiz.
- Brauzerda `d9d1b21bf035:3000` kabi container ID host ochilmaydi (DNS topolmaydi). Tashqaridan kirish uchun `localhost:3000` (yoki tunnel domeni) dan foydalaning.

Low-token cron endpoint:

- `GET /api/cron/amocrm-low-tokens` (CRON_SECRET bilan)

Misol:

- `https://YOUR_DOMAIN/api/cron/amocrm-low-tokens?secret=CRON_SECRET`

## 🎯 Protected Routes

```
/admin/*              - Admin only (role check)
/dashboard/*          - Authenticated users
/pricing              - Public
/api/admin/*          - Admin + subscription check
```

## 📄 License

Proprietary - Umari AI

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
4. In a separate terminal, run the image worker (required for queued image generation):
   `npm run worker:image`
