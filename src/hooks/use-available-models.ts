import type { ModelOption } from "@/components/chat/chat-composer";
import { authClient } from "@/lib/auth-client";
import { getModelsForPlanTier } from "@/lib/constants";
import { trpc } from "@/lib/trpc/react";
import { liveUsageQueryOptions } from "@/lib/usage-query-options";

type ProviderSetting = {
  provider: string;
  preferByok: boolean;
  baseUrl: string | null;
};

export function useAvailableModels() {
  const session = authClient.useSession();
  const isAnonymous = Boolean(session.data?.user?.isAnonymous);

  // Default to free until tier is known so free users never briefly see paid models.
  // Share options with useUsageStatus so both hooks hit the same cached query.
  const usageQuery = trpc.billing.usage.useQuery(undefined, {
    ...liveUsageQueryOptions,
    enabled: Boolean(session.data?.user) && !isAnonymous,
  });
  const planTier = isAnonymous ? "free" : (usageQuery.data?.tier ?? "free");

  const providersQuery = trpc.providers.getConfig.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  const availableModels: ModelOption[] = getModelsForPlanTier(planTier);

  const providerSettings = new Map<string, ProviderSetting>(
    (providersQuery.data?.settings ?? []).map((setting) => [setting.provider, setting]),
  );

  const providerKeys = new Set((providersQuery.data?.keys ?? []).map((entry) => entry.provider));

  return {
    availableModels,
    providerSettings,
    providerKeys,
    providersQuery,
    isAnonymous,
    planTier,
  };
}
