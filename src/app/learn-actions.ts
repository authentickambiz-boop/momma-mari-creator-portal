"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { saveSkillLesson } from "@/lib/skill-lessons";

function back(formData: FormData, code?: string): never {
  const creator = String(formData.get("returnCreator") ?? "").trim();
  const params = new URLSearchParams();
  if (creator) params.set("creator", creator);
  if (code) params.set("error", code);
  else params.set("saved", "1");
  redirect(`/learn?${params.toString()}`);
}

export async function saveSkillLessonAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const lessonId = String(formData.get("lessonId") ?? "").trim();
  const audience = String(formData.get("audience") ?? "").trim();
  const result = await saveSkillLesson(db, viewer, {
    id: lessonId || null,
    topic: String(formData.get("topic") ?? ""),
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    creatorId: audience || null,
  });
  if (!result.ok) back(formData, result.code);
  back(formData);
}
