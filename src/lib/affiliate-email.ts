import { createElement } from "react";
import { Resend } from "resend";
import {
  AffiliateDiscountCouponEmail,
  affiliateDiscountCouponEmailSubject,
} from "@/emails/affiliate-discount-coupon-email";
import {
  AffiliateResetRewardEmail,
  affiliateResetRewardEmailSubject,
  type AffiliateResetRewardEmailStatus,
} from "@/emails/affiliate-reset-reward-email";
import {
  AffiliatePlusCouponEmail,
  affiliatePlusCouponEmailSubject,
} from "@/emails/affiliate-plus-coupon-email";
import { env } from "@/env";
import { AFFILIATE_DISCOUNT_PERCENT } from "@/lib/affiliate-types";
import { EMAIL_FROM } from "@/lib/constants";

export async function sendAffiliatePlusCouponEmail({
  to,
  name,
  couponCode,
  note,
}: {
  to: string;
  name?: string | null;
  couponCode: string;
  note?: string | null;
}) {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is required to send affiliate reward emails.");
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: affiliatePlusCouponEmailSubject,
    react: createElement(AffiliatePlusCouponEmail, { name, couponCode, note }),
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function sendAffiliateResetRewardEmail({
  to,
  name,
  quantity,
  status,
}: {
  to: string;
  name?: string | null;
  quantity: number;
  status: AffiliateResetRewardEmailStatus;
}) {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is required to send affiliate reward emails.");
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: affiliateResetRewardEmailSubject(status),
    react: createElement(AffiliateResetRewardEmail, { name, quantity, status }),
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function sendAffiliateDiscountCouponEmail({
  to,
  name,
  couponCode,
  note,
}: {
  to: string;
  name?: string | null;
  couponCode: string;
  note?: string | null;
}) {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is required to send affiliate reward emails.");
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: affiliateDiscountCouponEmailSubject(AFFILIATE_DISCOUNT_PERCENT),
    react: createElement(AffiliateDiscountCouponEmail, {
      name,
      couponCode,
      discountPercent: AFFILIATE_DISCOUNT_PERCENT,
      note,
    }),
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data;
}
