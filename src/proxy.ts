import { type NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "better-auth.session_token";
const SECURE_SESSION_COOKIE = `__Secure-${SESSION_COOKIE}`;
const LOCALE_COOKIE = "locale";

function hasSessionCookie(request: NextRequest) {
  return request.cookies.has(SESSION_COOKIE) || request.cookies.has(SECURE_SESSION_COOKIE);
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Root path: redirect based on session cookie presence.
  // This is a lightweight heuristic — it checks cookie presence, not validity.
  // An expired or invalid cookie will redirect to /chat, where full server-side
  // auth validation occurs and handles the session properly.
  if (pathname === "/") {
    const destination = hasSessionCookie(request) ? "/chat" : "/home";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  // Chat is hosted outside layout RequireAuth (SPA ChatRouteHost). Gate here so
  // unauthenticated document/RSC requests never receive the chat shell.
  if (pathname === "/chat" || pathname.startsWith("/chat/")) {
    if (!hasSessionCookie(request)) {
      const destination = new URL("/auth/sign-in", request.url);
      destination.searchParams.set("redirectTo", `${pathname}${search}`);
      return NextResponse.redirect(destination);
    }
  }

  // Marketing pages: propagate locale via response header for CDN Vary caching
  const response = NextResponse.next();
  const locale = request.cookies.get(LOCALE_COOKIE)?.value;

  if (locale === "en" || locale === "ja") {
    response.headers.set("x-locale", locale);
  } else {
    // Fallback: parse Accept-Language for ja, default to en
    const acceptLang = request.headers.get("accept-language") ?? "";
    const isJa = acceptLang.split(",").some((entry) => entry.trim().toLowerCase().startsWith("ja"));
    response.headers.set("x-locale", isJa ? "ja" : "en");
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/chat",
    "/chat/:path*",
    "/home",
    "/about",
    "/models",
    "/flixa",
    "/legal/:path*",
    "/migration",
  ],
};
