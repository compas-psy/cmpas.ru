# moments.cmpas.ru — deployment (hands-off)

The МОМЕНТЫ promo page is a **static site** on the *same* VPS as cmpas.ru
(`45.144.30.190`), but fully isolated: its own nginx vhost, its own docroot
(`/var/www/moments.cmpas.ru`), its own TLS cert. It does **not** touch the
Docker stack, the database, or the cmpas.ru vhost.

## You don't run anything on the server

Two GitHub Actions workflows do everything, reusing the existing
`SERVER_HOST` / `SERVER_USER` / `SSH_PRIVATE_KEY` secrets:

| Workflow | Trigger | What it does | Touches nginx? |
|---|---|---|---|
| `provision-moments.yml` | change under `deploy/**`, or **Run workflow** button | installs the nginx vhost + issues the TLS cert (idempotent) | yes — safely (see below) |
| `deploy-moments.yml` | change under `public/**` | rsyncs the page into the docroot | **no** — files only |

On the **first merge to `main`**, both run automatically: provisioning sets up
nginx+TLS once, then the content deploy publishes the page. After that, editing
the page (`public/**`) only ever runs the content deploy, which copies files and
never goes near the web server.

DNS (`moments.cmpas.ru → 45.144.30.190`) is already in place, so TLS issuance
works on the first run.

## Why this cannot break cmpas.ru or cmpas.ru/diary

- Provisioning only **creates** files for moments; it never reads or edits the
  cmpas.ru vhost.
- It enables the moments vhost, runs `nginx -t`, and **reloads only if the test
  passes**. If it fails, it **removes the symlink** — so `sites-enabled` is always
  left holding only configs that pass `nginx -t`. A later cmpas.ru deploy or cert
  renewal can never inherit a broken file from us.
- `systemctl reload nginx` is graceful (no dropped requests), never a restart.
- certbot is scoped to `-d moments.cmpas.ru`, so it edits only the moments server
  block; the cmpas.ru certificate is untouched. If it fails, the page still serves
  over HTTP and cmpas.ru is unaffected.
- Routing is by `server_name`: requests to `cmpas.ru` / `cmpas.ru/diary` are
  matched by the cmpas.ru vhost and never reach the moments block.

**Rollback** (if you ever want moments gone), one command, cmpas.ru unaffected:
```bash
rm /etc/nginx/sites-enabled/moments.cmpas.ru && systemctl reload nginx
```

## The APK

`momenty-latest.apk` is intentionally **not** in git and **not** rsynced (the
deploy excludes `*.apk`, so a deploy never deletes it). Publish the signed release
binary once into the docroot — ideally wired to the МОМЕНТЫ app's release pipeline
in the `compas-voice` repo:
```bash
scp momenty-latest.apk root@45.144.30.190:/var/www/moments.cmpas.ru/
```
Keep the signature identical to the RuStore build so updates install over it.

---

## Appendix — manual equivalent (only if you ever bypass CI)
```bash
ssh root@45.144.30.190
mkdir -p /var/www/moments.cmpas.ru
cp /var/www/cmpas.ru/sites/moments.cmpas.ru/deploy/moments.cmpas.ru.nginx.conf \
   /etc/nginx/sites-available/moments.cmpas.ru
ln -s /etc/nginx/sites-available/moments.cmpas.ru /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx          # reload only if the test passes
certbot --nginx -d moments.cmpas.ru
rsync -az --delete --exclude '*.apk' \
  /var/www/cmpas.ru/sites/moments.cmpas.ru/public/ /var/www/moments.cmpas.ru/
```
