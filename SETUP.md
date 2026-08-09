# Setup

This guide covers prerequisites, environment configuration, database setup, Docker / Dokploy, and deployment.

Source of truth for validated env vars: [`src/env.ts`](src/env.ts). Starter template: [`.env.example`](.env.example).

## Prerequisites

- [Bun](https://bun.sh/) (recommended) or [Node.js 20+](https://nodejs.org/)
- [PostgreSQL](https://neon.tech/) (Neon serverless recommended for self-hosting)
- API keys for AI providers (Google AI, Anthropic, Groq, OpenRouter)
- OAuth credentials (Google + GitHub)
- Cloudflare Turnstile site + secret keys
- Brave Search API key (web search / browse tools)
- Stripe secret key (required by env validation; publishable key needed for checkout UI)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/teamzisty/deni-ai.git
cd deni-ai
```

### 2. Install dependencies

```bash
bun install
# or
npm install
```

### 3. Set up environment variables

Copy the example file and fill in values:

```bash
cp .env.example .env
# For local overrides used by some scripts:
# cp .env.example .env.local
```

Minimum template (see `.env.example` for the full list):

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# App URL (must match the origin users open in the browser)
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000

# Authentication (BETTER_AUTH_SECRET must be exactly 32 characters)
BETTER_AUTH_SECRET=your-32-character-secret-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# AI Providers
GOOGLE_GENERATIVE_AI_API_KEY=your-google-ai-key
ANTHROPIC_API_KEY=your-anthropic-key
GROQ_API_KEY=gsk_your-groq-key
OPENROUTER_API_KEY=your-openrouter-key

# voids.top gateway (optional)
# VOIDS_MODE=true routes platform OpenAI + Anthropic through voids.top
VOIDS_MODE=
VOIDS_BASE_URL=https://capi.voids.top/v2
VOIDS_API_KEY=

# Search
BRAVE_SEARCH_API_KEY=your-brave-search-key

# CAPTCHA (Cloudflare Turnstile)
TURNSTILE_SECRET_KEY=your-turnstile-secret
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-turnstile-site-key

# Stripe (STRIPE_SECRET_KEY is required by env validation)
STRIPE_SECRET_KEY=sk_test_your-stripe-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
# STRIPE_FLASH_OFFER_COUPON_ID=  # optional promo coupon

# Email (optional — magic link / org invites)
RESEND_API_KEY=re_your-resend-key

# Affiliate administration (optional; comma-separated server-side admin emails)
# AFFILIATE_ADMIN_EMAILS=you@example.com

# Rate limiting (optional — falls back to in-memory)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
# Vercel KV-compatible aliases (also optional)
KV_REST_API_URL=
KV_REST_API_TOKEN=

# File uploads (optional — falls back to base64 data URLs)
UPLOADTHING_TOKEN=

# Optional: hide billing UI / disable paid flows in the client
NEXT_PUBLIC_BILLING_DISABLED=

# AdSense (optional)
NEXT_PUBLIC_ADSENSE_CLIENT_ID=
NEXT_PUBLIC_ADSENSE_HOME_SLOT_ID=
NEXT_PUBLIC_ADSENSE_CHAT_SLOT_ID=
```

Notes:

- Empty optional vars are treated as unset (`emptyStringAsUndefined` in `src/env.ts`), which helps Docker / Dokploy builds that inject `""` for missing keys.
- When adding or changing supported models, update `src/lib/constants.ts`.
- `OPENROUTER_API_KEY` routes OpenAI-family and other OpenRouter models when voids mode is off.
- Optional voids.top mode: set `VOIDS_MODE=true` (or `1`) to send **platform** (non-BYOK) OpenAI and Anthropic traffic through the OpenAI-compatible voids.top gateway. When enabled, **`VOIDS_API_KEY` is required** (voids returns `401 invalid apikey` without it). Optional `VOIDS_BASE_URL` (default `https://capi.voids.top/v2`). When `VOIDS_MODE` is off, OpenAI uses OpenRouter and Anthropic uses `ANTHROPIC_API_KEY`.
- Affiliate administration: set `AFFILIATE_ADMIN_EMAILS` to a comma-separated list of account emails that can approve reset rewards and send manual affiliate coupon emails. The address is read only on the server.
- New 30% OFF affiliate coupon rewards remain pending until an admin enters a Stripe coupon or promotion code and sends the email from the affiliate settings page.

#### Generate `BETTER_AUTH_SECRET`

The secret must be **exactly 32 characters** (Zod `length(32)`):

```bash
# 32 hex chars
openssl rand -hex 16

# or base64 truncated to 32
openssl rand -base64 24 | cut -c1-32
```

#### Setting up OAuth providers

**Google OAuth**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select an existing one)
3. Configure the OAuth consent screen
4. Create OAuth 2.0 Client ID (Web application)
5. Authorized redirect URI: `{NEXT_PUBLIC_BETTER_AUTH_URL}/api/auth/callback/google`  
   Local example: `http://localhost:3000/api/auth/callback/google`

**GitHub OAuth**

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Authorization callback URL: `{NEXT_PUBLIC_BETTER_AUTH_URL}/api/auth/callback/github`  
   Local example: `http://localhost:3000/api/auth/callback/github`

### 4. Set up the database

```bash
# Generate migration files after schema edits
bun run db:generate

# Apply migrations
# Production-style (.env.production):
bun run db:migrate

# Local development (.env.local):
bun run db:migrate:dev

# Or push schema directly (dev only)
bun run db:push
```

Regenerate better-auth tables into `src/db/schema/auth-schema.ts` (overwrites that file):

```bash
bun run auth:generate
```

### 5. Run the development server

```bash
bun dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available scripts

| Command                      | Description                          |
| ---------------------------- | ------------------------------------ |
| `bun dev`                    | Start Next.js dev server             |
| `bun run build`              | Typecheck + production build         |
| `bun start`                  | Start production server              |
| `bun run lint`               | oxlint                               |
| `bun run lint:fix`           | oxlint with auto-fix                 |
| `bun run format`             | Format with oxfmt                    |
| `bun run typecheck`          | TypeScript check (`tsgo --noEmit`)   |
| `bun run db:generate`        | Generate Drizzle migrations          |
| `bun run db:migrate`         | Migrate using `.env.production`      |
| `bun run db:migrate:dev`     | Migrate using `.env.local`           |
| `bun run db:push`            | Push schema (dev)                    |
| `bun run auth:generate`      | Regenerate better-auth schema        |
| `bun run disposable:refresh` | Refresh disposable-email domain list |
| `bun run tools:codename`     | Generate version codenames           |
| `bun run tools:commit`       | AI-assisted conventional commits     |
| `bun run doctor`             | Run react-doctor diagnostics         |

## Stripe billing

Env validation always requires `STRIPE_SECRET_KEY`. Checkout UI needs `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Webhooks need `STRIPE_WEBHOOK_SECRET` in production.

1. Create a [Stripe account](https://stripe.com/) and copy API keys
2. Add keys to `.env` (see template above)
3. Webhook endpoint: `{NEXT_PUBLIC_BETTER_AUTH_URL}/api/stripe/webhook`
4. Suggested events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Local forwarding:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

To hide billing in the client:

```env
NEXT_PUBLIC_BILLING_DISABLED=true
```

Optional flash offer coupon: `STRIPE_FLASH_OFFER_COUPON_ID`.

## Database schema

Schemas live under `src/db/schema/`. Main domains:

| Area                                  | Purpose                                       |
| ------------------------------------- | --------------------------------------------- |
| **auth-schema**                       | Users, sessions, accounts, orgs (better-auth) |
| **chat**                              | Conversations and messages                    |
| **provider-keys / provider-settings** | BYOK keys and provider preferences            |
| **api-keys**                          | User API key records                          |
| **memory**                            | Personalization memories                      |
| **project**                           | Project-scoped chat context                   |
| **billing**                           | Stripe subscriptions / payment data           |
| **usage**                             | Platform usage and limits                     |
| **share**                             | Shared chat links                             |
| **team-usage-policy**                 | Team usage policies                           |
| **device-auth**                       | Device / desktop auth                         |

Schema change workflow:

1. Edit files in `src/db/schema/`
2. `bun run db:generate`
3. `bun run db:migrate` or `bun run db:migrate:dev` (or `db:push` in dev)

## Deployment

### Vercel (common for this stack)

1. Push the repo to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Set all required environment variables
4. Deploy (build uses `bun run build` / `next build` per project settings)

### Docker / Dokploy

A multi-stage `Dockerfile` is included for self-hosting (e.g. Dokploy):

- **Build:** Bun installs deps; **Node 22** runs `next build` (standalone output)
- **Run:** Node serves `.next/standalone` on port **3000**
- `NEXT_PUBLIC_*` values must be present at **build time** (inlined into the client bundle)
- Server secrets should also be available at build time for `@t3-oss/env-nextjs` validation / prerender; runtime still uses container env

Dokploy application settings (typical):

| Setting         | Value        |
| --------------- | ------------ |
| Build type      | Dockerfile   |
| Dockerfile path | `Dockerfile` |
| Context         | `.`          |
| Port            | `3000`       |

Put the same keys as production `.env` in the service **Environment** tab, and pass them as **build-time** args/env for `NEXT_PUBLIC_*` (and other keys required during `next build`). See comments at the top of `Dockerfile`.

Local example:

```bash
docker build -t deni-ai \
  --build-arg NEXT_PUBLIC_BETTER_AUTH_URL=https://example.com \
  --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY=... \
  .

docker run --rm -p 3000:3000 --env-file .env.production deni-ai
```

### Other platforms

Any host that can run a Next.js standalone Node server (Railway, Render, Fly.io, AWS/GCP/Azure, etc.):

- Set all required environment variables
- Use PostgreSQL (Neon recommended)
- Build: `bun run build` (or the Docker image)
- Start: `bun start` / `node server.js` (standalone) / container CMD

## Troubleshooting

| Issue                         | What to check                                                 |
| ----------------------------- | ------------------------------------------------------------- |
| Env validation errors on boot | Missing keys in `src/env.ts`; empty optional strings are OK   |
| OAuth redirect mismatch       | Callback URLs must match `NEXT_PUBLIC_BETTER_AUTH_URL`        |
| DB migrate fails              | Correct `DATABASE_URL`; use `db:migrate:dev` for local        |
| Stripe checkout broken        | Publishable key + webhook secret; Stripe CLI for local        |
| Search / browse tools fail    | Valid `BRAVE_SEARCH_API_KEY`                                  |
| Docker build env issues       | Pass `NEXT_PUBLIC_*` as build args; see `Dockerfile` comments |
