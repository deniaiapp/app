import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { billing } from "@/db/schema";
import { isBillingDisabled } from "@/lib/billing-config";
import { stripe } from "@/lib/stripe";
import {
  getLicensedPrice,
  isMaxModeOnlySubscription,
  isMeteredMaxModePrice,
} from "@/lib/stripe-subscriptions";

export const MAX_MODE_EVENT_NAMES = {
  basic: "max_mode_basic",
  premium: "max_mode_premium",
} as const;

export type MaxModeCategory = keyof typeof MAX_MODE_EVENT_NAMES;

/** Max Mode overage is always invoiced monthly, including on yearly plans. */
export function maxModePriceLookupKey(category: MaxModeCategory) {
  return `max_mode_${category}_month`;
}

export type MaxModeStripeRecord = {
  id: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  stripeMeteredBasicItemId: string | null;
  stripeMeteredPremiumItemId: string | null;
};

type AttachResult =
  | {
      ok: true;
      subscriptionId: string;
      basicItemId: string;
      premiumItemId: string;
    }
  | { ok: false; error: string };

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

async function listMonthlyMaxModePrices() {
  const lookupKeys = [maxModePriceLookupKey("basic"), maxModePriceLookupKey("premium")];
  const prices = await stripe.prices.list({
    lookup_keys: lookupKeys,
    active: true,
    limit: 4,
  });
  const basic = prices.data.find((price) => price.lookup_key === lookupKeys[0]) ?? null;
  const premium = prices.data.find((price) => price.lookup_key === lookupKeys[1]) ?? null;
  return { basic, premium };
}

function findMeteredItem(subscription: Stripe.Subscription, lookupKey: string) {
  return subscription.items.data.find((item) => item.price?.lookup_key === lookupKey) ?? null;
}

function licensedInterval(subscription: Stripe.Subscription): "month" | "year" | "other" | null {
  const interval = getLicensedPrice(subscription)?.recurring?.interval;
  if (!interval) {
    return null;
  }
  if (interval === "month") {
    return "month";
  }
  if (interval === "year") {
    return "year";
  }
  return "other";
}

async function ensureSubscriptionItem(
  subscription: Stripe.Subscription,
  price: Stripe.Price,
): Promise<string> {
  const lookupKey = price.lookup_key ?? "";
  const existing = findMeteredItem(subscription, lookupKey);
  if (existing?.price?.id === price.id) {
    return existing.id;
  }

  if (existing) {
    await stripe.subscriptionItems.del(existing.id, { proration_behavior: "always_invoice" });
  }

  const created = await stripe.subscriptionItems.create({
    subscription: subscription.id,
    price: price.id,
  });
  return created.id;
}

async function createMeteredOnlySubscription(customerId: string, userId: string) {
  const prices = await listMonthlyMaxModePrices();
  if (!prices.basic || !prices.premium) {
    return null;
  }

  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: prices.basic.id }, { price: prices.premium.id }],
    metadata: { purpose: "max_mode", userId },
  });
}

async function findExistingMaxModeSubscription(customerId: string) {
  const listed = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
    expand: ["data.items"],
  });
  return (
    listed.data.find((sub) => ACTIVE_STATUSES.has(sub.status) && isMaxModeOnlySubscription(sub)) ??
    null
  );
}

async function pruneDuplicateMaxModeHosts(customerId: string, host: Stripe.Subscription) {
  const listed = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
    expand: ["data.items"],
  });

  for (const sub of listed.data) {
    if (sub.id === host.id || !ACTIVE_STATUSES.has(sub.status)) {
      continue;
    }

    if (isMaxModeOnlySubscription(sub) && !isMaxModeOnlySubscription(host)) {
      await stripe.subscriptions.cancel(sub.id, { prorate: true });
      continue;
    }

    if (!isMaxModeOnlySubscription(sub) && isMaxModeOnlySubscription(host)) {
      for (const item of sub.items.data) {
        if (isMeteredMaxModePrice(item.price)) {
          await stripe.subscriptionItems.del(item.id, { proration_behavior: "always_invoice" });
        }
      }
    }
  }
}

async function retrieveSubscription(id: string) {
  try {
    return await stripe.subscriptions.retrieve(id, { expand: ["items"] });
  } catch {
    return null;
  }
}

/**
 * Host Max Mode meters on a monthly Stripe subscription.
 * Monthly plans reuse the plan subscription; yearly (and other) plans get a
 * separate monthly Max Mode subscription so overage invoices monthly.
 */
async function resolveMaxModeHostSubscription(
  record: MaxModeStripeRecord,
  userId: string,
): Promise<Stripe.Subscription | { error: string }> {
  const planSubscription = record.stripeSubscriptionId
    ? await retrieveSubscription(record.stripeSubscriptionId)
    : null;
  const planIsActive = planSubscription !== null && ACTIVE_STATUSES.has(planSubscription.status);

  if (planIsActive && planSubscription && !isMaxModeOnlySubscription(planSubscription)) {
    if (licensedInterval(planSubscription) === "month") {
      return planSubscription;
    }
  }

  if (planIsActive && planSubscription && isMaxModeOnlySubscription(planSubscription)) {
    return planSubscription;
  }

  const existing = await findExistingMaxModeSubscription(record.stripeCustomerId);
  if (existing) {
    return existing;
  }

  try {
    const created = await createMeteredOnlySubscription(record.stripeCustomerId, userId);
    if (!created) {
      return {
        error:
          "Max Mode prices are not configured in Stripe. Add lookup keys max_mode_basic_month and max_mode_premium_month (see SETUP.md).",
      };
    }
    return created;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to start Max Mode billing.",
    };
  }
}

/**
 * Attach monthly Max Mode metered prices so meter events invoice.
 * Yearly plan subscriptions are left unchanged; meters live on a monthly sub.
 */
export async function attachMaxModeMeteredItems(
  record: MaxModeStripeRecord,
  userId: string,
): Promise<AttachResult> {
  if (isBillingDisabled) {
    return { ok: false, error: "Billing is disabled." };
  }

  if (!record.stripeCustomerId) {
    return { ok: false, error: "No Stripe customer is linked to this account." };
  }

  const host = await resolveMaxModeHostSubscription(record, userId);
  if ("error" in host) {
    return { ok: false, error: host.error };
  }

  const prices = await listMonthlyMaxModePrices();
  if (!prices.basic || !prices.premium) {
    return {
      ok: false,
      error:
        "Max Mode prices are not configured in Stripe. Add lookup keys max_mode_basic_month and max_mode_premium_month (see SETUP.md).",
    };
  }

  const keepLookupKeys = new Set([prices.basic.lookup_key, prices.premium.lookup_key]);
  for (const item of host.items.data) {
    if (isMeteredMaxModePrice(item.price) && !keepLookupKeys.has(item.price.lookup_key)) {
      await stripe.subscriptionItems.del(item.id, { proration_behavior: "always_invoice" });
    }
  }

  try {
    const fresh = await stripe.subscriptions.retrieve(host.id, { expand: ["items"] });
    const [basicItemId, premiumItemId] = await Promise.all([
      ensureSubscriptionItem(fresh, prices.basic),
      ensureSubscriptionItem(fresh, prices.premium),
    ]);

    await pruneDuplicateMaxModeHosts(record.stripeCustomerId, fresh);

    const storedPlan = record.stripeSubscriptionId
      ? await retrieveSubscription(record.stripeSubscriptionId)
      : null;
    const keepPlanSubscriptionId =
      storedPlan !== null && !isMaxModeOnlySubscription(storedPlan) && host.id !== storedPlan.id;
    const planSubscriptionId = keepPlanSubscriptionId ? storedPlan.id : host.id;

    await db
      .update(billing)
      .set({
        stripeSubscriptionId: planSubscriptionId,
        stripeMeteredBasicItemId: basicItemId,
        stripeMeteredPremiumItemId: premiumItemId,
        updatedAt: new Date(),
      })
      .where(eq(billing.id, record.id));

    return {
      ok: true,
      subscriptionId: planSubscriptionId,
      basicItemId,
      premiumItemId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to attach Max Mode prices.";
    return { ok: false, error: message };
  }
}
