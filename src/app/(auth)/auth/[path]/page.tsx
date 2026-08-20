import { viewPaths } from "@better-auth-ui/core";
import { magicLinkPlugin } from "@better-auth-ui/core/plugins/magic-link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Auth } from "@/components/auth/auth";
import { GuestSignInButton } from "@/components/guest-sign-in-button";
import { Spinner } from "@/components/ui/spinner";
import { TWO_FACTOR_VIEW_PATH } from "@/lib/auth-paths";

const magicLinkPaths = Object.values(magicLinkPlugin().viewPaths?.auth ?? {});

// Must not import path constants from "use client" modules — Server Components can
// receive client references instead of plain strings, which makes has() fail → 404.
const validAuthPaths = new Set([
  ...Object.values(viewPaths.auth),
  ...magicLinkPaths,
  TWO_FACTOR_VIEW_PATH,
]);

function AuthPageFallback() {
  return (
    <main
      className="flex min-h-screen w-full grow flex-col items-center justify-center gap-4 p-4 md:p-6"
      id="main-content"
    >
      <Spinner className="size-5" />
    </main>
  );
}

async function AuthPageContent({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;

  if (!validAuthPaths.has(path)) {
    notFound();
  }

  const showGuest = path === viewPaths.auth.signIn;

  return (
    <main
      className="flex min-h-screen w-full grow flex-col items-center justify-center gap-4 p-4 md:p-6"
      id="main-content"
    >
      <Auth path={path} />
      {showGuest ? <GuestSignInButton className="w-full max-w-sm" size="sm" /> : null}
    </main>
  );
}

export default function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  return (
    <Suspense fallback={<AuthPageFallback />}>
      <AuthPageContent params={params} />
    </Suspense>
  );
}
