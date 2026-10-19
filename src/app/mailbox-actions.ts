"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { disconnectMailbox } from "@/lib/gmail-push";

export async function disconnectMailboxAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "admin") redirect("/login");
  const db = await getDb();
  const result = await disconnectMailbox(db, String(formData.get("email") ?? ""));
  if (result.status !== 200) redirect("/connect?gmail=oauth");
  redirect("/connect?gmail=disconnected");
}
