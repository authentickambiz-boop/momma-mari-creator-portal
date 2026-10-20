"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { inviteErrorCode } from "@/lib/invite-notes";
import { setPlatformInviteDone } from "@/lib/platform-invites";

export async function togglePlatformInviteAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await setPlatformInviteDone(db, viewer, String(formData.get("id") ?? ""), formData.get("done") === "1");
  const home = viewer.role === "admin" ? "/dashboard" : "/";
  if (!result.ok) redirect(`${home}?invite=${inviteErrorCode(result.error)}`);
  redirect(home);
}
