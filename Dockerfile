FROM node:20-slim AS base

# Install dependencies only when needed
RUN apt-get update -y && apt-get install -y openssl ca-certificates
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NODE_OPTIONS="--max-old-space-size=1024"

RUN npx prisma generate
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --home /home/nextjs nextjs
RUN mkdir -p /home/nextjs && chown -R nextjs:nodejs /home/nextjs

# MAX API certificate trust (see deploy/certs/README.md): MAX is moving its API
# infra to Mincifry-issued TLS certs, which aren't in Node's/Debian's default
# root store. Any .crt/.pem dropped in deploy/certs/ gets trusted system-wide
# and by Node's fetch/https. No-op when the folder only has the README (default
# state) — update-ca-certificates just skips non-certificate files.
COPY deploy/certs/ /usr/local/share/ca-certificates/max-ru/
RUN update-ca-certificates || true
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

COPY --from=builder /app/public ./public
RUN mkdir -p ./public/uploads/client-documents && chown -R nextjs:nodejs ./public

RUN mkdir .next
RUN chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/deploy ./deploy
COPY --from=builder --chown=nextjs:nodejs /app/scripts/start-production.sh ./scripts/start-production.sh
COPY --from=builder --chown=nextjs:nodejs /app/scripts/verify-production-schema.js ./scripts/verify-production-schema.js
RUN chmod 755 ./scripts/start-production.sh
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

USER nextjs

EXPOSE 3000
ENV PORT 3000

CMD ["./scripts/start-production.sh"]

# Infra-pulse collector (O-260817-12): a separate process from the site,
# same reasoning as the reminders outbox has for its own worker — a
# collector living inside the site process would mean "site restarts" and
# "metrics stop" fail together, which defeats the point of monitoring the
# site's own health. Reuses `builder`'s already-installed deps and
# generated Prisma client; runs the TypeScript entrypoint directly via tsx.
# `pg_restore` (postgresql-client) is needed to sanity-check .dump backups
# without touching a database.
#
# Runs as root, unlike `runner`/`reminders-worker` — it needs to read
# /var/run/docker.sock, which is only readable by root or the host's docker
# group inside the container by default, and this container has no exposed
# port and handles no external input (nothing to exploit into that root),
# unlike the public-facing app. Named here rather than worked around
# silently.
FROM builder AS infra-pulse-collector
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN apt-get update -y && apt-get install -y --no-install-recommends postgresql-client && rm -rf /var/lib/apt/lists/*

CMD ["npx", "tsx", "scripts/infra-pulse-collector.ts"]
