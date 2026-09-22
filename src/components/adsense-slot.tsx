"use client";

import { useEffect, useRef } from "react";
import { clientEnv } from "@/env.client";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc/react";
import { passiveUsageQueryOptions } from "@/lib/usage-query-options";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdSenseSlotProps = {
  slot: string;
  className?: string;
};

export function AdSenseSlot({ slot, className }: AdSenseSlotProps) {
  const slotRef = useRef<HTMLModElement | null>(null);
  const session = authClient.useSession();
  const hasSession = Boolean(session.data?.session);
  const shouldCheckUsage =
    hasSession &&
    process.env.NODE_ENV === "production" &&
    Boolean(clientEnv.NEXT_PUBLIC_ADSENSE_CLIENT_ID) &&
    Boolean(slot);
  const usageQuery = trpc.billing.usage.useQuery(undefined, {
    enabled: shouldCheckUsage,
    ...passiveUsageQueryOptions,
  });
  const usageStatePending =
    shouldCheckUsage && (usageQuery.isLoading || usageQuery.isError || !usageQuery.data);
  const isPaidUser = shouldCheckUsage && usageQuery.data ? usageQuery.data.tier !== "free" : false;

  useEffect(() => {
    if (!shouldCheckUsage || usageStatePending || isPaidUser) {
      return;
    }

    const element = slotRef.current;
    if (!element || element.getAttribute("data-adsbygoogle-status")) {
      return;
    }

    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      // Ignore double-init and ad blocker failures.
    }
  }, [isPaidUser, shouldCheckUsage, usageStatePending]);

  if (!shouldCheckUsage || session.isPending || usageStatePending || isPaidUser) {
    return null;
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] border border-border/60 bg-background/55 p-3 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.65)] backdrop-blur-md",
        "before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-foreground/20 before:to-transparent",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_50%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_50%)]" />
      <ins
        ref={slotRef}
        className="adsbygoogle relative block min-h-[96px] w-full overflow-hidden rounded-[1.2rem]"
        data-ad-client={clientEnv.NEXT_PUBLIC_ADSENSE_CLIENT_ID}
        data-ad-format="auto"
        data-ad-slot={slot}
        data-full-width-responsive="true"
        style={{ display: "block" }}
      />
    </div>
  );
}
