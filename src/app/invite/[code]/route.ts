import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { affiliateProfile } from "@/db/schema";
import { db } from "@/db/drizzle";
import { env } from "@/env";
import { AFFILIATE_COOKIE_NAME, normalizeAffiliateCode } from "@/lib/affiliate";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalizedCode = normalizeAffiliateCode(code);
  // Always redirect against the public app origin. In Docker, Next binds with
  // HOSTNAME=0.0.0.0 so `request.url` can become http://0.0.0.0:3000 when the
  // reverse proxy does not forward Host correctly — never use that for public URLs.
  const destination = new URL("/auth/sign-up", env.NEXT_PUBLIC_BETTER_AUTH_URL);

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
