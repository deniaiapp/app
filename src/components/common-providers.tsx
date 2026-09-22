"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { DesignStyleProvider } from "@/hooks/use-design-style";
import { ThemePresetProvider } from "@/hooks/use-theme-preset";
import type { PlatformCapabilities } from "@/lib/platform-capabilities";
import { getQueryClient } from "@/lib/query-client";
import { makeTRPCClient } from "@/lib/trpc/client";
import { trpc } from "@/lib/trpc/react";
import { PlatformCapabilitiesProvider } from "./platform-capabilities-provider";
import { ServiceWorkerRegistration } from "./pwa/service-worker-registration";
import { TooltipProvider } from "./ui/tooltip";

const trpcClient = makeTRPCClient();

/**
 * Shared client infrastructure that does not require Better Auth UI.
 *
 * Keep this separate from AppProviders so read-only surfaces such as shared
 * chats do not pull authentication views and plugins into their browser graph.
 */
export function CommonProviders({
  children,
  platformCapabilities,
  queryClient: providedQueryClient,
}: {
  children: ReactNode;
  platformCapabilities: PlatformCapabilities;
  queryClient?: QueryClient;
}) {
  const queryClient = providedQueryClient ?? getQueryClient();

  return (
    <PlatformCapabilitiesProvider value={platformCapabilities}>
      <ThemePresetProvider>
        <DesignStyleProvider>
          <TooltipProvider>
            <QueryClientProvider client={queryClient}>
              <trpc.Provider client={trpcClient} queryClient={queryClient}>
                {children}
              </trpc.Provider>
            </QueryClientProvider>
          </TooltipProvider>
        </DesignStyleProvider>
      </ThemePresetProvider>
      <ServiceWorkerRegistration />
    </PlatformCapabilitiesProvider>
  );
}
