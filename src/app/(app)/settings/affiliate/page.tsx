import dynamic from "next/dynamic";

const AffiliatePage = dynamic(
  () => import("@/components/affiliate/affiliate-page").then((mod) => mod.AffiliatePage),
  {
    loading: () => (
      <div className="flex min-h-[60vh] w-full items-center justify-center text-sm text-muted-foreground">
        Loading affiliate settings…
      </div>
    ),
  },
);

export default function AffiliateSettingsPage() {
  return <AffiliatePage />;
}
