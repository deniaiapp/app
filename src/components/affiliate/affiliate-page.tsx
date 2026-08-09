"use client";

import {
  Check,
  Clipboard,
  Download,
  Gift,
  KeyRound,
  Mail,
  Percent,
  QrCode,
  RotateCcw,
  Send,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useLocale, useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";
import { SettingsPageShell } from "@/components/settings-page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatAppDate } from "@/lib/format-date";
import {
  AFFILIATE_REWARD_PREFERENCES,
  type AffiliateRewardPreference,
} from "@/lib/affiliate-types";
import { trpc } from "@/lib/trpc/react";

const EMPTY_COUPON_DRAFT = { code: "", note: "" };

function ReferralQrCode({ url }: { url: string }) {
  const t = useExtracted();
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(url, {
          width: 280,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#111827", light: "#ffffff" },
        }),
      )
      .then((value) => {
        if (active) {
          setDataUrl(value);
        }
      })
      .catch(() => {
        if (active) {
          setDataUrl(null);
        }
      });

    return () => {
      active = false;
    };
  }, [url]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10">
      <div className="flex size-52 items-center justify-center rounded-xl bg-white p-2">
        {dataUrl ? (
          <img src={dataUrl} alt={t("QR code for your referral link")} className="size-full" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <QrCode className="size-10 animate-pulse" />
            <span className="text-xs">{t("Generating QR code…")}</span>
          </div>
        )}
      </div>
      {dataUrl ? (
        <Button asChild size="sm" className="w-full">
          <a href={dataUrl} download="deni-ai-referral-qr.png">
            <Download className="size-3.5" />
            {t("Download QR")}
          </a>
        </Button>
      ) : null}
    </div>
  );
}

function formatDate(value: Date | null | undefined, locale: string) {
  return value ? formatAppDate(value, locale) : "—";
}

export function AffiliatePage() {
  const t = useExtracted();
  const locale = useLocale();
  const utils = trpc.useUtils();
  const statusQuery = trpc.affiliate.status.useQuery(undefined, { staleTime: 30_000 });
  const status = statusQuery.data;
  const [claimCode, setClaimCode] = useState("");
  const [couponDrafts, setCouponDrafts] = useState<Record<string, { code: string; note: string }>>(
    {},
  );
  const [rewardPreferenceDraft, setRewardPreferenceDraft] =
    useState<AffiliateRewardPreference | null>(null);

  const claim = trpc.affiliate.claim.useMutation({
    onSuccess: async (result) => {
      if (!("noCode" in result && result.noCode)) {
        toast.success(
          result.alreadyClaimed
            ? t("This referral code is already applied.")
            : t("Referral code applied."),
        );
        setClaimCode("");
        await utils.affiliate.status.invalidate();
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const useResetCredit = trpc.affiliate.useResetCredit.useMutation({
    onSuccess: async ({ remaining }) => {
      toast.success(t("Rate limits reset."));
      await Promise.all([
        utils.affiliate.status.invalidate(),
        utils.billing.usage.invalidate(),
        utils.billing.status.invalidate(),
      ]);
      if (remaining === 0) {
        toast.info(t("You have used your last reset credit."));
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const updateRewardPreference = trpc.affiliate.setRewardPreference.useMutation({
    onSuccess: async () => {
      setRewardPreferenceDraft(null);
      toast.success(t("Reward preference saved."));
      await utils.affiliate.status.invalidate();
    },
    onError: (error) => {
      setRewardPreferenceDraft(null);
      toast.error(error.message);
    },
  });

  const adminQuery = trpc.affiliate.adminOverview.useQuery(undefined, {
    enabled: status?.isAdmin === true,
    retry: false,
  });
  const approveReward = trpc.affiliate.approveResetReward.useMutation({
    onSuccess: async () => {
      toast.success(t("Reset reward approved."));
      await Promise.all([
        utils.affiliate.adminOverview.invalidate(),
        utils.affiliate.status.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });
  const rejectReward = trpc.affiliate.rejectResetReward.useMutation({
    onSuccess: async () => {
      toast.success(t("Reset reward rejected."));
      await Promise.all([
        utils.affiliate.adminOverview.invalidate(),
        utils.affiliate.status.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });
  const sendCoupon = trpc.affiliate.sendCouponEmail.useMutation({
    onSuccess: async ({ email }) => {
      toast.success(t("Coupon email sent to {email}.", { email }));
      await Promise.all([
        utils.affiliate.adminOverview.invalidate(),
        utils.affiliate.status.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  if (statusQuery.error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("Unable to load affiliate settings")}</AlertTitle>
        <AlertDescription>{statusQuery.error.message}</AlertDescription>
      </Alert>
    );
  }

  if (statusQuery.isLoading || !status) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const handleCopy = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(message);
    } catch {
      toast.error(t("Copy failed. Select the link and copy it manually."));
    }
  };

  const handleClaim = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!claimCode.trim()) {
      toast.error(t("Enter a referral code."));
      return;
    }
    claim.mutate({ code: claimCode });
  };

  const handleRewardPreferenceChange = (value: string) => {
    if (!value || updateRewardPreference.isPending) {
      return;
    }

    const preference = value as AffiliateRewardPreference;
    if (preference === status.rewardPreference) {
      return;
    }

    setRewardPreferenceDraft(preference);
    updateRewardPreference.mutate({ preference });
  };

  const getDraft = (rewardId: string) => couponDrafts[rewardId] ?? EMPTY_COUPON_DRAFT;
  const updateDraft = (rewardId: string, field: "code" | "note", value: string) => {
    setCouponDrafts((current) => ({
      ...current,
      [rewardId]: { ...getDraft(rewardId), [field]: value },
    }));
  };

  return (
    <SettingsPageShell
      title={t("Affiliate")}
      description={t(
        "Share your referral link. Earn one reset credit for every three registrations, then choose a reward when a referred person buys a paid plan.",
      )}
      className="max-w-6xl"
    >
      <section className="relative overflow-hidden rounded-3xl border border-foreground/10 bg-secondary text-foreground shadow-xl">
        <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-chart-4/80 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 size-72 rounded-full bg-chart-2/70 blur-3xl" />
        <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-2xl space-y-5">
            <div className="space-y-3">
              <h2 className="max-w-xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                {t("Invite friends, earn perks")}
              </h2>
              <p className="max-w-xl text-sm leading-6 text-foreground/70 sm:text-base">
                {t("You can get resets, coupons for paid plans, and a 1-month Plus subscription.")}
              </p>
            </div>
            <div className="grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-foreground/15 bg-background/10 p-3">
                <div className="text-2xl font-semibold tabular-nums">{status.referralCount}</div>
                <div className="mt-1 text-xs text-foreground/60">{t("people registered")}</div>
              </div>
              <div className="rounded-2xl border border-foreground/15 bg-background/10 p-3">
                <div className="text-2xl font-semibold tabular-nums">{status.resetCredits}</div>
                <div className="mt-1 text-xs text-foreground/60">
                  {t("reset credits available")}
                </div>
              </div>
              <div className="col-span-2 rounded-2xl border border-chart-4/80 bg-chart-4/15 p-3 sm:col-span-1">
                <div className="text-2xl font-semibold tabular-nums">
                  {status.referralsUntilNextReward}
                </div>
                <div className="mt-1 text-xs text-foreground/60">
                  {t("until the next registration reward")}
                </div>
              </div>
            </div>
          </div>
          <div className="hidden size-40 rotate-6 items-center justify-center rounded-[2rem] border border-background/20 bg-background/10 lg:flex">
            <Gift className="size-20 -rotate-6 text-chart-4" strokeWidth={1.25} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden border-foreground/10">
          <CardHeader className="border-b bg-muted/35">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <CardTitle>{t("Your invite link")}</CardTitle>
            </div>
            <CardDescription>
              {t(
                "Share your link or QR code. The referral counts when the person registers through it.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 pt-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {t("Referral code")}
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-xl border bg-muted/40 px-4 py-2 font-mono text-lg font-semibold tracking-[0.18em]">
                    {status.code}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={t("Copy referral code")}
                    title={t("Copy referral code")}
                    onClick={() => void handleCopy(status.code, t("Referral code copied."))}
                  >
                    <Clipboard className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {t("Shareable link")}
                </div>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={status.referralUrl}
                    aria-label={t("Shareable referral link")}
                    className="min-w-0 bg-muted/30 font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={t("Copy referral link")}
                    title={t("Copy referral link")}
                    onClick={() => void handleCopy(status.referralUrl, t("Referral link copied."))}
                  >
                    <Clipboard className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
            <ReferralQrCode url={status.referralUrl} />
          </CardContent>
        </Card>

        <Card className="border-chart-4/40 bg-chart-4/10">
          <CardHeader>
            <div className="flex items-center gap-2">
              <RotateCcw className="size-4" />
              <CardTitle>{t("Use a reset credit")}</CardTitle>
            </div>
            <CardDescription>
              {t(
                "Use one reset credit to clear your current basic and premium usage counters immediately.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-4xl font-semibold tabular-nums">{status.resetCredits}</div>
                <div className="text-sm text-muted-foreground">{t("credits available")}</div>
              </div>
              <Button
                disabled={status.resetCredits < 1 || useResetCredit.isPending}
                onClick={() => useResetCredit.mutate()}
              >
                {useResetCredit.isPending ? <Spinner /> : <RotateCcw className="size-4" />}
                {t("Reset limits now")}
              </Button>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              {t(
                "Three-registration rewards require our approval. Paid-plan reset rewards are added automatically, while coupon rewards are sent via email after we process them.",
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-chart-2/35 bg-chart-2/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gift className="size-4" />
            <CardTitle>{t("Select a paid plan referral reward")}</CardTitle>
          </div>
          <CardDescription>
            {t(
              "If the friend you referred purchases Plus, Pro (monthly), or Max (monthly) within 7 days, you can receive one of the following rewards. Please choose one of them.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            variant="outline"
            value={[rewardPreferenceDraft ?? status.rewardPreference]}
            onValueChange={(values) => handleRewardPreferenceChange(values.at(-1) ?? "")}
            disabled={updateRewardPreference.isPending}
            aria-label={t("Paid-plan reward preference")}
            className="grid w-full sm:grid-cols-2"
          >
            <ToggleGroupItem
              value={AFFILIATE_REWARD_PREFERENCES.resetCredits}
              className="h-auto justify-start whitespace-normal rounded-xl p-4 text-left"
            >
              <RotateCcw className="size-4 shrink-0" />
              <span className="flex flex-col items-start gap-1">
                <span className="font-medium">{t("3 reset credits")}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {t("Use them to reset your current usage limits.")}
                </span>
              </span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value={AFFILIATE_REWARD_PREFERENCES.discountCoupon}
              className="h-auto justify-start whitespace-normal rounded-xl p-4 text-left"
            >
              <Percent className="size-4 shrink-0" />
              <span className="flex flex-col items-start gap-1">
                <span className="font-medium">{t("30% OFF coupon")}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {t("We will email you a coupon code for one month of free Plus.")}
                </span>
              </span>
            </ToggleGroupItem>
          </ToggleGroup>
          <p className="mt-3 text-xs text-muted-foreground">
            {t(
              "This selection is used for future paid-plan purchases. You can change it before the referred person buys.",
            )}
          </p>
        </CardContent>
      </Card>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          {
            icon: UserPlus,
            number: "01",
            title: t("Invite a friend"),
            description: t(
              "They must register through your link or QR code for the referral to count.",
            ),
          },
          {
            icon: Users,
            number: "02",
            title: t("Every 3 registrations"),
            description: t("Earn 1 reset credit after our approval."),
          },
          {
            icon: Gift,
            number: "03",
            title: t("When they buy a paid plan"),
            description: t(
              "Within 7 days of registration, choose 3 reset credits or a 30% OFF coupon.",
            ),
          },
        ].map(({ icon: Icon, number, title, description }) => (
          <Card key={number} className="relative overflow-hidden border-foreground/10">
            <div className="absolute right-4 top-3 font-mono text-4xl font-semibold text-muted/70">
              {number}
            </div>
            <CardHeader className="relative">
              <div className="flex size-9 items-center justify-center rounded-xl bg-muted">
                <Icon className="size-4" />
              </div>
              <CardTitle className="text-sm">{title}</CardTitle>
              <CardDescription className="leading-5">{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <Card className="border-foreground/10">
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" />
            <CardTitle>{t("Apply a referral code")}</CardTitle>
          </div>
          <CardDescription>
            {t(
              "If you registered without a referral link, apply one code within 24 hours of creating your account.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleClaim} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={claimCode}
              onChange={(event) => setClaimCode(event.target.value.toUpperCase())}
              placeholder={t("Enter your 10-character code")}
              maxLength={10}
              autoComplete="off"
              className="font-mono tracking-[0.12em] sm:max-w-xs"
              aria-label={t("Referral code")}
            />
            <Button type="submit" disabled={claim.isPending || claimCode.trim().length === 0}>
              {claim.isPending ? <Spinner /> : <Check className="size-4" />}
              {t("Apply code")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-foreground/10">
          <CardHeader>
            <CardTitle>{t("How the rewards work")}</CardTitle>
            <CardDescription>
              {t("The registration reward and paid-plan reward are separate.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <RuleRow
              icon={<Users className="size-4" />}
              title={t("Every 3 registrations")}
              description={t("Receive 1 reset credit after approval.")}
            />
            <RuleRow
              icon={<RotateCcw className="size-4" />}
              title={t("A paid plan within 7 days")}
              description={t("Choose 3 reset credits or a 30% OFF coupon.")}
            />
            <RuleRow
              icon={<Percent className="size-4" />}
              title={t("Change your paid-plan reward")}
              description={t("You can change it before the referred person buys.")}
            />
          </CardContent>
        </Card>

        <Card className="border-foreground/10">
          <CardHeader>
            <CardTitle>{t("Your activity")}</CardTitle>
            <CardDescription>
              {t("Registration and purchase windows are shown in UTC.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status.referrals.length === 0 ? (
              <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-center text-sm text-muted-foreground">
                <Users className="size-5" />
                <span>{t("Your first referral will appear here.")}</span>
              </div>
            ) : (
              <div className="space-y-2">
                {status.referrals.slice(0, 6).map((referral) => (
                  <div
                    key={referral.id}
                    className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {referral.referredName || t("Deni AI member")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("Registered {date}", {
                          date: formatDate(referral.registeredAt, locale),
                        })}
                      </div>
                    </div>
                    {referral.purchasePlanId ? (
                      <Badge variant="secondary" className="shrink-0">
                        {referral.purchasePlanId.replaceAll("_", " ")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0">
                        {t("Within {date}", {
                          date: formatDate(referral.purchaseDeadlineAt, locale),
                        })}
                      </Badge>
                    )}
                  </div>
                ))}
                {status.referrals.length > 6 ? (
                  <p className="pt-1 text-xs text-muted-foreground">
                    {t("Showing the six most recent referrals.")}
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-foreground/10">
        <CardHeader>
          <CardTitle>{t("Reward history")}</CardTitle>
          <CardDescription>
            {t("See the reset credits and coupons earned from your referrals.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status.rewards.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("No rewards yet.")}</p>
          ) : (
            <div className="space-y-2">
              {status.rewards.map((reward) => (
                <div
                  key={reward.id}
                  className="flex flex-col gap-2 rounded-xl border bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {reward.type === "registration_reset"
                        ? t("Three-user milestone reset")
                        : reward.type === "purchase_reset"
                          ? t("Paid-plan reset credits")
                          : reward.type === "discount_coupon"
                            ? t("30% OFF coupon")
                            : t("Plus-month coupon")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(reward.createdAt, locale)} ·{" "}
                      {t("Quantity {count}", { count: String(reward.quantity) })}
                    </div>
                  </div>
                  <RewardStatus status={reward.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {status.isAdmin ? (
        <Card className="border-chart-2/35 bg-chart-2/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4" />
              <CardTitle>{t("Reward desk")}</CardTitle>
            </div>
            <CardDescription>
              {t("Approve milestone resets and send earned coupon rewards from one place.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {adminQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : adminQuery.error ? (
              <Alert variant="destructive">
                <AlertTitle>{t("Unable to load admin queue")}</AlertTitle>
                <AlertDescription>{adminQuery.error.message}</AlertDescription>
              </Alert>
            ) : adminQuery.data?.length ? (
              <div className="space-y-3">
                {adminQuery.data.map((row) => {
                  const draft = getDraft(row.reward.id);
                  const isResetReward = row.reward.type === "registration_reset";
                  const isDiscountCouponReward = row.reward.type === "discount_coupon";
                  return (
                    <div key={row.reward.id} className="rounded-2xl border bg-background/70 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={isResetReward ? "secondary" : "outline"}>
                              {isResetReward
                                ? t("Approval")
                                : isDiscountCouponReward
                                  ? t("30% OFF coupon")
                                  : t("Coupon email")}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(row.reward.createdAt, locale)}
                            </span>
                          </div>
                          <div className="text-sm font-medium">
                            {row.referrer.name || t("Unnamed member")}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {row.referrer.email}
                          </div>
                          {row.referredUser ? (
                            <div className="pt-1 text-xs text-muted-foreground">
                              {t("Referred user: {email}", { email: row.referredUser.email })}
                            </div>
                          ) : null}
                        </div>
                        {isResetReward ? (
                          <div className="flex shrink-0 gap-2">
                            <Button
                              size="sm"
                              disabled={approveReward.isPending || rejectReward.isPending}
                              onClick={() => approveReward.mutate({ rewardId: row.reward.id })}
                            >
                              {approveReward.isPending ? (
                                <Spinner />
                              ) : (
                                <Check className="size-3.5" />
                              )}
                              {t("Approve")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={approveReward.isPending || rejectReward.isPending}
                              onClick={() => rejectReward.mutate({ rewardId: row.reward.id })}
                            >
                              {rejectReward.isPending ? <Spinner /> : <X className="size-3.5" />}
                              {t("Reject")}
                            </Button>
                          </div>
                        ) : (
                          <div className="w-full space-y-2 sm:max-w-md">
                            <div className="flex gap-2">
                              <Input
                                value={draft.code}
                                onChange={(event) =>
                                  updateDraft(row.reward.id, "code", event.target.value)
                                }
                                placeholder={
                                  isDiscountCouponReward
                                    ? t("30% OFF Stripe coupon or promotion code")
                                    : t("Stripe coupon or promotion code")
                                }
                                aria-label={t("Coupon code")}
                                className="font-mono"
                              />
                              <Button
                                size="sm"
                                disabled={sendCoupon.isPending || draft.code.trim().length === 0}
                                onClick={() =>
                                  sendCoupon.mutate({
                                    rewardId: row.reward.id,
                                    couponCode: draft.code,
                                    note: draft.note || undefined,
                                  })
                                }
                              >
                                {sendCoupon.isPending ? <Spinner /> : <Send className="size-3.5" />}
                                {t("Send")}
                              </Button>
                            </div>
                            <Textarea
                              value={draft.note}
                              onChange={(event) =>
                                updateDraft(row.reward.id, "note", event.target.value)
                              }
                              placeholder={t("Optional note for the email")}
                              aria-label={t("Optional note for the email")}
                              rows={2}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-24 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                <Mail className="mr-2 size-4" />
                {t("The admin queue is clear.")}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </SettingsPageShell>
  );
}

function RuleRow({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-muted/20 p-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background shadow-sm">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs leading-5 text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}

function RewardStatus({ status }: { status: string }) {
  const t = useExtracted();
  const labels: Record<string, string> = {
    pending: t("Pending approval"),
    approved: t("Approved"),
    rejected: t("Rejected"),
    pending_email: t("Pending approval"),
    sending: t("Sending"),
    sent: t("Sent"),
  };

  return (
    <Badge
      variant={
        status === "rejected" ? "destructive" : status === "pending" ? "outline" : "secondary"
      }
    >
      {labels[status] ?? status}
    </Badge>
  );
}
