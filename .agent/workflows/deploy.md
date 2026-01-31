---
description: deployment workflow for cmpas.ru
---

# Deployment Workflow

// turbo-all

## ⛔ MANDATORY PRE-DEPLOY CHECKLIST (DO NOT SKIP!)

1. **STOP PORT 25 PROCESS** - `fuser -k 25/tcp` - ALWAYS before starting containers
2. **BACKUP DATABASE** - pg_dump before any docker operations
3. **NEVER DELETE VOLUMES** - `docker compose down -v` is FORBIDDEN
4. **VERIFY SERVER AFTER DEPLOY** - Always check site loads after deployment

---

**ALWAYS deploy via GitHub Actions** unless the user explicitly requests manual SSH deployment.

## Steps:

1. Make and commit your code changes locally
2. Push to `main` branch: `git push origin main`
3. GitHub Actions will automatically:
   - SSH into the server
   - **Backup database** to `/var/backups/cmpas/` (keeps last 10 backups)
   - Free port 25 (always occupied)
   - Pull the latest code
   - Rebuild Docker containers (preserves database!)
   - Run Prisma migrations

## Notes:
- Do NOT manually SSH and run `docker compose` commands for deployment
- The workflow file is located at `.github/workflows/deploy-docker.yml`
- If deployment fails, check the GitHub Actions logs first

---

## ⛔ CRITICAL: DATABASE PROTECTION RULES

### NEVER DO THIS:
```bash
# ❌ FORBIDDEN - This deletes ALL data!
docker compose down -v
docker volume rm cmpasru_db_data
```

### SAFE COMMANDS:
```bash
# ✅ Safe - preserves database
docker compose down
docker compose up -d --build

# ✅ Safe - restart containers
docker compose restart
```

---

## ⚠️ Port 25 Conflict

Port 25 is ALWAYS occupied by another service on this server.

Before starting docker containers, ALWAYS run:
```bash
fuser -k 25/tcp 2>/dev/null
```

If you see 502 Bad Gateway after deployment, run:
```bash
ssh root@45.144.30.190 "fuser -k 25/tcp; cd /var/www/cmpas.ru && docker compose down && docker compose up -d"
```

---

## Database Backup & Restore

### Backups are automatic during deploy
Location: `/var/backups/cmpas/db_backup_YYYYMMDD_HHMMSS.sql`

### Manual backup:
```bash
ssh root@45.144.30.190 "docker exec cmpas-postgres pg_dump -U postgres -d cmpas_db > /var/backups/cmpas/manual_backup.sql"
```

### Restore from backup:
```bash
ssh root@45.144.30.190 "docker exec -i cmpas-postgres psql -U postgres -d cmpas_db < /var/backups/cmpas/db_backup_XXXXXXXX_XXXXXX.sql"
```
