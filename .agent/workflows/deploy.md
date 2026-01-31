---
description: deployment workflow for cmpas.ru
---

# Deployment Workflow

// turbo-all

**ALWAYS deploy via GitHub Actions** unless the user explicitly requests manual SSH deployment.

## Steps:

1. Make and commit your code changes locally
2. Push to `main` branch: `git push origin main`
3. GitHub Actions will automatically:
   - SSH into the server
   - Pull the latest code
   - Rebuild Docker containers
   - Restart the application

## Notes:
- Do NOT manually SSH and run `docker compose` commands for deployment
- The workflow file is located at `.github/workflows/deploy-docker.yml`
- If deployment fails, check the GitHub Actions logs first

## ⚠️ IMPORTANT: Port 25 Conflict

**Port 25 is ALWAYS occupied by another service on this server.**

Before starting docker containers, ALWAYS run:
```bash
fuser -k 25/tcp 2>/dev/null
```

This kills any process using port 25 so the mailer container can start.

If you see 502 Bad Gateway after deployment, run:
```bash
ssh root@45.144.30.190 "fuser -k 25/tcp; cd /var/www/cmpas.ru && docker compose down && docker compose up -d"
```
