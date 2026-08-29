"use client";

import { BadgePercent, Clock, Gift, Sparkles } from "lucide-react";
import { useExtracted } from "next-intl";

export function UpgradeDecisionPanel({
  yearlySavingsPercent,
  hasActiveSubscription,
}: {
  yearlySavingsPercent: number;
  hasActiveSubscription: boolean;
}) {
  const t = useExtracted();

  const items = [
    {
      icon: Sparkles,
      label: t("Start with the plan that matches your usage"),
      description: t(
        "Plus is for trying Deni AI, Pro is for daily work, Max is for heavy premium usage, and Teams can take Pro or Max per seat.",
      ),
    },
    {
      icon: BadgePercent,
      label:
        yearlySavingsPercent > 0
          ? t("Annual billing can save up to {percent}%", {
              percent: yearlySavingsPercent.toString(),
            })
          : t("Annual billing keeps the monthly equivalent clear"),
      description: t("Each yearly option shows the monthly equivalent before checkout."),
    },
    {
      icon: hasActiveSubscription ? Clock : Gift,
      label: hasActiveSubscription
        ? t("Switch plans with an estimate first")
        : t("Trial and coupon support before payment"),
      description: hasActiveSubscription
        ? t("Plan changes show the estimated charge before you confirm.")
        : t("Eligible trials, discounts, and the final amount are shown before payment."),
    },
  ];

  return (
    <section className="rounded-lg border border-border/80 bg-muted/30 p-4">
      <div className="flex flex-col gap-4 md:items-start md:justify-between">
        <div className="max-w-xl space-y-1">
          <div className="text-sm font-medium">{t("Choose with less guesswork")}</div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t(
              "The upgrade path is ordered by usage intensity, with billing terms visible before you commit.",
            )}
          </p>
        </div>
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="rounded-md border border-border/70 bg-background/70 p-3"
              >
                <Icon className="mb-2 size-4 text-muted-foreground" />
                <div className="text-sm font-medium leading-snug">{item.label}</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
