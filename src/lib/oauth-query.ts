import { constantTimeEqual, makeSignature } from "better-auth/crypto";

import { env } from "@/env";

/**
 * Recreate Better Auth OAuth Provider's canonical query ordering.
 *
 * The OAuth provider signs every authorization query before redirecting to a
 * login or consent page. Keeping this verification at the page boundary lets
 * the consent UI display the same scopes that the consent endpoint will use.
 */
function canonicalizeQuery(params: URLSearchParams): URLSearchParams {
  const canonical = new URLSearchParams();
  const entries = [...params.entries()].sort(([keyA, valueA], [keyB, valueB]) => {
    if (keyA < keyB) return -1;
    if (keyA > keyB) return 1;
    if (valueA < valueB) return -1;
    if (valueA > valueB) return 1;
    return 0;
  });

  for (const [key, value] of entries) {
    canonical.append(key, value);
  }

  return canonical;
}

/**
 * Verify a signed OAuth Provider redirect query and return its parameters.
 * Returns null for tampered or expired queries.
 */
export async function verifyOAuthQuery(query: string): Promise<URLSearchParams | null> {
  const params = new URLSearchParams(query);
  const signatures = params.getAll("sig");
  const signature = params.get("sig");
  const expiresAt = Number(params.get("exp"));

  if (signatures.length !== 1 || !signature || !Number.isFinite(expiresAt)) {
    return null;
  }

  params.delete("sig");
  const expectedSignature = await makeSignature(
    canonicalizeQuery(params).toString(),
    env.BETTER_AUTH_SECRET,
  );

  if (
    !constantTimeEqual(signature, expectedSignature) ||
    new Date(expiresAt * 1_000).getTime() < Date.now()
  ) {
    return null;
  }

  params.set("sig", signature);
  return params;
}
