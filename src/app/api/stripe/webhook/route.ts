import { and, eq, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/db/drizzle";
import { billing } from "@/db/schema";
import { env } from "@/env";
import { findPlanByLookupKey, isTeamPlan } from "@/lib/billing";
import { getBillingFingerprintUpdates } from "@/lib/billing-card-usage";
import { isAffiliatePaidStatus, processAffiliatePurchase } from "@/lib/affiliate";
import { resetMaxModeUsage } from "@/lib/max-mode";
import { stripe } from "@/lib/stripe";
import { getSubscriptionPeriodEnd } from "@/lib/stripe-subscriptions";
import { cancelOrgMembersPersonalSubscriptions } from "@/lib/team-billing";

type SubscriptionPayload = {
  userId: string;
  customerId: string;
  subscriptionId: string;
  lookupKey: string | null | undefined;
  priceId: string | null | undefined;
  status: string | null;
  currentPeriodEnd: number | null;
  organizationId?: string | null;
};

async function saveSubscription(payload: SubscriptionPayload) {
  const plan = findPlanByLookupKey(payload.lookupKey ?? undefined);
  const organizationId = payload.organizationId ?? null;
  const fingerprintUpdates = await getBillingFingerprintUpdates({
    customerId: payload.customerId,
    subscriptionId: payload.subscriptionId,
    markTrialUsed: payload.status === "trialing",
  });

  const whereClause = organizationId
    ? and(eq(billing.userId, payload.userId), eq(billing.organizationId, organizationId))
    : and(eq(billing.userId, payload.userId), isNull(billing.organizationId));

  const [existingRecord] = await db
    .select({
      currentPeriodEnd: billing.currentPeriodEnd,
      firstPaidAt: billing.firstPaidAt,
      maxModeEnabled: billing.maxModeEnabled,
    })
    .from(billing)
    .where(whereClause)
    .limit(1);

  const updates = {
    stripeCustomerId: payload.customerId,
    stripeSubscriptionId: payload.subscriptionId,
    priceId: payload.priceId ?? null,
    planId: plan?.id ?? null,
    status: payload.status ?? null,
    mode: "subscription" as const,
    currentPeriodEnd: payload.currentPeriodEnd ? new Date(payload.currentPeriodEnd * 1000) : null,
    organizationId,
    flashOfferEndsAt: organizationId ? undefined : null,
    firstPaidAt:
      organizationId || payload.status === "trialing" || payload.status == null
        ? undefined
        : (existingRecord?.firstPaidAt ?? new Date()),
    paymentMethodFingerprint: fingerprintUpdates.paymentMethodFingerprint,
    cardFunding: fingerprintUpdates.cardFunding,
    trialPaymentMethodFingerprint: fingerprintUpdates.trialPaymentMethodFingerprint,
    trialUsedAt: fingerprintUpdates.trialUsedAt,
  };

  const isRenewal =
    existingRecord?.currentPeriodEnd &&
    updates.currentPeriodEnd &&
    existingRecord.currentPeriodEnd.getTime() !== updates.currentPeriodEnd.getTime() &&
    updates.currentPeriodEnd.getTime() > existingRecord.currentPeriodEnd.getTime();

  await db
    .insert(billing)
    .values({
      userId: payload.userId,
      ...updates,
    })
    .onConflictDoUpdate({
      target: organizationId ? [billing.userId, billing.organizationId] : billing.userId,
      targetWhere: organizationId ? sql`organization_id IS NOT NULL` : sql`organization_id IS NULL`,
      set: {
        ...updates,
        updatedAt: new Date(),
      },
    });

  if (!organizationId && plan?.id && isAffiliatePaidStatus(payload.status)) {
    await processAffiliatePurchase({
      referredUserId: payload.userId,
      planId: plan.id,
      purchasedAt: updates.firstPaidAt ?? new Date(),
    });
  }

  // If this is a renewal and Max Mode is enabled, reset usage counters
  if (isRenewal && existingRecord?.maxModeEnabled) {
    await resetMaxModeUsage(payload.userId);
    console.log("[stripe:webhook] Reset Max Mode usage for renewal", { userId: payload.userId });
  }
}

async function clearPlanData({
  userId,
  customerId,
  organizationId,
}: {
  userId: string;
  customerId: string;
  organizationId?: string | null;
}) {
  const orgId = organizationId ?? null;

  await db
    .insert(billing)
    .values({
      userId,
      organizationId: orgId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: null,
      priceId: null,
      planId: null,
      status: "inactive",
      mode: null,
      currentPeriodEnd: null,
      checkoutSessionId: null,
    })
    .onConflictDoUpdate({
      target: orgId ? [billing.userId, billing.organizationId] : billing.userId,
      targetWhere: orgId ? sql`organization_id IS NOT NULL` : sql`organization_id IS NULL`,
      set: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: null,
        priceId: null,
        planId: null,
        status: "inactive",
        mode: null,
        currentPeriodEnd: null,
        checkoutSessionId: null,
        updatedAt: new Date(),
      },
    });
}

async function resolveUserIdFromCustomer(stripeCustomerId: string, metadataUserId?: string | null) {
  if (metadataUserId) return metadataUserId;

  try {
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    if (customer && !("deleted" in customer) && customer.metadata?.userId) {
      return customer.metadata.userId;
    }
  } catch (error) {
    console.warn("Unable to load customer for userId resolution", error);
  }

  const [record] = await db
    .select({ userId: billing.userId })
    .from(billing)
    .where(eq(billing.stripeCustomerId, stripeCustomerId))
    .limit(1);

  return record?.userId ?? null;
}

function resolveOrganizationId(metadata?: Stripe.Metadata | null): string | null {
  return metadata?.organizationId ?? null;
}

export async function POST(req: Request) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET not configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = Buffer.from(await req.arrayBuffer());

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        if (
          typeof subscription !== "object" ||
          subscription === null ||
          subscription.object !== "subscription"
        ) {
          break;
        }

        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id;
        if (!customerId) {
          break;
        }

        const userId = await resolveUserIdFromCustomer(customerId, subscription.metadata?.userId);
        const organizationId = resolveOrganizationId(subscription.metadata);

        if (!userId) {
          console.warn("[stripe:webhook] missing userId for deleted subscription", {
            subscriptionId: subscription.id,
          });
          break;
        }

        await clearPlanData({
          userId,
          customerId,
          organizationId,
        });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        if (
          typeof subscription !== "object" ||
          subscription === null ||
          subscription.object !== "subscription"
        ) {
          break;
        }

        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id;
        if (!customerId) {
          break;
        }

        const price = subscription.items?.data?.[0]?.price ?? null;
        const priceId = price?.id ?? null;
        const lookupKey = price?.lookup_key ?? null;
        const userId = await resolveUserIdFromCustomer(customerId, subscription.metadata?.userId);
        const organizationId = resolveOrganizationId(subscription.metadata);
        const isCanceled =
          subscription.status === "canceled" ||
          subscription.cancel_at_period_end === true ||
          Boolean(subscription.cancel_at);
        const computedStatus = isCanceled ? "canceled" : (subscription.status ?? null);

        if (!userId) {
          console.warn("[stripe:webhook] missing userId for subscription", {
            subscriptionId: subscription.id,
          });
          break;
        }

        await saveSubscription({
          userId,
          customerId,
          subscriptionId: subscription.id,
          lookupKey,
          priceId,
          status: computedStatus,
          currentPeriodEnd: getSubscriptionPeriodEnd(subscription),
          organizationId,
        });

        // When a team subscription becomes active, cancel all org members' personal subs
        if (
          organizationId &&
          subscription.status === "active" &&
          lookupKey &&
          isTeamPlan(findPlanByLookupKey(lookupKey)?.id ?? "")
        ) {
          await cancelOrgMembersPersonalSubscriptions(organizationId);
        }
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const subscription =
            typeof session.subscription === "string"
              ? await stripe.subscriptions.retrieve(session.subscription)
              : session.subscription;

          let userId = session.metadata?.userId ?? subscription.metadata?.userId;

          if (!userId && typeof session.customer === "string") {
            userId = await resolveUserIdFromCustomer(session.customer, session.metadata?.userId);
          }

          const organizationId =
            resolveOrganizationId(session.metadata) ?? resolveOrganizationId(subscription.metadata);

          if (userId) {
            const isCanceled =
              subscription.status === "canceled" ||
              subscription.cancel_at_period_end === true ||
              Boolean(subscription.cancel_at);
            const computedStatus = isCanceled ? "canceled" : subscription.status;

            const price =
              subscription.items.data.at(0)?.price ?? session.line_items?.data.at(0)?.price ?? null;
            await saveSubscription({
              userId,
              customerId: session.customer as string,
              subscriptionId: subscription.id,
              lookupKey: price?.lookup_key ?? null,
              priceId: price?.id ?? null,
              status: computedStatus,
              currentPeriodEnd: getSubscriptionPeriodEnd(subscription),
              organizationId,
            });
          }
        } else if (session.mode === "payment" && session.payment_status === "paid") {
          const userId =
            session.metadata?.userId ??
            session.client_reference_id ??
            (typeof session.customer === "string"
              ? await resolveUserIdFromCustomer(session.customer)
              : null);
          const planId = session.metadata?.planId;

          if (userId && planId) {
            await processAffiliatePurchase({
              referredUserId: userId,
              planId,
              purchasedAt: new Date(event.created * 1000),
            });
          }
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Error handling Stripe webhook", error);
    return NextResponse.json({ received: true }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
