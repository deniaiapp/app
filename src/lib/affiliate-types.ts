export const AFFILIATE_REWARD_PREFERENCES = {
  resetCredits: "reset_credits",
  discountCoupon: "discount_coupon",
} as const;

export type AffiliateRewardPreference =
  (typeof AFFILIATE_REWARD_PREFERENCES)[keyof typeof AFFILIATE_REWARD_PREFERENCES];

export const AFFILIATE_DISCOUNT_PERCENT = 30;

export const AFFILIATE_RESET_PLAN_TIERS = ["free", "plus", "pro", "max"] as const;
export type AffiliateResetPlanTier = (typeof AFFILIATE_RESET_PLAN_TIERS)[number];

export const AFFILIATE_REWARD_TYPES = {
  registrationReset: "registration_reset",
  purchaseReset: "purchase_reset",
  plusCoupon: "plus_coupon",
  discountCoupon: "discount_coupon",
} as const;
