/**
 * Public environment values for Client Components.
 *
 * Keep this module free of runtime validation dependencies. The validated
 * server/client environment lives in `src/env.ts`; importing that module from
 * a Client Component would add the full Zod schema to the browser bundle.
 */
export const clientEnv = {
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  NEXT_PUBLIC_ADSENSE_CLIENT_ID: process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID,
  NEXT_PUBLIC_ADSENSE_CHAT_SLOT_ID: process.env.NEXT_PUBLIC_ADSENSE_CHAT_SLOT_ID,
} as const;
