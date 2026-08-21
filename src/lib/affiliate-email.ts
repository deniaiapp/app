import { createElement } from "react";
import { AffiliateDiscountCouponEmail } from "@/emails/affiliate-discount-coupon-email";
import { affiliateDiscountCouponEmailSubject } from "@/emails/affiliate-discount-coupon-email-subject";
import {
  AffiliatePlusCouponEmail,
  affiliatePlusCouponEmailSubject,
} from "@/emails/affiliate-plus-coupon-email";
import { AffiliateResetRewardEmail } from "@/emails/affiliate-reset-reward-email";
import {
  affiliateResetRewardEmailSubject,
  type AffiliateResetRewardEmailStatus,
} from "@/emails/affiliate-reset-reward-email-subject";
import { AFFILIATE_DISCOUNT_PERCENT } from "@/lib/affiliate-types";
import { sendEmail } from "@/lib/email";

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
  return sendEmail({
    to,
    subject: affiliatePlusCouponEmailSubject,
    react: createElement(AffiliatePlusCouponEmail, { name, couponCode, note }),
  });
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
  return sendEmail({
    to,
    subject: affiliateResetRewardEmailSubject(status),
    react: createElement(AffiliateResetRewardEmail, { name, quantity, status }),
  });
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
  return sendEmail({
    to,
    subject: affiliateDiscountCouponEmailSubject(AFFILIATE_DISCOUNT_PERCENT),
    react: createElement(AffiliateDiscountCouponEmail, {
      name,
      couponCode,
      discountPercent: AFFILIATE_DISCOUNT_PERCENT,
      note,
    }),
  });
}
