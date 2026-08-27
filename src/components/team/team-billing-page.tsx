"use client";

import { useExtracted } from "next-intl";
import { useBillingReceiptCopy } from "@/components/billing/billing-utils";
import { SubscriptionShredder } from "@/components/billing/subscription-shredder";
import type { SubscriptionReceiptData } from "@/components/billing/subscription-receipt";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamBillingCard } from "./team-billing-card";
import { TeamMaxModeCard } from "./team-max-mode-card";
import { useTeamSettingsContext } from "./team-settings-context";

export function TeamBillingPage() {
  const t = useExtracted();
  const getReceiptCopy = useBillingReceiptCopy();
  const {
    isOwner,
    isAdmin,
    activeOrg,
    monthlyPlanCopy,
    yearlyPlanCopy,
    teamBillingQuery,
    teamMaxModeQuery,
    monthlyPlan,
    yearlyPlan,
    teamTrialDays,
    createTeamCheckout,
    cancelSub,
    resumeSub,
    updateTeamMaxMode,
    updateTeamMaxModeDefaultPolicy,
    updateMemberMaxModePolicy,
    handleSubscribe,
    handleManage,
    handleCancel,
    confirmCancel,
    shredOpen,
    setShredOpen,
    handleResume,
    handleTeamMaxModeToggle,
    updateMemberPolicy,
    updateDefaultPolicy,
    handleDefaultLimitChange,
    handleMemberLimitChange,
    handleExportMaxModeCsv,
  } = useTeamSettingsContext();

  const teamPlanId = teamBillingQuery.data?.planId ?? "pro_team_monthly";
  const teamPlan = teamPlanId.endsWith("yearly") ? yearlyPlan : monthlyPlan;

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("Billing")}</CardTitle>
          <CardDescription>{t("Only team owners and admins can manage billing.")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <TeamBillingCard
        isOwner={isOwner}
        isLoading={teamBillingQuery.isLoading}
        billingStatus={teamBillingQuery.data}
        monthlyPlan={monthlyPlan}
        yearlyPlan={yearlyPlan}
        monthlyPlanCopy={monthlyPlanCopy}
        yearlyPlanCopy={yearlyPlanCopy}
        teamTrialDays={teamTrialDays}
        checkoutPending={createTeamCheckout.isPending}
        checkoutPlanId={createTeamCheckout.variables?.planId}
        cancelPending={cancelSub.isPending || shredOpen}
        resumePending={resumeSub.isPending}
        onSubscribe={handleSubscribe}
        onManage={handleManage}
        onCancel={handleCancel}
        onResume={handleResume}
      />

      <TeamMaxModeCard
        isLoading={teamMaxModeQuery.isLoading}
        settings={teamMaxModeQuery.data}
        teamTogglePending={updateTeamMaxMode.isPending}
        defaultPolicyPending={updateTeamMaxModeDefaultPolicy.isPending}
        memberPolicyPending={updateMemberMaxModePolicy.isPending}
        onTeamToggle={handleTeamMaxModeToggle}
        onDefaultPolicyChange={updateDefaultPolicy}
        onDefaultLimitChange={handleDefaultLimitChange}
        onMemberPolicyChange={updateMemberPolicy}
        onMemberLimitChange={handleMemberLimitChange}
        onExportCsv={handleExportMaxModeCsv}
      />

      <SubscriptionShredder
        data={
          {
            sessionId: activeOrg?.id ?? "team-cancel",
            ...getReceiptCopy(teamPlanId, "/settings/team", t("Home")),
            amountTotal: teamPlan?.amount ?? 0,
            amountSubtotal: teamPlan?.amount ?? null,
            amountTax: null,
            amountDiscount: null,
            currency: teamPlan?.currency ?? "usd",
            paymentMethodBrand: null,
            paymentMethodLast4: null,
            paidAt: teamBillingQuery.data?.currentPeriodEnd ?? null,
          } satisfies SubscriptionReceiptData
        }
        onClose={() => setShredOpen(false)}
        onConfirm={confirmCancel}
        open={shredOpen}
      />
    </div>
  );
}
