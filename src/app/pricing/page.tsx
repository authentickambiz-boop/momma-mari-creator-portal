import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PricingCatalog } from "@/components/pricing-catalog";
import { publicPageMeta } from "@/lib/public-meta";
import { pricingPageEnabled } from "@/lib/pricing-page-flag";
import { PUBLIC_ROBOTS } from "@/lib/public-site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const enabled = pricingPageEnabled();
  return {
    ...publicPageMeta({
      title: "Plans & Services · Momma Mari",
      description: "Plus, Pro, and Business plans, plus media kits, rate cards, contract reviews, and starter kits.",
      path: "/pricing",
    }),
    robots: enabled ? PUBLIC_ROBOTS : { index: false, follow: false },
  };
}

export default async function PricingPage() {
  if (!pricingPageEnabled()) notFound();
  return <PricingCatalog preview={false} />;
}
