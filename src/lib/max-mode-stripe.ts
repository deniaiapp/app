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
  pickLicensedSubscription,
} from "@/lib/stripe-subscriptions";

const MAX_MODE_EVENT_NAMES = {
  basic: "max_mode_basic",
  premium: "max_mode_premium",
} as const;

export type MaxModeCategory = keyof typeof MAX_MODE_EVENT_NAMES;

export type MaxModeCurrency = "usd" | "jpy";

const DEFAULT_MAX_MODE_CURRENCY: MaxModeCurrency = "usd";

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

function normalizeMaxModeCurrency(currency: string | null | undefined): MaxModeCurrency {
  return currency?.toLowerCase() === "jpy" ? "jpy" : DEFAULT_MAX_MODE_CURRENCY;
}

async function listMonthlyMaxModePrices(currency: MaxModeCurrency) {
  const lookupKeys = [maxModePriceLookupKey("basic"), maxModePriceLookupKey("premium")];
  const prices = await stripe.prices.list({
    lookup_keys: lookupKeys,
    active: true,
    expand: ["data.currency_options"],
    limit: 100,
  });

  const findPrice = (lookupKey: string) =>
    prices.data.find(
      (price) =>
        price.lookup_key === lookupKey &&
        (price.currency.toLowerCase() === currency || Boolean(price.currency_options?.[currency])),
    ) ?? null;

  const basic = findPrice(lookupKeys[0]);
  const premium = findPrice(lookupKeys[1]);
  return { basic, premium };
}

function getPriceUnitAmount(price: Stripe.Price | null, currency: MaxModeCurrency) {
  if (!price) {
    return null;
  }

  if (price.currency.toLowerCase() === currency) {
    return price.unit_amount;
  }

  return price.currency_options?.[currency]?.unit_amount ?? null;
}

export async function getMaxModePriceAmounts(currency: MaxModeCurrency) {
  try {
    const prices = await listMonthlyMaxModePrices(currency);
    return {
      basic: getPriceUnitAmount(prices.basic, currency),
      premium: getPriceUnitAmount(prices.premium, currency),
    };
  } catch {
    return { basic: null, premium: null };
  }
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

async function createMeteredOnlySubscription(
  customerId: string,
  userId: string,
  currency: MaxModeCurrency,
) {
  const prices = await listMonthlyMaxModePrices(currency);
  if (!prices.basic || !prices.premium) {
    return null;
  }

  return stripe.subscriptions.create({
    customer: customerId,
    currency,
    items: [{ price: prices.basic.id }, { price: prices.premium.id }],
    metadata: { purpose: "max_mode", userId },
  });
}

async function findExistingMaxModeSubscription(customerId: string, currency: MaxModeCurrency) {
  const listed = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
    expand: ["data.items"],
  });
  return (
    listed.data.find(
      (sub) =>
        ACTIVE_STATUSES.has(sub.status) &&
        isMaxModeOnlySubscription(sub) &&
        normalizeMaxModeCurrency(sub.currency) === currency,
    ) ?? null
  );
}

async function pruneDuplicateMaxModeHosts(customerId: string, host: Stripe.Subscription) {
  const listed = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
    expand: ["data.items"],
  });

  const cancellations: Array<ReturnType<typeof stripe.subscriptions.cancel>> = [];
  const itemDeletes: Array<ReturnType<typeof stripe.subscriptionItems.del>> = [];

  for (const sub of listed.data) {
    if (sub.id === host.id || !ACTIVE_STATUSES.has(sub.status)) {
      continue;
    }

    const subIsMaxModeOnly = isMaxModeOnlySubscription(sub);
    const hostIsMaxModeOnly = isMaxModeOnlySubscription(host);

    if (subIsMaxModeOnly && hostIsMaxModeOnly) {
      if (normalizeMaxModeCurrency(sub.currency) !== normalizeMaxModeCurrency(host.currency)) {
        cancellations.push(stripe.subscriptions.cancel(sub.id, { prorate: true }));
      }
      continue;
    }

    if (subIsMaxModeOnly && !hostIsMaxModeOnly) {
      cancellations.push(stripe.subscriptions.cancel(sub.id, { prorate: true }));
      continue;
    }

    if (!subIsMaxModeOnly && hostIsMaxModeOnly) {
      for (const item of sub.items.data) {
        if (isMeteredMaxModePrice(item.price)) {
          itemDeletes.push(
            stripe.subscriptionItems.del(item.id, { proration_behavior: "always_invoice" }),
          );
        }
      }
    }
  }

  await Promise.all([...cancellations, ...itemDeletes]);
}

async function retrieveSubscription(id: string) {
  try {
    return await stripe.subscriptions.retrieve(id, { expand: ["items"] });
  } catch {
    return null;
  }
}

export async function getMaxModeBillingCurrency(
  record: MaxModeStripeRecord,
): Promise<MaxModeCurrency> {
  if (isBillingDisabled) {
    return DEFAULT_MAX_MODE_CURRENCY;
  }

  const storedSubscription = record.stripeSubscriptionId
    ? await retrieveSubscription(record.stripeSubscriptionId)
    : null;

  if (storedSubscription && !isMaxModeOnlySubscription(storedSubscription)) {
    return normalizeMaxModeCurrency(storedSubscription.currency);
  }

  try {
    const listed = await stripe.subscriptions.list({
      customer: record.stripeCustomerId,
      status: "all",
      limit: 20,
      expand: ["data.items"],
    });
    const licensedSubscription = pickLicensedSubscription(listed.data, (status) =>
      ACTIVE_STATUSES.has(status),
    );

    return normalizeMaxModeCurrency(licensedSubscription?.currency);
  } catch {
    return DEFAULT_MAX_MODE_CURRENCY;
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
  currency: MaxModeCurrency,
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

  if (
    planIsActive &&
    planSubscription &&
    isMaxModeOnlySubscription(planSubscription) &&
    normalizeMaxModeCurrency(planSubscription.currency) === currency
  ) {
    return planSubscription;
  }

  const existing = await findExistingMaxModeSubscription(record.stripeCustomerId, currency);
  if (existing) {
    return existing;
  }

  try {
    const created = await createMeteredOnlySubscription(record.stripeCustomerId, userId, currency);
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

  const currency = await getMaxModeBillingCurrency(record);
  const host = await resolveMaxModeHostSubscription(record, userId, currency);
  if ("error" in host) {
    return { ok: false, error: host.error };
  }

  const prices = await listMonthlyMaxModePrices(currency);
  if (!prices.basic || !prices.premium) {
    return {
      ok: false,
      error:
        "Max Mode prices are not configured in Stripe. Add lookup keys max_mode_basic_month and max_mode_premium_month (see SETUP.md).",
    };
  }

  const keepLookupKeys = new Set([prices.basic.lookup_key, prices.premium.lookup_key]);
  const staleItemDeletes: Array<ReturnType<typeof stripe.subscriptionItems.del>> = [];
  for (const item of host.items.data) {
    if (isMeteredMaxModePrice(item.price) && !keepLookupKeys.has(item.price.lookup_key)) {
      staleItemDeletes.push(
        stripe.subscriptionItems.del(item.id, { proration_behavior: "always_invoice" }),
      );
    }
  }
  await Promise.all(staleItemDeletes);

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
