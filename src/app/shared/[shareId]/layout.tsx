import { AppProviders } from "@/components/providers";
import { platformCapabilities } from "@/lib/platform-capabilities.server";

export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders platformCapabilities={platformCapabilities}>
      <div className="flex min-h-svh flex-col">
        <main className="flex flex-1 flex-col" id="main-content">
          {children}
        </main>
      </div>
    </AppProviders>
  );
}
