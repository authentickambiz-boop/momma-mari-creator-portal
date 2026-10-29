import type { Metadata } from "next";
import { PricingCatalog } from "@/components/pricing-catalog";
import { PricingServices } from "@/components/pricing-services";
import { paymentsEnabled } from "@/lib/payments-config";
import { publicPageMeta } from "@/lib/public-meta";
import { PUBLIC_ROBOTS } from "@/lib/public-site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const open = paymentsEnabled();
  return {
    ...publicPageMeta({
      title: "Plans & Services · Momma Mari",
      description: open
        ? "Plus, Pro, and Business plans, plus media kits, rate cards, contract reviews, and starter kits."
        : "Media kits, rate cards, contract reviews, and starter kits. Monthly plans are coming soon.",
      path: "/pricing",
    }),
    robots: PUBLIC_ROBOTS,
  };
}

export default async function PricingPage() {
  if (!paymentsEnabled()) return <PricingServices />;
  return <PricingCatalog preview={false} />;
}
