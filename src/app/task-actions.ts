"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { markCreatorTaskDone, saveCreatorTask } from "@/lib/creator-tasks";

const DONE_CODES: Record<string, string> = {
  "That to-do is not on your list.": "missing",
  "You can only update your own to-dos.": "own",
  "You can't update this to-do.": "role",
};

const SAVE_CODES: Record<string, string> = {
  "You can't edit these to-dos.": "role",
  "That to-do is not on your list.": "missing",
  "Add a title.": "title",
  "Choose a category.": "category",
  "Choose a status.": "status",
  "Due date must be a real day like 2026-11-20.": "date",
};

export async function markTaskDoneAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await markCreatorTaskDone(db, viewer, String(formData.get("id") ?? ""));
  if (!result.ok) redirect(`/?todo=${DONE_CODES[result.error] ?? "1"}`);
  redirect("/?todo=done");
}

export async function saveCreatorTaskAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await saveCreatorTask(db, viewer, {
    id: String(formData.get("id") ?? ""),
    title: String(formData.get("title") ?? ""),
    detail: String(formData.get("detail") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
    category: String(formData.get("category") ?? ""),
    status: String(formData.get("status") ?? ""),
  });
  if (!result.ok) redirect(`/dashboard?todo=${SAVE_CODES[result.error] ?? "1"}`);
  redirect("/dashboard?saved=1");
}
