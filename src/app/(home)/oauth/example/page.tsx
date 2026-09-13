import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { ArrowRight, Check, Route, Fingerprint, Lock, RefreshCw, Terminal } from "lucide-react";

import { OAuthExampleClient } from "@/components/oauth/oauth-example-client";
import { publicAlternates } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  const title = t("Sign in with Deni AI");
  const description = t("A working OAuth 2.1 and OpenID Connect example for Deni AI.");

  return {
    title,
    description,
    alternates: await publicAlternates("/oauth/example"),
    openGraph: { title: `${title} — Deni AI`, description },
    twitter: { title: `${title} | Deni AI`, description },
  };
}

export default async function OAuthExamplePage() {
  const t = await getExtracted();
  const flowSteps = [
    {
      icon: Route,
      number: "01",
      title: t("Discover"),
      body: t("Read the issuer metadata and learn which endpoints and scopes are available."),
    },
    {
      icon: Lock,
      number: "02",
      title: t("Authorize"),
      body: t("Send the user to Deni AI with a one-time state value and S256 PKCE challenge."),
    },
    {
      icon: RefreshCw,
      number: "03",
      title: t("Exchange"),
      body: t("Trade the one-time authorization code for access and refresh tokens."),
    },
    {
      icon: Fingerprint,
      number: "04",
      title: t("Identify"),
      body: t("Call UserInfo with the access token and create the app session."),
    },
  ];
  const endpointRows = [
    { label: t("Authorization"), endpoint: "/api/auth/oauth2/authorize" },
    { label: t("Token"), endpoint: "/api/auth/oauth2/token" },
    { label: t("UserInfo"), endpoint: "/api/auth/oauth2/userinfo" },
    { label: t("Discovery"), endpoint: "/.well-known/openid-configuration" },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-background" id="main-content">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(circle_at_50%_0%,hsl(42_96%_64%/0.16),transparent_56%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(hsl(var(--foreground))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground))_1px,transparent_1px)] [background-size:52px_52px]" />

      <section className="relative px-4 pb-14 pt-32 md:pb-20 md:pt-40">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground shadow-sm backdrop-blur">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {t("OAuth playground")}
            </div>
            <h1 className="mt-7 max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl md:text-7xl md:leading-[0.98]">
              {t("Sign in with Deni AI")}
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
              {t("A calm, standards-based path from consent to identity.")}
            </p>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground/80">
              {t(
                "Build login with a provider your users already trust. This page is a working public-client example built on OAuth 2.1, OpenID Connect, and S256 PKCE.",
              )}
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {["OAuth 2.1", "OpenID Connect", "S256 PKCE"].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-border/70 bg-card/60 px-3 py-1.5 font-mono text-xs text-muted-foreground"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative px-4 pb-20 md:pb-28">
        <div className="mx-auto max-w-6xl">
          <OAuthExampleClient />
        </div>
      </section>

      <section className="relative border-y border-border/70 bg-card/30 px-4 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground/70">
                {t("The flow")}
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
                {t("Four quiet steps between click and session")}
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-7 text-muted-foreground">
              {t(
                "The protocol does the heavy lifting. Your app keeps the state, verifies the response, and decides what to do with the identity.",
              )}
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {flowSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <article
                  key={step.number}
                  className="group relative rounded-[1.5rem] border border-border/70 bg-background/80 p-5 transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground/60">
                      {step.number}
                    </span>
                    <span className="flex size-9 items-center justify-center rounded-xl bg-secondary">
                      <Icon className="size-4" />
                    </span>
                  </div>
                  <h3 className="mt-8 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.body}</p>
                  {index < flowSteps.length - 1 ? (
                    <ArrowRight
                      className="absolute -right-3 top-1/2 z-10 hidden size-5 -translate-y-1/2 text-muted-foreground/50 md:block"
                      aria-hidden="true"
                    />
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative px-4 py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[1.75rem] border border-border/70 bg-foreground p-7 text-background md:p-9">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-background/10">
              <Terminal className="size-5" />
            </div>
            <p className="mt-7 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-background/50">
              {t("A small client surface")}
            </p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
              {t("Keep the integration legible")}
            </h2>
            <p className="mt-4 text-sm leading-7 text-background/65">
              {t(
                "The example separates browser state, authorization, token exchange, and identity lookup so each security decision is visible in code review.",
              )}
            </p>
            <pre className="mt-8 overflow-x-auto rounded-2xl border border-background/10 bg-background/10 p-4 font-mono text-xs leading-6 text-background/75">
              <code>{`const discovery = "/.well-known/openid-configuration";
const authorize = "/api/auth/oauth2/authorize";
const token = "/api/auth/oauth2/token";
const userInfo = "/api/auth/oauth2/userinfo";`}</code>
            </pre>
          </div>

          <div className="rounded-[1.75rem] border border-border/70 bg-card p-7 md:p-9">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-secondary">
                <Check className="size-5" />
              </span>
              <div>
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground/70">
                  {t("Protocol surface")}
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  {t("Everything an app needs to begin")}
                </h2>
              </div>
            </div>
            <div className="mt-8 divide-y divide-border/70 rounded-2xl border border-border/70">
              {endpointRows.map(({ label, endpoint }) => (
                <div
                  key={label}
                  className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <span className="text-sm font-medium">{label}</span>
                  <code className="font-mono text-xs text-muted-foreground">{endpoint}</code>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm leading-7 text-muted-foreground">
              {t(
                "Supported scopes: openid, profile, email, and offline_access. Register a public client with an exact callback URL before starting the live flow.",
              )}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
