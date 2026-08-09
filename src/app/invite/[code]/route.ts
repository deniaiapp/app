import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { affiliateProfile } from "@/db/schema";
import { db } from "@/db/drizzle";
import { AFFILIATE_COOKIE_NAME, normalizeAffiliateCode } from "@/lib/affiliate";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalizedCode = normalizeAffiliateCode(code);
  const destination = new URL("/auth/sign-up", request.url);

  if (!normalizedCode) {
    destination.searchParams.set("referral", "invalid");
    return NextResponse.redirect(destination);
  }

  const [profile] = await db
    .select({ code: affiliateProfile.code })
    .from(affiliateProfile)
    .where(eq(affiliateProfile.code, normalizedCode))
    .limit(1);

  if (!profile) {
    destination.searchParams.set("referral", "invalid");
    return NextResponse.redirect(destination);
  }

  destination.searchParams.set("referral", normalizedCode);
  const response = NextResponse.redirect(destination);
  response.cookies.set(AFFILIATE_COOKIE_NAME, normalizedCode, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
