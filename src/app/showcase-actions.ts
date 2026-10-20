"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { saveOwnerShowcase } from "@/lib/public-creators";
import { showcaseErrorCode } from "@/lib/showcase-notes";

export async function savePublicShowcaseAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const creatorId = String(formData.get("creatorId") ?? "");
  const db = await getDb();
  const result = await saveOwnerShowcase(db, viewer, {
    creatorId,
    publicOn: formData.get("publicOn") === "1",
    bio: String(formData.get("bio") ?? ""),
    photoPath: String(formData.get("photoPath") ?? ""),
    creatorOnlyPhoto: formData.get("creatorOnlyPhoto") === "1",
  });
  const back = `/analytics?creator=${encodeURIComponent(creatorId)}`;
  if (!result.ok) redirect(`${back}&showcaseError=${showcaseErrorCode(result.error)}`);
  redirect(`${back}&saved=1`);
}
