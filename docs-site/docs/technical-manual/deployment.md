---
sidebar_position: 18
title: "Deployment"
description: "Production deployment guide covering build, database, Redis, Nginx, SSL, and process management"
---

# Deployment

This guide covers deploying Intellicon CRM to a production environment.

## Architecture Overview

```
Internet → Nginx (SSL termination, :443)
              ├── /api/*  → NestJS Backend (:3000)
              └── /*      → React Static Files (dist/)
                              ↓
                    PostgreSQL (:5432)
                    Redis (:6379)
```

## Build Commands

### Backend

```bash
cd apps/api
npm ci --production=false    # Install all deps (including devDependencies for build)
npm run build                # Compiles TypeScript → dist/
```

The compiled output is in `apps/api/dist/`. The entry point is `dist/main.js`.

### Frontend

```bash
cd apps/web
npm ci
npm run build                # Vite build → dist/
```

The static output is in `apps/web/dist/`. Serve this directory with Nginx.

## Environment Configuration

Create a `.env` file on the production server with all required variables. See [Environment Variables](./environment-variables.md) for the complete reference.

:::danger Production Checklist
Before going live:
- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` is a 64+ character random string
- [ ] `DB_SSL=true`
- [ ] `DB_PASS` is a strong password
- [ ] `FRONTEND_URL` points to the production domain
- [ ] SMTP is configured for transactional emails
- [ ] Redis has a password set
- [ ] CORS origins are restricted to production domains only
:::

## Database Setup (PostgreSQL)

### 1. Create Database and User

```sql
CREATE USER intellicon_app WITH PASSWORD 'strong_password_here';
CREATE DATABASE intellicon_crm OWNER intellicon_app;

-- Grant schema creation rights (needed for tenant creation)
GRANT CREATE ON DATABASE intellicon_crm TO intellicon_app;
```

### 2. Enable SSL

Edit `postgresql.conf`:

```
ssl = on
ssl_cert_file = '/path/to/server.crt'
ssl_key_file = '/path/to/server.key'
```

### 3. Run Migrations

```bash
cd apps/api
NODE_ENV=production npx ts-node src/scripts/run-tenant-migrations.ts
```

:::tip Automated Migrations
Add migration running to your deployment script to ensure all tenant schemas are up to date after each deploy.
:::

## Redis Setup

```bash
# Install Redis (Ubuntu)
sudo apt install redis-server

# Set password in redis.conf
requirepass your_redis_password

# Enable persistence
appendonly yes

# Restart
sudo systemctl restart redis
```

## Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name app.intellicon.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.intellicon.com;

    ssl_certificate /etc/letsencrypt/live/app.intellicon.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.intellicon.com/privkey.pem;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # File upload size
        client_max_body_size 20M;
    }

    # Static frontend files
    location / {
        root /var/www/intellicon/apps/web/dist;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Upload directory
    location /uploads/ {
        alias /var/www/intellicon/uploads/;
        expires 30d;
    }
}
```

## SSL/TLS Configuration

Use Let's Encrypt for free SSL certificates:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d app.intellicon.com
```

Auto-renewal is configured automatically. Verify:

```bash
sudo certbot renew --dry-run
```

## Process Management (PM2)

Use PM2 to manage the Node.js process:

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
cd apps/api
pm2 start dist/main.js --name intellicon-api \
  --env production \
  --instances 2 \
  --max-memory-restart 1G

# Save the process list
pm2 save

# Setup startup script
pm2 startup
```

### PM2 Ecosystem File

Create `ecosystem.config.js` in the project root:

```javascript
module.exports = {
  apps: [
    {
      name: 'intellicon-api',
      script: 'apps/api/dist/main.js',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/intellicon/error.log',
      out_file: '/var/log/intellicon/out.log',
      merge_logs: true,
    },
  ],
};
```

```bash
pm2 start ecosystem.config.js --env production
```

## Health Checks

### API Health Endpoint

```bash
curl https://app.intellicon.com/api/health
# Expected: { "status": "ok" }
```

### Monitoring Script

```bash
#!/bin/bash
# health-check.sh
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://app.intellicon.com/api/health)
if [ "$RESPONSE" != "200" ]; then
  echo "API health check failed with status $RESPONSE"
  pm2 restart intellicon-api
fi
```

Add to crontab:
```
*/5 * * * * /path/to/health-check.sh
```

## Monitoring Recommendations

| Aspect | Tool | What to Monitor |
|--------|------|-----------------|
| **Application** | PM2 / DataDog | CPU, memory, restart count, response times |
| **Database** | pg_stat_statements | Slow queries, connection count, table bloat |
| **Redis** | Redis CLI / monitoring | Memory usage, connected clients, queue lengths |
| **Server** | Prometheus + Grafana | Disk, CPU, memory, network |
| **Errors** | Sentry | Application exceptions, stack traces |
| **Uptime** | UptimeRobot / Pingdom | Endpoint availability |

:::tip Logging
In production, configure structured JSON logging. Use a log aggregator (ELK Stack, Datadog, Cloudwatch) to centralize logs from all instances.
:::
