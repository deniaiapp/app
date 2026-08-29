# Deni AI

> **AI Chatbot for Everyone** — access modern AI models in one place

Deni AI is a multi-model AI chat app for people who want strong model choice without juggling many separate subscriptions. It supports OpenAI, Anthropic, Google, Groq, xAI, and more via platform keys or bring-your-own-key (BYOK).

**Live app:** [https://deniai.app](https://deniai.app)

## Features

- **Multi-model chat** — switch between OpenAI, Claude, Gemini, Groq, xAI, and other routed models
- **BYOK** — connect your own provider API keys (encrypted at rest); BYOK usage is not counted against platform limits
- **Tools** — web search (Exa), page browse, image generation, and video (Veo) where enabled
- **Memory & projects** — personalization memories and project-scoped context; projects can be shared with a team
- **Teams** — organizations, seats, shared Pro access, and team projects
- **Billing** — Stripe subscriptions (personal and team) plus Max Mode metered overage; optional self-host disable via `NEXT_PUBLIC_BILLING_DISABLED`
- **Affiliate referrals** — shareable invite links, QR codes, milestone reset credits, and selectable paid-plan rewards (three resets or a manually sent 30% OFF coupon)
- **Auth** — Google / GitHub OAuth, magic link, anonymous guest, passkeys, and 2FA (better-auth)
- **i18n** — English and Japanese (`next-intl`)
- **Public guides & blog** — original articles on model choice, verification, and practical AI use, available without an account
- **PWA** — installable progressive web app assets and service worker

## Tech stack

| Area      | Choice                                            |
| --------- | ------------------------------------------------- |
| Framework | Next.js 16 (App Router, React 19, React Compiler) |
| Language  | TypeScript (strict)                               |
| Runtime   | Bun (preferred) or Node.js 20+                    |
| UI        | Tailwind CSS v4, shadcn/ui (Base UI)              |
| API       | tRPC + TanStack Query                             |
| DB        | PostgreSQL (Neon recommended) + Drizzle ORM       |
| Auth      | better-auth                                       |
| Billing   | Stripe                                            |
| AI        | Vercel AI SDK + provider SDKs / OpenRouter        |

## Quick start

```bash
# Clone
git clone https://github.com/deniaiapp/app.git
cd deni-ai

# Install
bun install

# Configure (copy example and fill the core values plus any optional features)
cp .env.example .env

# Database
bun run db:migrate:dev   # local: uses .env.local
# or: bun run db:push

# Dev server → http://localhost:3000
bun dev
```

Full prerequisites, environment variables, Stripe, OAuth, and deployment steps: **[SETUP.md](SETUP.md)**.

**Self-hosting database:** we recommend [Neon](https://neon.tech). The app is already wired for Neon serverless Postgres.

## Documentation

| Doc                                      | Purpose                                               |
| ---------------------------------------- | ----------------------------------------------------- |
| [SETUP.md](SETUP.md)                     | Env vars, database, Stripe, Docker / Dokploy, scripts |
| [CONTRIBUTING.md](CONTRIBUTING.md)       | Contributor workflow and coding standards             |
| [SECURITY.md](SECURITY.md)               | Vulnerability reporting                               |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community guidelines                                  |
| [AGENTS.md](AGENTS.md)                   | Agent / AI-assisted development guide                 |

## Project layout (high level)

```
src/
  app/           # Next.js App Router (marketing, chat, settings, API)
  components/    # UI, chat, auth, billing, team
  db/schema/     # Drizzle schemas
  lib/           # Auth, billing, chat, tools, providers
  server/api/    # tRPC routers
messages/        # en.json, ja.json
migrations/      # Drizzle SQL migrations
packages/        # Workspace packages (e.g. disposable-email-domains)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Day-to-day development targets the **`canary`** branch; **`master`** is the release/promotion target.

```bash
bun run lint
bun run format
bun run typecheck
bun run build
```

## License

MIT License — see [LICENSE](LICENSE).

## Sponsors

If Deni AI is useful to you, consider supporting development on GitHub Sponsors:

[https://github.com/sponsors/raicdev](https://github.com/sponsors/raicdev)

Sponsorships help cover hosting, infrastructure, and ongoing maintenance so we can keep improving free and accessible AI chat.

## Support

For issues, questions, or suggestions, please open a GitHub [issue](https://github.com/deniaiapp/app/issues) or [discussion](https://github.com/deniaiapp/app/discussions).

Security vulnerabilities: report privately per [SECURITY.md](SECURITY.md) — do not use public issues.
