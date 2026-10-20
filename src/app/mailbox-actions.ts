"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { disconnectMailbox } from "@/lib/gmail-push";
import { disconnectErrorCode } from "@/lib/mailbox-notes";

export async function disconnectMailboxAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "admin") redirect("/login");
  const db = await getDb();
  const result = await disconnectMailbox(db, String(formData.get("email") ?? ""));
  if (result.status !== 200) {
    const error = result.body && typeof result.body === "object" && "error" in result.body ? String(result.body.error ?? "") : "";
    redirect(`/connect?gmail=${disconnectErrorCode(error)}`);
  }
  redirect("/connect?gmail=disconnected");
}
