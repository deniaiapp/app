"use client";

import { Gift, UserPlus, Users } from "lucide-react";
import { useExtracted } from "next-intl";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AffiliateHero({
  referralCount,
  resetCredits,
  referralsUntilNextReward,
}: {
  referralCount: number;
  resetCredits: number;
  referralsUntilNextReward: number;
}) {
  const t = useExtracted();

  return (
    <>
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
                <div className="text-2xl font-semibold tabular-nums">{referralCount}</div>
                <div className="mt-1 text-xs text-foreground/60">{t("people registered")}</div>
              </div>
              <div className="rounded-2xl border border-foreground/15 bg-background/10 p-3">
                <div className="text-2xl font-semibold tabular-nums">{resetCredits}</div>
                <div className="mt-1 text-xs text-foreground/60">
                  {t("reset credits available")}
                </div>
              </div>
              <div className="col-span-2 rounded-2xl border border-chart-4/80 bg-chart-4/15 p-3 sm:col-span-1">
                <div className="text-2xl font-semibold tabular-nums">
                  {referralsUntilNextReward}
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
    </>
  );
}

export function AffiliateHowItWorksSteps() {
  const t = useExtracted();

  return (
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
  );
}
