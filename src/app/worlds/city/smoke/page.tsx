import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CitySmokeApp } from "@/components/worlds/city/smoke-app";
import { worldsCitySmokeEnabled } from "@/lib/worlds/city/flag";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Worlds city smoke · Momma Mari",
  robots: { index: false, follow: false },
};

/** QC hatch for the owner panel. Hidden unless both city flags are exactly "true". */
export default function WorldsCitySmokePage() {
  if (!worldsCitySmokeEnabled()) notFound();
  return <CitySmokeApp />;
}
