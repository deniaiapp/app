import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";

import { auth } from "@/lib/auth";

const metadataHandler = oauthProviderAuthServerMetadata(auth);

/**
 * The Better Auth issuer includes `/api/auth` in its path. OAuth discovery
 * therefore also requires the RFC 8414 issuer-path form in addition to the
 * root alias exposed at `/.well-known/oauth-authorization-server`.
 */
export async function GET(request: Request) {
  return metadataHandler(request);
}
