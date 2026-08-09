export const AFFILIATE_REWARD_PREFERENCES = {
  resetCredits: "reset_credits",
  discountCoupon: "discount_coupon",
} as const;

export type AffiliateRewardPreference =
  (typeof AFFILIATE_REWARD_PREFERENCES)[keyof typeof AFFILIATE_REWARD_PREFERENCES];

export const AFFILIATE_DISCOUNT_PERCENT = 30;
