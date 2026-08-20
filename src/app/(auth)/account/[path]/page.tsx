import { ensureSessionServer } from "@better-auth-ui/core/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { connection } from "next/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Settings } from "@/components/auth/settings/settings";
import Footer from "@/components/footer";
import Header from "@/components/header";
import { Spinner } from "@/components/ui/spinner";
import { auth } from "@/lib/auth";
import { getQueryClient } from "@/lib/query-client";

/** Matches AuthProvider viewPaths.settings override (account → "settings"). */
const ACCOUNT_SETTINGS_PATHS = ["settings", "security"] as const;

function AccountPageFallback() {
  return (
    <main className="flex min-h-[50vh] items-center justify-center pt-24" id="main-content">
      <Spinner className="size-5" />
    </main>
  );
}

async function AccountPageContent({ params }: { params: Promise<{ path: string }> }) {
  // Defer session/DB work past Cache Components prerender (request-time only).
  await connection();

  const { path } = await params;

  if (!(ACCOUNT_SETTINGS_PATHS as readonly string[]).includes(path)) {
    notFound();
  }

  const requestHeaders = await headers();
  const queryClient = getQueryClient();

  const session = await ensureSessionServer(queryClient, auth, {
    headers: requestHeaders,
  });

  if (!session) {
    redirect(`/auth/sign-in?redirectTo=${encodeURIComponent(`/account/${path}`)}`);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="pt-24" id="main-content">
        <Header />
        <div className="mx-auto w-full max-w-3xl px-8 pb-12">
          <Settings path={path} />
        </div>
        <Footer />
      </main>
    </HydrationBoundary>
  );
}

export default function AccountPage({ params }: { params: Promise<{ path: string }> }) {
  return (
    <Suspense fallback={<AccountPageFallback />}>
      <AccountPageContent params={params} />
    </Suspense>
  );
}
