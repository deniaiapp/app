import { and, eq, gt, ne, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db/drizzle";
import { adCampaign } from "@/db/schema";
import { stripe } from "@/lib/stripe";

export async function activatePaidAd(session: Stripe.Checkout.Session) {
  const id = session.metadata?.adCampaignId;
  if (!id || session.payment_status !== "paid" || session.mode !== "payment") return;
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('deni-fixed-ads'))`);
    const [ad] = await tx.select().from(adCampaign).where(eq(adCampaign.id, id)).limit(1);
    if (
      !ad ||
      ad.stripeSessionId !== session.id ||
      ad.status !== "approved" ||
      ad.userId !== session.metadata?.userId ||
      // A promotion code may lower the payment, but not the funded campaign budget.
      session.amount_subtotal !== ad.budgetYen ||
      session.amount_total === null ||
      session.amount_total < 0 ||
      session.amount_total > ad.budgetYen ||
      session.currency !== "jpy"
    )
      return;
    if (ad.plan === "fixed") {
      const [occupied] = await tx
        .select({ id: adCampaign.id })
        .from(adCampaign)
        .where(
          and(
            ne(adCampaign.id, ad.id),
            eq(adCampaign.plan, "fixed"),
            eq(adCampaign.status, "active"),
            gt(adCampaign.endsAt, new Date()),
          ),
        )
        .limit(1);
      if (occupied) {
        if (session.payment_intent)
          await stripe.refunds.create(
            {
              payment_intent:
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : session.payment_intent.id,
            },
            { idempotencyKey: `ad-fixed-conflict-${session.id}` },
          );
        await tx
          .update(adCampaign)
          .set({ status: "rejected", reviewReason: "Fixed slot unavailable; payment refunded" })
          .where(eq(adCampaign.id, ad.id));
        return;
      }
    }
    await tx
      .update(adCampaign)
      .set({
        status: "active",
        startsAt: new Date(),
        endsAt: ad.plan === "fixed" ? new Date(Date.now() + 30 * 86_400_000) : null,
        spentYen: ad.plan === "fixed" ? 3000 : 0,
        updatedAt: new Date(),
      })
      .where(eq(adCampaign.id, ad.id));
  });
}

export async function pauseReversedAdCharge(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return;
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (!intent.metadata.adCampaignId) return;
  await db
    .update(adCampaign)
    .set({ status: "paused", updatedAt: new Date() })
    .where(and(eq(adCampaign.id, intent.metadata.adCampaignId), eq(adCampaign.status, "active")));
}

export async function releaseExpiredAdCheckout(session: Stripe.Checkout.Session) {
  if (!session.metadata?.adCampaignId) return;
  await db
    .update(adCampaign)
    .set({ stripeSessionId: null, checkoutExpiresAt: null })
    .where(
      and(
        eq(adCampaign.id, session.metadata.adCampaignId),
        eq(adCampaign.stripeSessionId, session.id),
        eq(adCampaign.status, "approved"),
      ),
    );
}
