"use client";

import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import { startTransition, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { BillingPlanId, ClientPlan, IndividualPlanId } from "@/lib/billing";
import { isTeamPlan } from "@/lib/billing";
import { isBillingDisabled } from "@/lib/billing-config";
import { trpc } from "@/lib/trpc/react";
import { settingsUsageQueryOptions } from "@/lib/usage-query-options";
import { SettingsPageShell } from "../settings-page-shell";
import { CardVerificationCard } from "./card-verification-card";
import { BillingChangePlanDialog } from "./billing-change-plan-dialog";
import { BillingCurrentPlanCard } from "./billing-current-plan-card";
import { BillingMaxModeCard } from "./billing-max-mode-card";
import { BillingPlansSection } from "./billing-plans-section";
import { BillingUsageSection } from "./billing-usage-section";
import {
  ACTIVE_STATUSES,
  calculateYearlySavingsPercent,
  useBillingReceiptCopy,
} from "./billing-utils";
import { SubscriptionShredder } from "./subscription-shredder";
import type { SubscriptionReceiptData } from "./subscription-receipt";
import { Card, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Spinner } from "../ui/spinner";

function BillingDisabled() {
  const t = useExtracted();

  return (
    <SettingsPageShell
      title={t("Billing")}
      description={t("Billing is disabled for this environment.")}
    >
      <Card>
        <CardHeader>
          <CardTitle>{t("Billing unavailable")}</CardTitle>
          <CardDescription>
            {t("Plans, checkout, and billing management are turned off.")}
          </CardDescription>
        </CardHeader>
      </Card>
    </SettingsPageShell>
  );
}

function BillingPageContent() {
  const t = useExtracted();
  const { push } = useRouter();
  const [changeTarget, setChangeTarget] = useState<ClientPlan | null>(null);
  const [plusInterval, setPlusInterval] = useState<"monthly" | "yearly">("monthly");
  const [proInterval, setProInterval] = useState<"monthly" | "yearly">("monthly");
  const [maxInterval, setMaxInterval] = useState<"monthly" | "yearly">("monthly");
  const [hasAgreed, setHasAgreed] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<IndividualPlanId | null>(null);

  const estimateQuery = trpc.billing.estimatePlanChange.useQuery(
    { planId: pendingPlanId ?? "plus_monthly" },
    {
      enabled: Boolean(pendingPlanId),
      refetchOnWindowFocus: false,
      retry: false,
    },
  );

  const isChangePlanOpen =
    pendingPlanId !== null &&
    !estimateQuery.isFetching &&
    (estimateQuery.data !== undefined || estimateQuery.error !== null);

  const changePlanPendingRef = useRef(false);
  const handleDialogOpenChange = (open: boolean) => {
    if (changePlanPendingRef.current) return;
    if (!open) {
      setHasAgreed(false);
      setPendingPlanId(null);
      setChangeTarget(null);
    }
  };

  const handleChangePlanClick = (plan: ClientPlan) => {
    setChangeTarget(plan);
    setPendingPlanId(plan.id as IndividualPlanId);
  };

  const createCheckout = trpc.billing.createCheckoutSession.useMutation();

  const handleCheckout = async (planId: IndividualPlanId) => {
    try {
      const result = await createCheckout.mutateAsync({ planId });
      startTransition(() => {
        push(`/settings/billing/checkout/${result.sessionId}`);
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Unable to load checkout."));
    }
  };

  const utils = trpc.useUtils();
  const statusQuery = trpc.billing.status.useQuery(undefined, {
    staleTime: 60_000,
  });
  const plansQuery = trpc.billing.plans.useQuery();
  const usageQuery = trpc.billing.usage.useQuery(undefined, {
    ...settingsUsageQueryOptions,
  });

  const portal = trpc.billing.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      toast.error(t("Stripe did not return a billing portal URL."));
    },
    onError: (error) => toast.error(error.message),
  });

  const changePlan = trpc.billing.changePlan.useMutation({
    onSuccess: async () => {
      toast.success(t("Plan updated."));
      await utils.billing.status.invalidate();
      await utils.billing.usage.invalidate();
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => {
      setChangeTarget(null);
      setPendingPlanId(null);
      setHasAgreed(false);
    },
  });

  useEffect(() => {
    changePlanPendingRef.current = changePlan.isPending;
  }, [changePlan.isPending]);

  const [shredOpen, setShredOpen] = useState(false);
  const getReceiptCopy = useBillingReceiptCopy();

  const cancel = trpc.billing.cancelSubscription.useMutation({
    onSuccess: async () => {
      await utils.billing.status.invalidate();
      await utils.billing.usage.invalidate();
    },
  });

  const resume = trpc.billing.resumeSubscription.useMutation({
    onSuccess: async () => {
      toast.success(t("Subscription resumed."));
      await utils.billing.status.invalidate();
      await utils.billing.usage.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const maxModeQuery = trpc.billing.maxModeStatus.useQuery(undefined, {
    staleTime: 60_000,
  });

  const enableMaxMode = trpc.billing.enableMaxMode.useMutation({
    onSuccess: async () => {
      toast.success(t("Max Mode enabled."));
      await utils.billing.maxModeStatus.invalidate();
      await utils.billing.usage.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const disableMaxMode = trpc.billing.disableMaxMode.useMutation({
    onSuccess: async () => {
      toast.success(t("Max Mode disabled."));
      await utils.billing.maxModeStatus.invalidate();
      await utils.billing.usage.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleMaxModeToggle = (enabled: boolean) => {
    if (enabled) {
      enableMaxMode.mutate();
    } else {
      disableMaxMode.mutate();
    }
  };

  const statusLabel = statusQuery.data?.status ?? "inactive";
  const rawPlanId = (statusQuery.data?.planId as BillingPlanId) ?? undefined;
  const activePlanId = ACTIVE_STATUSES.has(statusLabel) ? rawPlanId : undefined;
  const isOnTeamPlan =
    statusQuery.data?.isTeamPlan === true && rawPlanId ? isTeamPlan(rawPlanId) : false;
  const usage = usageQuery.data?.usage ?? [];
  const usageTier = usageQuery.data?.tier ?? "free";
  const usageTierLabel = (() => {
    switch (usageTier) {
      case "max":
        return t("Max");
      case "plus":
        return t("Plus");
      case "pro":
        return t("Pro");
      default:
        return t("Free");
    }
  })();

  const planMap = new Map((plansQuery.data?.plans ?? []).map((plan) => [plan.id, plan]));
  const currentPlan = activePlanId ? planMap.get(activePlanId) : undefined;
  const isSubscribed = ACTIVE_STATUSES.has(statusLabel);
  const isSubscription = statusQuery.data?.mode === "subscription";
  const hasActiveSubscription = isSubscribed && isSubscription;
  const cancelDate = isSubscription ? (statusQuery.data?.cancelAt ?? false) : false;

  const loading = statusQuery.isLoading || plansQuery.isLoading;
  const errored = statusQuery.error ?? plansQuery.error;
  const allPlans = plansQuery.data?.plans ?? [];

  const plusMonthly = allPlans.find((p) => p.id === "plus_monthly");
  const plusYearly = allPlans.find((p) => p.id === "plus_yearly");
  const proMonthly = allPlans.find((p) => p.id === "pro_monthly");
  const proYearly = allPlans.find((p) => p.id === "pro_yearly");
  const maxMonthly = allPlans.find((p) => p.id === "max_monthly");
  const maxYearly = allPlans.find((p) => p.id === "max_yearly");
  const proLifetime = allPlans.find((p) => p.id === "pro_lifetime");

  const selectedPlusPlan = plusInterval === "monthly" ? plusMonthly : plusYearly;
  const selectedProPlan = proInterval === "monthly" ? proMonthly : proYearly;
  const selectedMaxPlan = maxInterval === "monthly" ? maxMonthly : maxYearly;
  const yearlySavingsPercent = Math.max(
    calculateYearlySavingsPercent(plusYearly, plusMonthly),
    calculateYearlySavingsPercent(proYearly, proMonthly),
    calculateYearlySavingsPercent(maxYearly, maxMonthly),
  );
  const basicUsage = usage.find((entry) => entry.category === "basic");
  const premiumUsage = usage.find((entry) => entry.category === "premium");

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <SettingsPageShell
      title={t("Billing")}
      description={t("Manage your subscription and usage")}
      className="max-w-6xl"
    >
      <BillingCurrentPlanCard
        isOnTeamPlan={isOnTeamPlan}
        rawPlanId={rawPlanId}
        currentPlan={currentPlan}
        activePlanId={activePlanId}
        cancelDate={cancelDate}
        currentPeriodEnd={statusQuery.data?.currentPeriodEnd}
        stripeCustomerId={statusQuery.data?.stripeCustomerId}
        hasActiveSubscription={hasActiveSubscription}
        portalPending={portal.isPending}
        cancelPending={cancel.isPending || shredOpen}
        resumePending={resume.isPending}
        onPortal={() => portal.mutate()}
        onCancel={() => setShredOpen(true)}
        onResume={() => resume.mutate()}
      />

      <BillingUsageSection
        usageTierLabel={usageTierLabel}
        isLoading={usageQuery.isLoading}
        errorMessage={usageQuery.error?.message}
        basicUsage={basicUsage}
        premiumUsage={premiumUsage}
        maxModeEnabled={maxModeQuery.data?.enabled}
      />

      <CardVerificationCard
        isFreeTier={usageTier === "free"}
        hasVerifiedPaymentMethod={usageQuery.data?.hasVerifiedPaymentMethod ?? false}
      />

      {maxModeQuery.data?.eligible && maxModeQuery.data && (
        <BillingMaxModeCard
          data={maxModeQuery.data}
          onToggle={handleMaxModeToggle}
          isToggling={enableMaxMode.isPending || disableMaxMode.isPending}
        />
      )}

      <BillingPlansSection
        erroredMessage={errored?.message}
        yearlySavingsPercent={yearlySavingsPercent}
        hasActiveSubscription={hasActiveSubscription}
        selectedPlusPlan={selectedPlusPlan}
        plusMonthly={plusMonthly}
        plusInterval={plusInterval}
        onPlusIntervalChange={setPlusInterval}
        selectedProPlan={selectedProPlan}
        proMonthly={proMonthly}
        proInterval={proInterval}
        onProIntervalChange={setProInterval}
        selectedMaxPlan={selectedMaxPlan}
        maxMonthly={maxMonthly}
        maxInterval={maxInterval}
        onMaxIntervalChange={setMaxInterval}
        proLifetime={proLifetime}
        isOnTeamPlan={isOnTeamPlan}
        planActions={{
          activePlanId,
          isSubscribed,
          hasActiveSubscription,
          isOnTeamPlan,
          pendingPlanId,
          isEstimateLoading: estimateQuery.isLoading,
          cancelDate,
          changePlan,
          checkout: createCheckout,
          onChangePlanClick: handleChangePlanClick,
          onCheckout: handleCheckout,
        }}
      />

      <BillingChangePlanDialog
        open={isChangePlanOpen}
        onOpenChange={handleDialogOpenChange}
        changeTarget={changeTarget}
        estimate={estimateQuery}
        hasAgreed={hasAgreed}
        onHasAgreedChange={setHasAgreed}
        isPending={changePlan.isPending}
        onConfirm={(planId) => {
          changePlanPendingRef.current = true;
          changePlan.mutate({ planId });
        }}
      />

      <SubscriptionShredder
        data={
          {
            sessionId: statusQuery.data?.stripeCustomerId ?? activePlanId ?? "cancel",
            ...getReceiptCopy(activePlanId, "/settings/billing", t("Home")),
            amountTotal: currentPlan?.amount ?? 0,
            amountSubtotal: currentPlan?.amount ?? null,
            amountTax: null,
            amountDiscount: null,
            currency: currentPlan?.currency ?? "usd",
            paymentMethodBrand: null,
            paymentMethodLast4: null,
            paidAt: statusQuery.data?.currentPeriodEnd ?? new Date().toISOString(),
          } satisfies SubscriptionReceiptData
        }
        onClose={() => setShredOpen(false)}
        onConfirm={async () => {
          await cancel.mutateAsync();
        }}
        open={shredOpen}
      />
    </SettingsPageShell>
  );
}

export function BillingPage() {
  if (isBillingDisabled) {
    return <BillingDisabled />;
  }

  return <BillingPageContent />;
}
