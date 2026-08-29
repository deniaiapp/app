import { AppProviders } from "@/components/providers";
import { platformCapabilities } from "@/lib/platform-capabilities.server";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AppProviders platformCapabilities={platformCapabilities}>{children}</AppProviders>;
}
