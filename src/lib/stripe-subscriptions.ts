import type Stripe from "stripe";

type SubscriptionLike =
  | Stripe.Subscription
  | Stripe.Response<Stripe.Subscription>
  | null
  | undefined;

export function isMaxModeLookupKey(lookupKey: string | null | undefined): boolean {
  return Boolean(lookupKey?.startsWith("max_mode_"));
}

export function isMeteredMaxModePrice(price: Stripe.Price | null | undefined): boolean {
  return isMaxModeLookupKey(price?.lookup_key);
}

/** The licensed (seat/plan) item, ignoring Max Mode metered add-ons. */
export function getLicensedSubscriptionItem(subscription: SubscriptionLike) {
  const items = subscription?.items.data ?? [];
  return items.find((item) => !isMeteredMaxModePrice(item.price)) ?? null;
}

export function getLicensedPrice(subscription: SubscriptionLike): Stripe.Price | null {
  const price = getLicensedSubscriptionItem(subscription)?.price;
  return price && typeof price !== "string" ? price : null;
}

/** A Max Mode-only subscription (monthly meters, no plan). Must not be treated as the plan. */
export function isMaxModeOnlySubscription(subscription: SubscriptionLike): boolean {
  if (!subscription) {
    return false;
  }
  if (subscription.metadata?.purpose === "max_mode") {
    return true;
  }
  const items = subscription.items.data;
  return items.length > 0 && items.every((item) => isMeteredMaxModePrice(item.price));
}

export function pickLicensedSubscription<T extends Stripe.Subscription>(
  subscriptions: T[],
  isPreferredStatus: (status: string) => boolean,
): T | null {
  const licensed = subscriptions.filter((sub) => !isMaxModeOnlySubscription(sub));
  return licensed.find((sub) => isPreferredStatus(sub.status)) ?? licensed.at(0) ?? null;
}

export function getSubscriptionPeriodEnd(subscription: SubscriptionLike): number | null {
  const item = getLicensedSubscriptionItem(subscription) ?? subscription?.items.data[0];

  return item?.current_period_end || null;
}

export function getSubscriptionPeriodEndDate(subscription: SubscriptionLike): Date | null {
  const periodEnd = getSubscriptionPeriodEnd(subscription);

  return periodEnd ? new Date(Math.floor(periodEnd * 1000)) : null;
}
