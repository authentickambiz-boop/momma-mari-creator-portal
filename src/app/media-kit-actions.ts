"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { saveMediaKit } from "@/lib/media-kit";

export async function saveMediaKitAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await saveMediaKit(db, viewer, {
    creatorId: String(formData.get("creatorId") ?? ""),
    published: formData.get("published") === "1",
    displayName: String(formData.get("displayName") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    followers: String(formData.get("followers") ?? ""),
    avgViews: String(formData.get("avgViews") ?? ""),
    engagement: String(formData.get("engagement") ?? ""),
    niches: formData.getAll("niches").map((value) => String(value)).join(", "),
  });
  if (!result.ok) redirect(`/media-kit?kitError=${encodeURIComponent(result.error)}`);
  redirect(`/media-kit?saved=1&slug=${encodeURIComponent(result.slug)}`);
}
