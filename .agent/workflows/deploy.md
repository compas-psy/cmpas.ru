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
