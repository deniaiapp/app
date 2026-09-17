import { connection } from "next/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { OAuthConsent } from "@/components/auth/oauth-consent";
import { Spinner } from "@/components/ui/spinner";
import { auth } from "@/lib/auth";
import { verifyOAuthQuery } from "@/lib/oauth-query";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

type ConsentPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function toQueryString(params: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }
  return query.toString();
}

function safeClientUri(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  try {
    const uri = new URL(value);
    const isLoopbackHttp =
      uri.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(uri.hostname);
    if ((uri.protocol !== "https:" && !isLoopbackHttp) || uri.username || uri.password) {
      return undefined;
    }
    return uri.toString();
  } catch {
    return undefined;
  }
}

function OAuthConsentPageFallback() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center p-4" id="main-content">
      <Spinner className="size-5" />
    </main>
  );
}

async function OAuthConsentPageContent({ searchParams }: ConsentPageProps) {
  await connection();

  const params = await searchParams;
  const signedParams = await verifyOAuthQuery(toQueryString(params));
  const clientId = signedParams?.get("client_id");
  if (!signedParams || !clientId) notFound();

  const requestHeaders = await headers();
  const client = await auth.api.getOAuthClientPublic({
    query: { client_id: clientId },
    headers: requestHeaders,
  });
  const requestedScopes = (signedParams.get("scope") ?? "")
    .split(" ")
    .map((scope) => scope.trim())
    .filter(Boolean);

  return (
    <main
      className="flex min-h-screen w-full grow flex-col items-center justify-center gap-4 p-4 md:p-6"
      id="main-content"
    >
      <OAuthConsent
        clientName={stringValue(client.client_name)?.trim()}
        clientUri={safeClientUri(stringValue(client.client_uri)?.trim())}
        requestedScopes={requestedScopes}
      />
    </main>
  );
}

export default function OAuthConsentPage({ searchParams }: ConsentPageProps) {
  return (
    <Suspense fallback={<OAuthConsentPageFallback />}>
      <OAuthConsentPageContent searchParams={searchParams} />
    </Suspense>
  );
}
