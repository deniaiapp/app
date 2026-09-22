"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/auth-provider";
import { useAuthLocalization } from "@/hooks/use-auth-localization";
import { captchaPlugin } from "@/lib/auth/captcha-plugin";
import { deleteUserPlugin } from "@/lib/auth/delete-user-plugin";
import { magicLinkPlugin } from "@/lib/auth/magic-link-plugin";
import { passkeyPlugin } from "@/lib/auth/passkey-plugin";
import { authClient } from "@/lib/auth-client";
import type { PlatformCapabilities } from "@/lib/platform-capabilities";
import { getQueryClient } from "@/lib/query-client";
import { CommonProviders } from "./common-providers";

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
    <CommonProviders platformCapabilities={platformCapabilities} queryClient={queryClient}>
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
      </AuthProvider>
    </CommonProviders>
  );
}
