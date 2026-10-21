import type { Metadata } from "next";
import { PricingCatalog } from "@/components/pricing-catalog";
import { PricingWaitlist } from "@/components/pricing-waitlist";
import { paymentsEnabled } from "@/lib/payments-config";
import { publicPageMeta } from "@/lib/public-meta";
import { PUBLIC_ROBOTS } from "@/lib/public-site";
import { waitlistNote } from "@/lib/pricing-waitlist";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const open = paymentsEnabled();
  return {
    ...publicPageMeta({
      title: "Plans & Services · Momma Mari",
      description: open
        ? "Plus, Pro, and Business plans, plus media kits, rate cards, contract reviews, and starter kits."
        : "Coming soon, join waitlist",
      path: "/pricing",
    }),
    robots: PUBLIC_ROBOTS,
  };
}

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ waitlist?: string }> }) {
  const params = await searchParams;
  if (!paymentsEnabled()) return <PricingWaitlist notice={waitlistNote(params.waitlist)} />;
  return <PricingCatalog preview={false} />;
}
