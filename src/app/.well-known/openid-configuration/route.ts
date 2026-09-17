import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";

import { auth } from "@/lib/auth";

const metadataHandler = oauthProviderOpenIdConfigMetadata(auth);

export async function GET(request: Request) {
  return metadataHandler(request);
}
