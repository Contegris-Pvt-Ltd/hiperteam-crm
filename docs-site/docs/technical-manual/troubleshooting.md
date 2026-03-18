---
sidebar_position: 19
title: "Troubleshooting"
description: "Common issues and solutions for database, authentication, CORS, Redis, file uploads, and performance problems"
---

# Troubleshooting

This guide covers common issues encountered during development and production, with solutions for each.

## Database Connection Errors

### Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Cause:** PostgreSQL is not running or not accepting connections.

**Solution:**

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start it
sudo systemctl start postgresql

# Check pg_hba.conf for connection rules
sudo cat /etc/postgresql/14/main/pg_hba.conf
```

### Authentication Failed

```
Error: password authentication failed for user "postgres"
```

**Solution:** Verify `DB_USER` and `DB_PASS` in `.env`. Check `pg_hba.conf` auth method (should be `md5` or `scram-sha-256`).

### Too Many Connections

```
Error: remaining connection slots are reserved for non-replication superuser connections
```

**Solution:** Increase `max_connections` in `postgresql.conf` or reduce `DB_POOL_SIZE` in `.env`:

```sql
-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- Check max
SHOW max_connections;
```

## Migration Failures

### Schema Already Exists

```
Error: schema "tenant_acme" already exists
```

This is not an error if migrations use `IF NOT EXISTS`. Check that your migration SQL includes it.

### Column Already Exists

```
Error: column "my_column" of relation "my_table" already exists
```

**Solution:** Use `ADD COLUMN IF NOT EXISTS`:

```sql
ALTER TABLE "${schema}".my_table ADD COLUMN IF NOT EXISTS my_column VARCHAR(100);
```

### Migration Variable Error

```
ReferenceError: schemaName is not defined
```

**Cause:** Using `${schemaName}` instead of `${schema}` in the migration script.

**Solution:** Replace all `${schemaName}` with `${schema}` in your migration SQL.

### Permission Denied Creating Schema

```
Error: permission denied for database intellicon_crm
```

**Solution:** Grant schema creation rights:

```sql
GRANT CREATE ON DATABASE intellicon_crm TO your_app_user;
```

## JWT / Authentication Issues

### 401 Unauthorized on All Requests

**Common causes:**
1. **Expired token** — check the `exp` field in the decoded JWT
2. **Wrong JWT_SECRET** — the secret changed between token issuance and validation
3. **Missing Authorization header** — ensure `Bearer <token>` is sent

```bash
# Decode a JWT to inspect it (paste token at jwt.io)
echo "eyJhbG..." | base64 -d
```

### Token Refresh Fails

**Cause:** Refresh token expired (7 days) or was already used (token rotation).

**Solution:** Re-authenticate via `/auth/login`.

### "Invalid signature" Error

**Cause:** `JWT_SECRET` in `.env` does not match the secret used to sign the token.

**Solution:** Ensure the same `JWT_SECRET` is used across all instances. In cluster mode (PM2), all instances share the same `.env`.

## CORS Issues

### Access-Control-Allow-Origin Error

```
Access to XMLHttpRequest has been blocked by CORS policy
```

**Solution:** Verify `FRONTEND_URL` in `.env` matches the frontend origin exactly (including protocol and port):

```env
# Development
FRONTEND_URL=http://localhost:5173

# Production
FRONTEND_URL=https://app.intellicon.com
```

:::tip
Do not include a trailing slash in `FRONTEND_URL`. `http://localhost:5173/` will not match `http://localhost:5173`.
:::

### Preflight Request Fails

If OPTIONS requests fail, ensure Nginx is not stripping CORS headers:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3000/;
    # ... other settings

    # Allow preflight
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type';
        add_header 'Access-Control-Max-Age' 1728000;
        return 204;
    }
}
```

## Redis Connection Problems

### Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**

```bash
# Check Redis status
redis-cli ping
# Expected: PONG

# Start Redis
sudo systemctl start redis
```

### Authentication Required

```
Error: NOAUTH Authentication required
```

**Solution:** Set `REDIS_PASSWORD` in `.env` to match the Redis `requirepass` setting.

### Queue Stalled Jobs

If Bull queue jobs are stalling (stuck in "active" state):

```bash
# Check stalled jobs via Redis CLI
redis-cli
> KEYS bull:lead-import:*
> LRANGE bull:lead-import:stalled 0 -1
```

**Solution:** Increase the `stalledInterval` in Bull config or ensure workers are not crashing silently.

## File Upload Issues

### File Too Large

```
Error: File too large (max: 10485760 bytes)
```

**Solution:** Increase `MAX_FILE_SIZE` in `.env`. Also increase Nginx `client_max_body_size`:

```nginx
client_max_body_size 20M;
```

### Upload Directory Permission Denied

```
Error: EACCES: permission denied, open '/var/www/intellicon/uploads/...'
```

**Solution:**

```bash
sudo chown -R www-data:www-data /var/www/intellicon/uploads
sudo chmod -R 755 /var/www/intellicon/uploads
```

### Uploaded Files Not Accessible

Ensure Nginx serves the uploads directory:

```nginx
location /uploads/ {
    alias /var/www/intellicon/uploads/;
}
```

## Email Sending Failures

### SMTP Connection Timeout

**Cause:** Firewall blocking outbound port 587/465.

**Solution:** Check firewall rules and verify SMTP credentials:

```bash
# Test SMTP connection
telnet smtp.example.com 587
```

### Emails Going to Spam

**Solutions:**
1. Set up SPF, DKIM, and DMARC records for your sending domain
2. Use a reputable email service (SendGrid, SES, Postmark)
3. Ensure `SMTP_FROM` matches a verified sender address

## Calendar Sync Issues

### Google OAuth Token Expired

Google OAuth refresh tokens can be invalidated. Re-authenticate via the calendar sync settings.

### Calendar Events Not Syncing

Check the cron job for calendar sync is running:

```bash
# Check cron
crontab -l
```

## Performance Troubleshooting

### Slow API Responses

1. **Check slow queries:**

```sql
-- Enable slow query logging
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries over 1s
SELECT pg_reload_conf();

-- Check active queries
SELECT pid, query, state, now() - query_start AS duration
FROM pg_stat_activity
WHERE state = 'active' AND query NOT LIKE '%pg_stat%'
ORDER BY duration DESC;
```

2. **Add missing indexes:**

```sql
-- Find tables with sequential scans (should have index scans)
SELECT relname, seq_scan, idx_scan
FROM pg_stat_user_tables
WHERE seq_scan > idx_scan AND seq_scan > 1000
ORDER BY seq_scan DESC;
```

3. **Check connection pool:**

```sql
SELECT count(*) FROM pg_stat_activity WHERE datname = 'intellicon_crm';
```

### High Memory Usage

```bash
# Check PM2 memory
pm2 monit

# If Node.js is consuming too much memory
pm2 restart intellicon-api --max-memory-restart 1G
```

### Frontend Slow Loading

1. Check the build output size: `npm run build` shows bundle sizes
2. Enable gzip in Nginx:

```nginx
gzip on;
gzip_types text/plain application/json application/javascript text/css;
gzip_min_length 1000;
```

## Log Analysis

### Backend Logs

```bash
# PM2 logs
pm2 logs intellicon-api

# Last 100 lines
pm2 logs intellicon-api --lines 100

# Error logs only
pm2 logs intellicon-api --err
```

### Nginx Logs

```bash
# Access log
tail -f /var/log/nginx/access.log

# Error log
tail -f /var/log/nginx/error.log

# Filter for 5xx errors
grep " 50[0-9] " /var/log/nginx/access.log
```

### PostgreSQL Logs

```bash
# Default location
tail -f /var/log/postgresql/postgresql-14-main.log
```

:::tip
Set up centralized logging (ELK Stack, Datadog, CloudWatch) for production environments to correlate issues across services.
:::
