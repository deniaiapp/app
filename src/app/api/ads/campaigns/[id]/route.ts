import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db/drizzle";
import { adCampaign } from "@/db/schema";
import { env } from "@/env";
import { adCreativeSchema } from "@/lib/ad-creative";
import { reviewAd } from "@/lib/ad-review";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const editSchema = z.strictObject({
  ...adCreativeSchema.shape,
  previous: adCreativeSchema,
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return new Response(null, { status: 403 });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.session || session.user.isAnonymous) return new Response(null, { status: 401 });
  if (!env.OPENROUTER_API_KEY)
    return Response.json({ error: "Review unavailable" }, { status: 503 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response(null, { status: 404 });
  const input = editSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Invalid creative" }, { status: 400 });
  const { previous, ...creative } = input.data;
  const [existing] = await db
    .select()
    .from(adCampaign)
    .where(and(eq(adCampaign.id, id), eq(adCampaign.userId, session.session.userId)))
    .limit(1);
  if (!existing) return new Response(null, { status: 404 });
  const canEdit =
    existing.status === "active" ||
    existing.status === "approved" ||
    (existing.status === "rejected" && !existing.stripeSessionId);
  if (!canEdit) return Response.json({ error: "Campaign cannot be edited" }, { status: 409 });
  if (
    existing.title !== previous.title ||
    existing.description !== previous.description ||
    existing.url !== previous.url
  )
    return Response.json({ error: "Campaign changed; refresh and try again" }, { status: 409 });
  if (
    existing.title === creative.title &&
    existing.description === creative.description &&
    existing.url === creative.url
  )
    return Response.json({ campaign: existing }, { headers: { "Cache-Control": "no-store" } });

  const limit = await checkRateLimit({
    key: `ad-edit-review:${session.session.userId}`,
    windowMs: 86_400_000,
    maxRequests: 10,
  });
  if (!limit.allowed)
    return Response.json({ error: "Daily review limit reached" }, { status: 429 });
  let review;
  try {
    review = await reviewAd(creative);
  } catch (error) {
    console.error("Ad edit review failed", { campaignId: id, error });
    return Response.json({ error: "Review unavailable" }, { status: 503 });
  }
  if (!review.approved)
    return Response.json({ error: "Ad edit rejected", reason: review.reason }, { status: 422 });

  // Never modify pricing, Stripe state, dates, or counters when changing a creative.
  const [updated] = await db
    .update(adCampaign)
    .set({
      ...creative,
      ...(existing.status === "rejected" ? { status: "approved" } : {}),
      reviewReason: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(adCampaign.id, id),
        eq(adCampaign.userId, session.session.userId),
        eq(adCampaign.title, previous.title),
        eq(adCampaign.description, previous.description),
        eq(adCampaign.url, previous.url),
        inArray(
          adCampaign.status,
          existing.status === "rejected" ? ["rejected"] : ["approved", "active"],
        ),
      ),
    )
    .returning();
  if (!updated)
    return Response.json({ error: "Campaign changed; refresh and try again" }, { status: 409 });
  return Response.json({ campaign: updated }, { headers: { "Cache-Control": "no-store" } });
}
