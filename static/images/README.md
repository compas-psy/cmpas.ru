# Static images for the site

Put site-hosted images (logos, icons, illustrations) in this folder.

How to reference from HTML/CSS/JS:
- HTML tag (absolute path recommended):
  <img src="/static/images/yandex-logo.svg" alt="Logo">
- CSS background:
  .hero { background-image: url("/static/images/hero.jpg"); }
- From existing telegram_auth.html (uses data-src):
  <img id="yandexLogoImg" class="yandex-logo" alt="Yandex" data-src="/static/images/yandex-logo.svg">

Notes:
- The FastAPI app mounts the folder "static" to URL path "/static" (see app/main.py).
- Therefore anything under static/images/ is available at /static/images/...
- Prefer absolute "/static/..." paths to avoid issues when a page is served at root (e.g. /telegram_auth.html) vs under /static/.
