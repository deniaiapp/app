import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";

import { auth } from "@/lib/auth";

const metadataHandler = oauthProviderAuthServerMetadata(auth);

export async function GET(request: Request) {
  return metadataHandler(request);
}
