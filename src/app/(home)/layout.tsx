import Footer from "@/components/footer";
import Header from "@/components/header";
import { AppProviders } from "@/components/providers";
import { platformCapabilities } from "@/lib/platform-capabilities.server";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders platformCapabilities={platformCapabilities}>
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </AppProviders>
  );
}
