---
sidebar_position: 4
title: "Local Development Setup"
description: "Step-by-step guide to setting up the Intellicon CRM development environment"
---

# Local Development Setup

This guide walks through setting up Intellicon CRM for local development.

## Prerequisites

Ensure the following are installed:

| Software | Minimum Version | Purpose |
|----------|----------------|---------|
| **Node.js** | 18.x LTS | JavaScript runtime |
| **npm** | 9.x | Package manager |
| **PostgreSQL** | 14+ | Primary database |
| **Redis** | 6+ | Queue and caching |
| **Git** | 2.x | Version control |

:::tip Windows Users
Use [WSL2](https://docs.microsoft.com/en-us/windows/wsl/) or install PostgreSQL and Redis natively. WAMP/XAMPP do not include PostgreSQL — install it separately.
:::

## Clone the Repository

```bash
git clone <repository-url> intellicon-crm
cd intellicon-crm
```

## Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your local configuration:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=intellicon_crm
DB_USER=postgres
DB_PASS=your_password

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Application
PORT=3000
FRONTEND_URL=http://localhost:5173
```

:::warning
Never commit the `.env` file. It is listed in `.gitignore`. See [Environment Variables](./environment-variables.md) for the complete list.
:::

## Install Dependencies

```bash
# Install root workspace dependencies
npm install

# Install backend dependencies
cd apps/api && npm install

# Install frontend dependencies
cd ../web && npm install
```

## Database Setup

### 1. Create the Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create the database
CREATE DATABASE intellicon_crm;
\q
```

### 2. Run Migrations

The migration script creates all necessary tables in tenant schemas:

```bash
cd apps/api
npx ts-node src/scripts/run-tenant-migrations.ts
```

:::info First Run
On the first run, the migration script will:
1. Create the `public.tenants` table if it doesn't exist
2. Create the `public.schema_migrations` tracking table
3. Iterate through all existing tenant schemas and apply pending migrations
:::

## Starting the Application

### Backend (Port 3000)

```bash
cd apps/api
npm run start:dev
```

The API will be available at `http://localhost:3000`. Swagger documentation is available at `http://localhost:3000/api`.

### Frontend (Port 5173)

```bash
cd apps/web
npm run dev
```

The frontend will be available at `http://localhost:5173`.

## Verifying the Setup

### 1. Backend Health Check

```bash
curl http://localhost:3000/health
# Expected: { "status": "ok" }
```

### 2. Swagger Documentation

Open `http://localhost:3000/api` in your browser. You should see the Swagger UI with all available endpoints.

### 3. Frontend

Open `http://localhost:5173` in your browser. You should see the login page.

### 4. Register a Test Tenant

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "Test123!@#",
    "companyName": "Test Company",
    "firstName": "Admin",
    "lastName": "User"
  }'
```

This will create a tenant schema, seed default data, and return authentication tokens.

## Common Setup Issues

### PostgreSQL Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:** Ensure PostgreSQL is running:
```bash
# Linux/macOS
sudo systemctl start postgresql

# Windows
net start postgresql-x64-14
```

### Redis Connection Failed

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:** Ensure Redis is running:
```bash
# Linux/macOS
sudo systemctl start redis

# Windows (if using WSL)
sudo service redis-server start
```

:::tip Redis Alternative
If Redis is not required for your development task (e.g., you are not working on imports/queues), the application will still start but Bull queues will be unavailable.
:::

### Migration Script Fails

```
Error: relation "schema_migrations" does not exist
```

**Solution:** The migration script should auto-create this table. If it fails, create it manually:

```sql
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id SERIAL PRIMARY KEY,
  schema_name VARCHAR(255) NOT NULL,
  migration_name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(schema_name, migration_name)
);
```

### Port Already in Use

```
Error: listen EADDRINUSE :::3000
```

**Solution:** Kill the existing process or use a different port:
```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9

# Or change the port in .env
PORT=3001
```

### TypeScript Compilation Errors

```bash
# Clean and rebuild
cd apps/api
rm -rf dist
npm run build
```

### Frontend Build Errors

```bash
# Clear Vite cache
cd apps/web
rm -rf node_modules/.vite
npm run dev
```
