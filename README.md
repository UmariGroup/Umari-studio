# Umari Studio - AI Marketplace Platform

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
cd umari-studio
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
DB_NAME=umari_studio

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

## 🎯 Protected Routes

```
/admin/*              - Admin only (role check)
/dashboard/*          - Authenticated users
/pricing              - Public
/api/admin/*          - Admin + subscription check
```

## 📄 License

Proprietary - Umari Studio

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
