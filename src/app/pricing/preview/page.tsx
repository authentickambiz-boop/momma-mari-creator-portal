import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PricingCatalog } from "@/components/pricing-catalog";
import { isOwner } from "@/lib/authz";
import { currentViewer } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plans & Services preview · Momma Mari",
  robots: { index: false, follow: false },
};

export default async function PricingPreviewPage() {
  const viewer = await currentViewer();
  if (!viewer || !isOwner(viewer)) notFound();
  return <PricingCatalog preview />;
}
