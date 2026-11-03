# syntax=docker/dockerfile:1
# One Dockerfile, two runtime targets: `app` (Next.js) and `worker`
# (pg-boss jobs + migrations). See docs/RUNBOOK.md.

FROM node:22-alpine AS base
# npm 10 has a peer-resolution bug with this dependency tree; the lockfile is npm 11.
RUN npm install -g npm@11 --no-fund --no-audit
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- dependencies (all, for building) ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit

# ---- build ----
FROM base AS build
# Prerendered pages bake in the site URL (canonical, Open Graph, sitemap) and robots / noindex.
ARG APP_URL="" SITE_INDEXING=""
ENV APP_URL=$APP_URL SITE_INDEXING=$SITE_INDEXING
# Public measurement ids are inlined into the browser bundle at build time (empty = tool off).
ARG NEXT_PUBLIC_GA4_ID="" NEXT_PUBLIC_META_PIXEL_ID="" NEXT_PUBLIC_GOOGLE_ADS_ID="" \
    NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL="" NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL="" NEXT_PUBLIC_GOOGLE_ADS_PHONE_LABEL="" \
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION="" NEXT_PUBLIC_TURNSTILE_SITE_KEY=""
ENV NEXT_PUBLIC_GA4_ID=$NEXT_PUBLIC_GA4_ID NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID \
    NEXT_PUBLIC_GOOGLE_ADS_ID=$NEXT_PUBLIC_GOOGLE_ADS_ID NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL=$NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL \
    NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL=$NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL NEXT_PUBLIC_GOOGLE_ADS_PHONE_LABEL=$NEXT_PUBLIC_GOOGLE_ADS_PHONE_LABEL \
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=$NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# An empty build arg means "not set" (e.g. the CI image check), not an empty value.
RUN [ -n "$APP_URL" ] || unset APP_URL; [ -n "$SITE_INDEXING" ] || unset SITE_INDEXING; \
    npm run build && npm run build:worker

# ---- production dependencies only (for the worker) ----
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-fund --no-audit

# ---- app runtime ----
FROM node:22-alpine AS app
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]

# ---- worker runtime (also runs migrations) ----
FROM node:22-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/src/db/migrations ./src/db/migrations
COPY --from=build --chown=app:app /app/src/db/seed-media ./src/db/seed-media
USER app
CMD ["node", "dist/src/worker/index.mjs"]
