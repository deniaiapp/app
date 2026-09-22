"use client";

import { loadStripe } from "@stripe/stripe-js";
import { clientEnv } from "@/env.client";

export const stripeJsPromise = clientEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(clientEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;
