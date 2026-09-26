import { env } from "@/env";

/** Compare against the public origin, not request.url (which may contain an internal proxy host). */
export function isAllowedAdOrigin(request: Request) {
  return request.headers.get("origin") === new URL(env.NEXT_PUBLIC_BETTER_AUTH_URL).origin;
}
