# МОМЕНТЫ — промостраница

Static landing page for the **МОМЕНТЫ** Android app (part of the КОМПАС ecosystem),
served at **moments.cmpas.ru**. Used to download the `.apk` directly when RuStore
isn't an option.

Implemented from the Claude Design prototype `project/МОМЕНТЫ-промо.dc.html` — the
design-tool runtime (`<x-dc>` + `support.js`) has been dropped; this is plain,
deployable HTML/CSS.

## Contents

```
moments-promo/
├── index.html            # the page
├── styles.css            # all styles (palette, layout, animations, responsive)
├── assets/
│   └── kompas-tree.svg   # brand mark (white tree)
└── momenty-latest.apk    # ← drop the real signed APK here (not in repo yet)
```

## What's faithful to the design

- Graphite-blue base (`#0B0D12`) with the single terracotta accent (`#C98A6B`),
  reserved for the primary "Скачать" action.
- Live CSS breathing background (4s expand / 6s release), pulsing auras, ripple
  rings, floating phone mockup — all programmatic, no video/images.
- Full copy, catalog (9 moments / 5 families), binaural + night blocks, price,
  and manual-install steps, verbatim from the prototype.
- `prefers-reduced-motion` disables all animation.

## Added for production (not in the prototype)

- Semantic markup + extracted CSS (prototype was inline-styled).
- Responsive breakpoints (940 / 720 / 360px) so it reads well on the phones this
  Android promo will actually be opened on.
- `<title>`, meta description, Open Graph tags, theme-color, SVG favicon.
- `lang="ru"`.

## Before going live — replace placeholders

- `momenty-latest.apk` — the real signed APK (matching the RuStore signature so
  updates install over it). Currently the download links 404 until this file exists.
- `https://apps.rustore.ru` (hero "Открыть в RuStore") → the real RuStore listing URL.
- Footer `Конфиденциальность` / `Поддержка` `href="#"` → real pages.

## Deploy

Fully static — any host that serves files works. Point the docroot of the
`moments.cmpas.ru` vhost at this folder. See the deployment notes in the chat /
the repo root for how this slots onto the cmpas.ru host without touching the
existing services.
