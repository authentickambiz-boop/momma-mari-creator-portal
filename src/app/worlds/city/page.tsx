import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OfficeApp } from "@/components/worlds/office-app";
import { isOwner } from "@/lib/authz";
import { requireViewer } from "@/lib/current-user";
import { canOpenCharacterCreator } from "@/lib/worlds/character";
import { worldsCityEnabled } from "@/lib/worlds/city/flag";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "City · Momma Mari Worlds",
  robots: { index: false, follow: false },
};

export default async function WorldsCityPage() {
  const viewer = await requireViewer("/worlds/city");
  if (!isOwner(viewer) || !worldsCityEnabled()) notFound();
  return <OfficeApp charactersEnabled={canOpenCharacterCreator(viewer)} place="city" cityEnabled cityMode />;
}
