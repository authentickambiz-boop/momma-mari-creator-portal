import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OfficeApp } from "@/components/worlds/office-app";
import { isOwner } from "@/lib/authz";
import { requireViewer } from "@/lib/current-user";
import { canOpenCharacterCreator } from "@/lib/worlds/character";
import { worldsCityEnabled } from "@/lib/worlds/city/flag";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bot office · Momma Mari",
  robots: { index: false, follow: false },
};

export default async function WorldsPage() {
  const viewer = await requireViewer("/worlds");
  if (!isOwner(viewer)) notFound();
  return <OfficeApp charactersEnabled={canOpenCharacterCreator(viewer)} place="office" cityEnabled={worldsCityEnabled()} />;
}
