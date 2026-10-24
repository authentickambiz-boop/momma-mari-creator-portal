import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OfficeApp } from "@/components/worlds/office-app";
import { isOwner } from "@/lib/authz";
import { requireViewer } from "@/lib/current-user";
import { worldsCityEnabled } from "@/lib/worlds/city/flag";
import { canOpenCharacterCreator } from "@/lib/worlds/character";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Worlds city · Momma Mari",
  robots: { index: false, follow: false },
};

export default async function WorldsCityPage() {
  const viewer = await requireViewer("/worlds/city");
  if (!isOwner(viewer) || !worldsCityEnabled()) notFound();
  return <OfficeApp charactersEnabled={canOpenCharacterCreator(viewer)} cityMode />;
}
