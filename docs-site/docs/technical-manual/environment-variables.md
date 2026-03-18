---
sidebar_position: 5
title: "Environment Variables"
description: "Complete reference of all environment variables used by the Intellicon CRM backend and frontend"
---

# Environment Variables

All environment variables are loaded from a `.env` file at the project root. Never commit this file to version control.

## Database Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_HOST` | Yes | `localhost` | PostgreSQL server hostname |
| `DB_PORT` | Yes | `5432` | PostgreSQL server port |
| `DB_NAME` | Yes | `intellicon_crm` | Database name |
| `DB_USER` | Yes | `postgres` | Database username |
| `DB_PASS` | Yes | — | Database password |
| `DB_SSL` | No | `false` | Enable SSL for database connections |
| `DB_POOL_SIZE` | No | `10` | Maximum connection pool size |

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=intellicon_crm
DB_USER=postgres
DB_PASS=your_secure_password
DB_SSL=false
DB_POOL_SIZE=10
```

:::warning Production
In production, always use SSL (`DB_SSL=true`) and a strong password. Never use the `postgres` superuser — create a dedicated application user with limited privileges.
:::

## JWT Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | — | Secret key for signing JWT tokens |
| `JWT_EXPIRY` | No | `1h` | Access token expiration duration |
| `REFRESH_TOKEN_EXPIRY` | No | `7d` | Refresh token expiration duration |

```env
JWT_SECRET=change-this-to-a-long-random-string-in-production
JWT_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d
```

:::danger
The `JWT_SECRET` must be a strong, random string in production (minimum 64 characters). A compromised JWT secret allows forging authentication tokens for any user/tenant.
:::

## Redis Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_HOST` | Yes | `localhost` | Redis server hostname |
| `REDIS_PORT` | Yes | `6379` | Redis server port |
| `REDIS_PASSWORD` | No | — | Redis password (if AUTH is enabled) |
| `REDIS_DB` | No | `0` | Redis database number |

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## Application Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | API server port |
| `NODE_ENV` | No | `development` | Environment: development, staging, production |
| `FRONTEND_URL` | Yes | `http://localhost:5173` | Frontend URL (used for CORS and email links) |
| `API_URL` | No | `http://localhost:3000` | API URL (used in email templates) |
| `CORS_ORIGINS` | No | `FRONTEND_URL` | Comma-separated list of allowed CORS origins |

```env
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
API_URL=http://localhost:3000
```

## Email / SMTP Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP_HOST` | No | — | SMTP server hostname |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASS` | No | — | SMTP password |
| `SMTP_FROM` | No | — | Default "From" email address |
| `SMTP_FROM_NAME` | No | `Intellicon CRM` | Default "From" display name |
| `SMTP_SECURE` | No | `false` | Use TLS for SMTP connection |

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=notifications@example.com
SMTP_PASS=smtp_password
SMTP_FROM=notifications@example.com
SMTP_FROM_NAME=Intellicon CRM
SMTP_SECURE=false
```

:::info Development
For local development, you can use [Mailtrap](https://mailtrap.io/) or [Mailhog](https://github.com/mailhog/MailHog) to capture outgoing emails without sending them.
:::

## File Upload Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `UPLOAD_DIR` | No | `./uploads` | Local directory for file uploads |
| `MAX_FILE_SIZE` | No | `10485760` | Maximum file size in bytes (10MB) |
| `ALLOWED_FILE_TYPES` | No | `jpg,jpeg,png,gif,pdf,doc,docx,xls,xlsx,csv` | Allowed upload extensions |

```env
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

## Third-Party API Keys

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth client ID (calendar sync) |
| `GOOGLE_CLIENT_SECRET` | No | — | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | No | — | Google OAuth redirect URI |
| `XERO_CLIENT_ID` | No | — | Xero accounting integration |
| `XERO_CLIENT_SECRET` | No | — | Xero client secret |
| `TWILIO_ACCOUNT_SID` | No | — | Twilio SMS/voice account SID |
| `TWILIO_AUTH_TOKEN` | No | — | Twilio authentication token |
| `TWILIO_FROM_NUMBER` | No | — | Twilio sender phone number |

```env
# Google Calendar Sync
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/calendar-sync/callback

# Xero (optional)
XERO_CLIENT_ID=
XERO_CLIENT_SECRET=

# Twilio (optional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

## Web Push Notifications

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VAPID_PUBLIC_KEY` | No | — | VAPID public key for push notifications |
| `VAPID_PRIVATE_KEY` | No | — | VAPID private key |
| `VAPID_SUBJECT` | No | — | VAPID subject (mailto: URL) |

```env
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com
```

:::tip Generating VAPID Keys
Use the admin endpoint `POST /notifications/admin/generate-vapid` or the `web-push` CLI:
```bash
npx web-push generate-vapid-keys
```
:::

## Frontend Environment Variables

Frontend variables must be prefixed with `VITE_` to be accessible in the browser.

Create `apps/web/.env`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | Yes | `http://localhost:3000` | Backend API base URL |
| `VITE_APP_NAME` | No | `Intellicon CRM` | Application display name |
| `VITE_VAPID_PUBLIC_KEY` | No | — | VAPID public key for push subscriptions |

```env
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=Intellicon CRM
VITE_VAPID_PUBLIC_KEY=
```

## Environment-Specific Configurations

### Development
```env
NODE_ENV=development
DB_HOST=localhost
FRONTEND_URL=http://localhost:5173
JWT_EXPIRY=24h              # Longer expiry for convenience
```

### Staging
```env
NODE_ENV=staging
DB_HOST=staging-db.internal
DB_SSL=true
FRONTEND_URL=https://staging.intellicon.app
JWT_EXPIRY=1h
```

### Production
```env
NODE_ENV=production
DB_HOST=prod-db.internal
DB_SSL=true
DB_POOL_SIZE=25
FRONTEND_URL=https://app.intellicon.com
JWT_SECRET=<64+ character random string>
JWT_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d
SMTP_SECURE=true
```

:::danger Production Checklist
Before deploying to production, verify:
- [ ] `JWT_SECRET` is a strong random string (64+ chars)
- [ ] `DB_PASS` is not the default password
- [ ] `DB_SSL=true` is set
- [ ] `NODE_ENV=production`
- [ ] SMTP credentials are configured
- [ ] CORS origins are restricted to production domains
- [ ] All third-party API keys are production keys
:::
