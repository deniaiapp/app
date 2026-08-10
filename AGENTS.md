AGENTS.md (Agent Working Guide for deni-ai)

This file applies to the entire repository tree rooted here. Follow these rules, steps, and cautions when making changes. If a deeper directory contains its own AGENTS.md, the more specific one takes precedence. Direct instructions from system/developers/users override this file.

■ Project Overview

- Framework: Next.js App Router (next@16 canary, React 19, React Compiler enabled)
- Language/Types: TypeScript (strict)
- Runtime: Bun (preferred; bun.lock present) or Node.js 20+
- Lint/Format: oxlint (linting) and oxfmt (formatting)
- Styles: Tailwind CSS v4 (via `@tailwindcss/postcss`)
- UI: shadcn/ui (generated under `src/components/ui/*`)
- DB: Postgres (Neon serverless) + Drizzle ORM (`drizzle-kit`)
- Auth: better-auth (Drizzle adapter)

■ Required Environment Variables (as enforced by `src/env.ts`)

Source of truth: `src/env.ts`. Starter: `.env.example`. Human setup guide: `SETUP.md`.
Empty optional strings are treated as unset (`emptyStringAsUndefined`) for Docker/Dokploy.

Required (Zod will fail startup/build without them):

- `DATABASE_URL` (Postgres / Neon)
- `NEXT_PUBLIC_BETTER_AUTH_URL` (public app URL, e.g. http://localhost:3000)
- `BETTER_AUTH_SECRET` (exactly 32 characters)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- `STRIPE_SECRET_KEY` (always required by validation; use `NEXT_PUBLIC_BILLING_DISABLED` to hide billing UI)
- `GOOGLE_GENERATIVE_AI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`
- `BRAVE_SEARCH_API_KEY`
- `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

Optional:

- Stripe: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_FLASH_OFFER_COUPON_ID`
- voids.top: `VOIDS_MODE=true|1` routes platform OpenAI + Anthropic via voids; when enabled `VOIDS_API_KEY` is required; optional `VOIDS_BASE_URL`
- Email (Cloudflare Email Sending): `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`
- Rate limit: `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_URL` / `KV_REST_API_TOKEN`
- Uploads: `UPLOADTHING_TOKEN`
- Client: `NEXT_PUBLIC_BILLING_DISABLED`, AdSense (`NEXT_PUBLIC_ADSENSE_*`)

■ Common Scripts (Bun preferred)

- Dev server: `bun dev`
- Build: `bun run build` (runs `typecheck` then `next build`)
- Start: `bun start` / `bun run start`
- Lint: `bun run lint` (oxlint); fix: `bun run lint:fix`
- Format: `bun run format` (oxfmt)
- Typecheck: `bun run typecheck`
- Drizzle generate: `bun run db:generate`
- Drizzle migrate: `bun run db:migrate` (`.env.production`); local: `bun run db:migrate:dev` (`.env.local`)
- Drizzle push: `bun run db:push`
- Regenerate better-auth schema: `bun run auth:generate` (overwrites `src/db/schema/auth-schema.ts`)
- Disposable email list: `bun run disposable:refresh`
- Tools: `bun run tools:commit`, `bun run tools:codename`
- React doctor: `bun run doctor`

■ Coding Conventions

- Formatting/Linting: Adhere to oxlint and oxfmt. Run `bun run lint` and `bun run format` before submitting changes.
- Exports: Prefer named exports where reasonable. Match existing code style.
- Type safety: Keep TypeScript strict. Avoid `any`; if unavoidable, scope it narrowly.
- Module paths: Use the `@/*` alias (from `tsconfig.json`) to avoid deep relative paths.
- File naming: Follow existing kebab-case for files (e.g., `auth-client.ts`).
- React/Next: App Router patterns (`src/app/**/page.tsx`, `layout.tsx`). Respect server/client component boundaries.
- React Compiler: Avoid sharing mutable closures or side effects that break assumptions. Follow existing patterns.

■ Database & Migrations (Drizzle)

- Schema files live in `src/db/schema/*`; aggregated exports in `src/db/schema/index.ts`.
- Migrations are output to `migrations/` (see `drizzle.config.ts`).
- Driver: Neon (`drizzle-orm/neon-http`). `DATABASE_URL` must be set.
- Typical flow:
  1. Edit schema → 2) `bun run db:generate` → 3) `bun run db:migrate` or `bun run db:push`
- Caution: For destructive changes (dropping columns, type changes), plan safe migrations and backups.

■ Authentication (better-auth)

- Server config: `src/lib/auth.ts` (Drizzle adapter + Google/GitHub OAuth, magic link, anonymous, passkey, 2FA).
- Route: `src/app/api/auth/[...all]/route.ts` exports the better-auth handler.
- Client: `src/lib/auth-client.ts` — do not change baseURL unless explicitly requested.
- Regenerate schema with `bun run auth:generate` (may overwrite `auth-schema.ts`).

■ Frontend & Styles

- Tailwind v4; keep a utility-first approach.
- shadcn/ui generated files under `src/components/ui/*` are generally not edited and are excluded from linting.
  - If changes are absolutely necessary, keep them minimal and non-breaking to component APIs.
- Shared utilities belong in `src/lib/utils.ts`; reusable logic goes under `src/lib/`.

■ Internationalization (i18n)

- Translation files are located in `messages/` directory (`en.json`, `ja.json`, etc.).
- When adding new user-facing text strings:
  1. Add the key and English text to `messages/en.json`.
  2. Add the corresponding Japanese translation to `messages/ja.json`.
  3. Ensure all translation files have the same keys.
- Use `next-intl` for translations in components (e.g., `useExtracted()` hook).
- Do not branch UI copy on locale with flags like `isJapanese` or `locale === "ja"` when `useExtracted()` can express it. Prefer translated strings and structure the JSX so ordering and wording come from translations, not locale conditionals.
- Before completing i18n-related changes, verify that all language files are in sync.

■ Directory Guidelines

- Pages/Layouts: `src/app/**`
- Shared components: `src/components/**`
- UI (generated): `src/components/ui/**`
- DB/ORM: `src/db/**`
- Auth/Client libs: `src/lib/**`
- Custom hooks: `src/hooks/**`

■ Prohibited/Use Caution

- Do not add heavyweight dependencies or change the toolchain (e.g., new formatter) without explicit approval.
- Avoid unnecessary renames of files/exports. Keep diffs minimal and targeted.
- Do not add license/copyright headers.
- Avoid destructive edits to generated files (especially `src/components/ui/*`). If required, justify and document impact.
- Never hardcode secrets. Use environment variables.

■ Validating Changes

- At minimum locally:
  - Run `bun run lint`, `bun run format`, and `bun run typecheck`.
  - Start dev: `bun dev` and open http://localhost:3000.
  - For schema changes: run `db:generate` → `db:migrate:dev` / `db:migrate` / `db:push` (requires `DATABASE_URL`).
- Tests are not set up. For riskier areas, note manual verification steps or TODOs where appropriate.
- When changing user-facing behavior, env surface, deploy, or architecture, update `README.md` / `SETUP.md` / related docs in the same change.

■ Branch / PR / Merge Policy (Agents)

Default branch for day-to-day work is **`canary`**. **`master`** is the promotion/release target.

When the user asks to commit / push / PR / merge (including phrasing like 「全commit & push & pr & instant merge」):

1. **Work branch → `canary`**
   - Create a feature/fix branch from up-to-date `canary`.
   - Commit scoped changes (conventional commits).
   - Push the branch and open a PR with **base = `canary`**.
   - If the user asked to merge (or "instant merge"), merge that PR into `canary` (delete the head branch when appropriate) and pull `canary` locally.
2. **`canary` → `master` (required promotion step)**
   - After landing work on `canary`, **always open a PR with base = `master` and head = `canary`** to promote.
   - If the user asked to merge / instant merge, merge that PR into `master` as well (do not leave promotion only on `canary`).
   - Reuse an open canary→master PR if one already exists; otherwise create one. Title/body should summarize what is being promoted.

Other rules:

- Keep changes scoped to the task. Separate incidental refactors.
- Document purpose, context, and verification steps concisely.
- Do not force-push shared branches (`canary`, `master`) unless the user explicitly requests it.
- In this environment, do not perform git commits/branching unless explicitly instructed (patches only)—except when the user asked for commit/push/PR/merge as above.

■ Communication

- Agent responses should match the user's language. Detect from recent user messages; if unclear, ask briefly.
- Code, identifiers, and file contents should be written in English unless the user explicitly requests otherwise.

■ Troubleshooting

- Build failures (React Compiler/Next canary):
  - Revisit hooks, side effects, and dependency arrays in recent changes.
  - Confirm runtime (Node 20+/Bun).
- Env validation failures: Ensure `.env` has all required keys (see `src/env.ts`).

If you need to deviate from these guidelines, propose a minimal plan first (goal/impact/alternatives) before proceeding.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
