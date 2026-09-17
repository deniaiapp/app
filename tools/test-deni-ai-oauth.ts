/**
 * Development-only integration test for Sign in with Deni AI.
 *
 * It creates a temporary verified user and public OAuth client in the
 * `.env.local` database, walks through authorize -> consent -> token, calls
 * UserInfo, and removes the temporary user (and cascaded OAuth records).
 */

const optionalProviderKeys = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "TURNSTILE_SECRET_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
] as const;
for (const key of optionalProviderKeys) delete process.env[key];

const { auth } = await import("../src/lib/auth");
const { db } = await import("../src/db/drizzle");
const schema = await import("../src/db/schema");
const { eq } = await import("drizzle-orm");

const origin = new URL(process.env.DENI_AI_ORIGIN ?? "http://localhost:3000");
origin.pathname = origin.pathname.replace(/\/$/, "");
const redirectUri = "http://127.0.0.1:8787/callback";
const stamp = Date.now();
const email = `oauth-integration-${stamp}@outlook.com`;
let userId: string | undefined;

function cookieHeader(setCookie: string | null): string {
  const cookie = setCookie?.match(/(?:^|,\s*)better-auth\.session_token=([^;]+)/)?.[1];
  if (!cookie) throw new Error("Sign-up response did not include a session cookie");
  return `better-auth.session_token=${cookie}`;
}

function randomString(byteLength = 32): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(byteLength))).toString("base64url");
}

async function jsonResponse(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

try {
  const password = `Qx9!mR7#tV3@kP6%wN8^${stamp}Zz`;
  const signUp = await auth.api.signUpEmail({
    body: { name: "OAuth Integration User", email, password, rememberMe: true },
    returnHeaders: true,
  });
  userId = signUp.response.user.id;
  const cookie = cookieHeader(signUp.headers.get("set-cookie"));
  const sessionHeaders = new Headers({ cookie });

  const client = await auth.api.createOAuthClient({
    body: {
      client_name: "Deni AI OAuth Integration Test",
      client_uri: "http://127.0.0.1:8787",
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "openid profile email offline_access",
      application_type: "native",
      require_pkce: true,
    },
    headers: sessionHeaders,
  });
  if (!client.client_id) throw new Error("OAuth client registration did not return client_id");

  const verifier = randomString(32);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = Buffer.from(digest).toString("base64url");
  const state = randomString(24);
  const authorizationUrl = new URL("/api/auth/oauth2/authorize", origin);
  authorizationUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: client.client_id,
    redirect_uri: redirectUri,
    scope: "openid profile email offline_access",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  const authorizationResponse = await fetch(authorizationUrl, {
    redirect: "manual",
    headers: { cookie, accept: "text/html", "sec-fetch-mode": "navigate" },
  });
  const consentLocation = authorizationResponse.headers.get("location");
  if (
    authorizationResponse.status < 300 ||
    authorizationResponse.status >= 400 ||
    !consentLocation
  ) {
    throw new Error(`Expected consent redirect, got ${authorizationResponse.status}`);
  }
  const consentUrl = new URL(consentLocation, origin);
  if (consentUrl.pathname !== "/oauth/consent") {
    throw new Error(`Expected /oauth/consent, got ${consentUrl.pathname}`);
  }

  const consentResponse = await fetch(new URL("/api/auth/oauth2/consent", origin), {
    method: "POST",
    headers: {
      cookie,
      origin: origin.origin,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ accept: true, oauth_query: consentUrl.search.slice(1) }),
  });
  const consent = await jsonResponse(consentResponse);
  if (!consentResponse.ok) {
    throw new Error(
      `Consent request failed (${consentResponse.status}): ${JSON.stringify(consent)}`,
    );
  }
  const consentRedirect =
    typeof consent.url === "string"
      ? consent.url
      : typeof consent.redirect_uri === "string"
        ? consent.redirect_uri
        : undefined;
  if (!consentRedirect) {
    throw new Error(`Consent response did not include a redirect URL: ${JSON.stringify(consent)}`);
  }
  const callbackUrl = new URL(consentRedirect);
  const code = callbackUrl.searchParams.get("code");
  if (!code || callbackUrl.searchParams.get("state") !== state) {
    throw new Error("Consent response did not contain the expected authorization code/state");
  }

  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: client.client_id,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  const tokenResponse = await fetch(new URL("/api/auth/oauth2/token", origin), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  const token = await jsonResponse(tokenResponse);
  if (!tokenResponse.ok || typeof token.access_token !== "string") {
    throw new Error(`Token exchange failed (${tokenResponse.status}): ${JSON.stringify(token)}`);
  }

  const userInfoResponse = await fetch(new URL("/api/auth/oauth2/userinfo", origin), {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  const userInfo = await jsonResponse(userInfoResponse);
  if (!userInfoResponse.ok || userInfo.email !== email) {
    throw new Error(`UserInfo failed (${userInfoResponse.status}): ${JSON.stringify(userInfo)}`);
  }

  if (typeof token.refresh_token !== "string") {
    throw new Error("Token response did not include refresh_token for offline_access");
  }
  const refreshBody = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: token.refresh_token,
    client_id: client.client_id,
  });
  const refreshResponse = await fetch(new URL("/api/auth/oauth2/token", origin), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: refreshBody,
  });
  const refreshed = await jsonResponse(refreshResponse);
  if (!refreshResponse.ok || typeof refreshed.access_token !== "string") {
    throw new Error(
      `Refresh exchange failed (${refreshResponse.status}): ${JSON.stringify(refreshed)}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        authorizationStatus: authorizationResponse.status,
        consentRedirect: true,
        authorizationCodeExchanged: true,
        userInfoMatched: userInfo.email === email,
        refreshTokenExchanged: true,
      },
      null,
      2,
    ),
  );
} finally {
  if (userId) {
    await db.delete(schema.user).where(eq(schema.user.id, userId));
  }
}
