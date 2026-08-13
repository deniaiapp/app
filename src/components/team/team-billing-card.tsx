"use client";

import { useExtracted } from "next-intl";
import { PlanHighlights } from "@/components/billing/plan-highlights";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency, monthDayFormatter, monthDayYearFormatter } from "./team-utils";

type TeamPlan = {
  id: string;
  amount: number | null;
  currency: string | null;
  trialDays?: number | null;
};

type BillingStatus = {
  status?: string | null;
  memberCount?: number | null;
  currentPeriodEnd?: Date | string | null;
  cancelAt?: number | null;
};

export function TeamBillingCard({
  isLoading,
  billingStatus,
  monthlyPlan,
  yearlyPlan,
  monthlyPlanCopy,
  yearlyPlanCopy,
  teamTrialDays,
  checkoutPending,
  checkoutPlanId,
  cancelPending,
  resumePending,
  onSubscribe,
  onManage,
  onCancel,
  onResume,
}: {
  isLoading: boolean;
  billingStatus?: BillingStatus | null;
  monthlyPlan?: TeamPlan;
  yearlyPlan?: TeamPlan;
  monthlyPlanCopy: { tagline: string; highlights: string[] };
  yearlyPlanCopy: { tagline: string; badge?: string | null; highlights: string[] };
  teamTrialDays: number | null;
  checkoutPending: boolean;
  checkoutPlanId?: string;
  cancelPending: boolean;
  resumePending: boolean;
  onSubscribe: (planId: "pro_team_monthly" | "pro_team_yearly") => void;
  onManage: () => void;
  onCancel: () => void;
  onResume: () => void;
}) {
  const t = useExtracted();
  const hasActivePlan =
    billingStatus?.status &&
    ["active", "trialing", "past_due", "incomplete", "unpaid", "canceled"].includes(
      billingStatus.status,
    );
  const isCanceled = Boolean(billingStatus?.cancelAt) || billingStatus?.status === "canceled";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("Team Billing")}</CardTitle>
        <CardDescription>
          {t("Pro for Teams gives every member Pro-tier access with per-seat pricing.")}
        </CardDescription>
        {teamTrialDays && (
          <div className="pt-2 space-y-2">
            <Badge className="border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300">
              {t("{days}-day free trial", { days: teamTrialDays.toString() })}
            </Badge>
            <p className="text-xs text-muted-foreground">
              {t("Team trial is available for up to {count} seats.", { count: "5" })}
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Spinner />
        ) : hasActivePlan || isCanceled ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium mb-1.5">
                  Pro for Teams
                  {isCanceled && (
                    <Badge variant="secondary">
                      {t("Cancels")}{" "}
                      {billingStatus?.cancelAt
                        ? monthDayFormatter.format(new Date(billingStatus.cancelAt * 1000))
                        : billingStatus?.currentPeriodEnd
                          ? monthDayFormatter.format(new Date(billingStatus.currentPeriodEnd))
                          : ""}
                    </Badge>
                  )}
                  {hasActivePlan && !isCanceled && <Badge className="ml-1.5">{t("Active")}</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {billingStatus?.memberCount ?? 0} {t("seats")}
                  {billingStatus?.currentPeriodEnd &&
                    ` · ${t("Renews")} ${monthDayYearFormatter.format(new Date(billingStatus.currentPeriodEnd))}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onManage}>
                  {t("Manage")}
                </Button>
                {isCanceled ? (
                  <Button size="sm" onClick={onResume} disabled={resumePending}>
                    {resumePending && <Spinner className="size-3.5" />}
                    {t("Resume")}
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={onCancel}
                    disabled={cancelPending}
                  >
                    {cancelPending && <Spinner className="size-3.5" />}
                    {t("Cancel")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {monthlyPlan && (
              <Card className="flex flex-col border-muted">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{t("Pro for Teams")}</CardTitle>
                      <CardDescription className="text-sm">
                        {monthlyPlanCopy.tagline}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {t("Monthly")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col pt-0">
                  <p className="text-2xl font-bold">
                    {formatCurrency(monthlyPlan.amount, monthlyPlan.currency)}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{t("seat")}/{t("month")}
                    </span>
                  </p>
                  <PlanHighlights items={monthlyPlanCopy.highlights} className="mt-5 flex-1" />
                  <Button
                    className="mt-5 w-full"
                    disabled={checkoutPending}
                    onClick={() => onSubscribe("pro_team_monthly")}
                  >
                    {checkoutPending && checkoutPlanId === "pro_team_monthly" ? (
                      <Spinner className="size-3.5" />
                    ) : null}
                    {t("Subscribe")}
                  </Button>
                </CardContent>
              </Card>
            )}
            {yearlyPlan && (
              <Card className="flex flex-col border-muted">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{t("Pro for Teams")}</CardTitle>
                        {yearlyPlanCopy.badge ? (
                          <Badge variant="secondary" className="text-xs">
                            {yearlyPlanCopy.badge}
                          </Badge>
                        ) : null}
                      </div>
                      <CardDescription className="text-sm">
                        {yearlyPlanCopy.tagline}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {t("Yearly")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col pt-0">
                  <p className="text-2xl font-bold">
                    {formatCurrency(yearlyPlan.amount, yearlyPlan.currency)}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{t("seat")}/{t("year")}
                    </span>
                  </p>
                  <PlanHighlights items={yearlyPlanCopy.highlights} className="mt-5 flex-1" />
                  <Button
                    className="mt-5 w-full"
                    disabled={checkoutPending}
                    onClick={() => onSubscribe("pro_team_yearly")}
                  >
                    {checkoutPending && checkoutPlanId === "pro_team_yearly" ? (
                      <Spinner className="size-3.5" />
                    ) : null}
                    {t("Subscribe")}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
