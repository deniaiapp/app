export type AffiliateResetRewardEmailStatus = "approved" | "rejected";

export function affiliateResetRewardEmailSubject(status: AffiliateResetRewardEmailStatus) {
  return status === "approved"
    ? "Your Deni AI referral reward was approved"
    : "Update on your Deni AI referral reward";
}
