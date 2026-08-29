"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/auth-provider";
import { DesignStyleProvider } from "@/hooks/use-design-style";
import { useAuthLocalization } from "@/hooks/use-auth-localization";
import { ThemePresetProvider } from "@/hooks/use-theme-preset";
import { captchaPlugin } from "@/lib/auth/captcha-plugin";
import { deleteUserPlugin } from "@/lib/auth/delete-user-plugin";
import { magicLinkPlugin } from "@/lib/auth/magic-link-plugin";
import { passkeyPlugin } from "@/lib/auth/passkey-plugin";
import { authClient } from "@/lib/auth-client";
import type { PlatformCapabilities } from "@/lib/platform-capabilities";
import { getQueryClient } from "@/lib/query-client";
import { makeTRPCClient } from "@/lib/trpc/client";
import { trpc } from "@/lib/trpc/react";
import { PlatformCapabilitiesProvider } from "./platform-capabilities-provider";
import { ServiceWorkerRegistration } from "./pwa/service-worker-registration";
import { TooltipProvider } from "./ui/tooltip";

const trpcClient = makeTRPCClient();
// Stable captcha plugin instance (no localization) — avoids recreating on every locale pass
const captchaPluginInstance = captchaPlugin();

export function AppProviders({
  children,
  platformCapabilities,
}: {
  children: ReactNode;
  platformCapabilities: PlatformCapabilities;
}) {
  const t = useExtracted();
  const router = useRouter();
  const queryClient = getQueryClient();
  const localization = useAuthLocalization();

  const navigate = ({ to, replace }: { to: string; replace?: boolean }) => {
    if (replace) router.replace(to);
    else router.push(to);
  };

  const avatarUpload = async (file: File) => {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(t("Failed to read file")));
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") resolve(result);
        else reject(new Error(t("Unexpected result from FileReader")));
      };
      reader.readAsDataURL(file);
    });
  };

  const plugins = [
    ...(platformCapabilities.auth.captcha ? [captchaPluginInstance] : []),
    passkeyPlugin({ localization: localization.plugins.passkey }),
    deleteUserPlugin({ localization: localization.plugins.deleteUser }),
    magicLinkPlugin({ localization: localization.plugins.magicLink }),
  ];

  return (
    <PlatformCapabilitiesProvider value={platformCapabilities}>
      <ThemePresetProvider>
        <DesignStyleProvider>
          <TooltipProvider>
            <QueryClientProvider client={queryClient}>
              <trpc.Provider client={trpcClient} queryClient={queryClient}>
                <AuthProvider
                  authClient={authClient}
                  queryClient={queryClient}
                  redirectTo="/chat"
                  socialProviders={platformCapabilities.auth.socialProviders}
                  localization={{
                    auth: localization.auth,
                    settings: localization.settings,
                  }}
                  basePaths={{
                    auth: "/auth",
                    // Preserve legacy /account/* URLs (app settings use /settings/*)
                    settings: "/account",
                  }}
                  viewPaths={{
                    settings: {
                      account: "settings",
                      security: "security",
                    },
                  }}
                  emailAndPassword={{
                    enabled: true,
                    forgotPassword: true,
                    // Match server: after sign-up, show verify-email instead of redirecting to app
                    requireEmailVerification: true,
                  }}
                  avatar={{
                    enabled: true,
                    upload: avatarUpload,
                  }}
                  navigate={navigate}
                  plugins={plugins}
                  Link={Link}
                >
                  {children}
                  <ServiceWorkerRegistration />
                </AuthProvider>
              </trpc.Provider>
            </QueryClientProvider>
          </TooltipProvider>
        </DesignStyleProvider>
      </ThemePresetProvider>
    </PlatformCapabilitiesProvider>
  );
}
