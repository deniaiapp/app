# syntax=docker/dockerfile:1
#
# Dokploy (Dockerfile build)
# -------------------------
# Application settings:
#   Build Type:        Dockerfile
#   Dockerfile path:   Dockerfile
#   Docker context:    .
#   Port:              3000
#
# Environment (service Environment tab):
#   - Put ALL required secrets/public vars there (same as .env.production).
#   - Add the same keys under Build Time Arguments (or mark them build-time)
#     so Dokploy passes them as `docker build --build-arg`. The builder stage
#     declares matching ARG/ENV so `next build` sees real prod values.
#   - NEXT_PUBLIC_* MUST be build-time (embedded into the client bundle).
#   - Server secrets are also injected at build for `@t3-oss/env-nextjs`
#     validation / prerender; runtime still uses service Environment.
#
# Local:
#   docker build -t deni-ai .
#   # With prod public/client values (repeat --build-arg per key, or use Dokploy):
#   docker build -t deni-ai --build-arg NEXT_PUBLIC_BETTER_AUTH_URL=https://example.com .
#   docker run --rm -p 3000:3000 --env-file .env.production deni-ai

# ---------------------------------------------------------------------------
# Install dependencies (Bun workspaces + bun.lock)
# ---------------------------------------------------------------------------
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/disposable-email-domains ./packages/disposable-email-domains
RUN bun install --frozen-lockfile

# ---------------------------------------------------------------------------
# Build (Next.js production build)
# ---------------------------------------------------------------------------
FROM oven/bun:1 AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
  NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .

# Dokploy / `docker build --build-arg` inject service env here.
# Core keys keep placeholder defaults so a bare `docker build` still compiles.
# Provider/integration keys have no default, so missing keys disable their
# dependent features; emptyStringAsUndefined in src/env.ts treats "" as unset.
ARG DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ARG BETTER_AUTH_SECRET=01234567890123456789012345678901
ARG GOOGLE_CLIENT_ID
ARG GOOGLE_CLIENT_SECRET
ARG GITHUB_CLIENT_ID
ARG GITHUB_CLIENT_SECRET
ARG STRIPE_SECRET_KEY
ARG STRIPE_WEBHOOK_SECRET
ARG STRIPE_FLASH_OFFER_COUPON_ID
ARG GOOGLE_GENERATIVE_AI_API_KEY
ARG ANTHROPIC_API_KEY
ARG GROQ_API_KEY
ARG OPENROUTER_API_KEY
ARG VOIDS_MODE
ARG VOIDS_BASE_URL
ARG VOIDS_API_KEY
ARG EXA_API_KEY
ARG TURNSTILE_SECRET_KEY
ARG RESEND_API_KEY
ARG UPSTASH_REDIS_REST_URL
ARG UPSTASH_REDIS_REST_TOKEN
ARG KV_REST_API_URL
ARG KV_REST_API_TOKEN
ARG UPLOADTHING_TOKEN
ARG NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_BILLING_DISABLED
ARG NEXT_PUBLIC_ADSENSE_CLIENT_ID
ARG NEXT_PUBLIC_ADSENSE_HOME_SLOT_ID
ARG NEXT_PUBLIC_ADSENSE_CHAT_SLOT_ID

# Promote ARG → ENV so `next build` / env.ts validation / NEXT_PUBLIC inlining
# all see production values when Dokploy (or --build-arg) supplies them.
ENV DATABASE_URL=$DATABASE_URL \
  BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET \
  GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID \
  GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET \
  GITHUB_CLIENT_ID=$GITHUB_CLIENT_ID \
  GITHUB_CLIENT_SECRET=$GITHUB_CLIENT_SECRET \
  STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY \
  STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET \
  STRIPE_FLASH_OFFER_COUPON_ID=$STRIPE_FLASH_OFFER_COUPON_ID \
  GOOGLE_GENERATIVE_AI_API_KEY=$GOOGLE_GENERATIVE_AI_API_KEY \
  ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  GROQ_API_KEY=$GROQ_API_KEY \
  OPENROUTER_API_KEY=$OPENROUTER_API_KEY \
  VOIDS_MODE=$VOIDS_MODE \
  VOIDS_BASE_URL=$VOIDS_BASE_URL \
  VOIDS_API_KEY=$VOIDS_API_KEY \
  EXA_API_KEY=$EXA_API_KEY \
  TURNSTILE_SECRET_KEY=$TURNSTILE_SECRET_KEY \
  RESEND_API_KEY=$RESEND_API_KEY \
  UPSTASH_REDIS_REST_URL=$UPSTASH_REDIS_REST_URL \
  UPSTASH_REDIS_REST_TOKEN=$UPSTASH_REDIS_REST_TOKEN \
  KV_REST_API_URL=$KV_REST_API_URL \
  KV_REST_API_TOKEN=$KV_REST_API_TOKEN \
  UPLOADTHING_TOKEN=$UPLOADTHING_TOKEN \
  NEXT_PUBLIC_BETTER_AUTH_URL=$NEXT_PUBLIC_BETTER_AUTH_URL \
  NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
  NEXT_PUBLIC_BILLING_DISABLED=$NEXT_PUBLIC_BILLING_DISABLED \
  NEXT_PUBLIC_ADSENSE_CLIENT_ID=$NEXT_PUBLIC_ADSENSE_CLIENT_ID \
  NEXT_PUBLIC_ADSENSE_HOME_SLOT_ID=$NEXT_PUBLIC_ADSENSE_HOME_SLOT_ID \
  NEXT_PUBLIC_ADSENSE_CHAT_SLOT_ID=$NEXT_PUBLIC_ADSENSE_CHAT_SLOT_ID

RUN bun --bun run build

# Temporary disabled (runtime is now bun)
# # Next's standalone tracer can copy only the CJS side of Bun's virtual-store
# # @swc/helpers package. Node 22 resolves its `module-sync` condition to ESM,
# # so preserve the ESM files in every traced helper package as well.
# RUN set -eux; \
#   for standalone_helpers in \
#     .next/standalone/node_modules/.bun/*/node_modules/@swc/helpers \
#     .next/standalone/node_modules/@swc/helpers; do \
#     [ -d "$standalone_helpers" ] || continue; \
#     source_helpers="${standalone_helpers#.next/standalone/}"; \
#     [ -d "$source_helpers/esm" ] || continue; \
#     mkdir -p "$standalone_helpers/esm"; \
#     cp -a "$source_helpers/esm/." "$standalone_helpers/esm/"; \
#   done

# ---------------------------------------------------------------------------
# Runtime (Next.js standalone + Bun)
# ---------------------------------------------------------------------------
FROM oven/bun:1 AS runner
WORKDIR /app

# Dokploy / Traefik reach the container on this port.
# HOSTNAME=0.0.0.0 is only the listen bind address (not the public site URL).
# Never set NEXT_PUBLIC_BETTER_AUTH_URL to http://0.0.0.0:3000 — use the real
# public origin (e.g. https://deniai.app) at build time.
ENV PORT=3000 \
  HOSTNAME=0.0.0.0 \
  NEXT_TELEMETRY_DISABLED=1 \
  NODE_ENV=production

# oven/bun images already ship a non-root `bun` user/group and omit adduser/usermod.
COPY --from=builder --chown=bun:bun /app/public ./public
COPY --from=builder --chown=bun:bun /app/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/.next/static ./.next/static

USER bun
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "server.js"]
