"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { questionnaireFieldPatch, saveQuestionnaireStep } from "@/lib/questionnaire";

export async function saveQuestionnaireAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const step = String(formData.get("step") ?? "");
  const patch = questionnaireFieldPatch(
    step,
    (name) => String(formData.get(name) ?? ""),
    (name) => formData.getAll(name).map((value) => String(value)),
  );
  const result = await saveQuestionnaireStep(db, viewer, {
    step,
    skip: formData.get("skip") === "1",
    pause: formData.get("pause") === "1",
    patch,
  });
  if (!result.ok) redirect(`/onboarding?step=${encodeURIComponent(step)}&questionError=${encodeURIComponent(result.error)}`);
  if (result.next === "home") redirect("/");
  if (result.next === "done") redirect("/onboarding?done=1");
  redirect(`/onboarding?step=${encodeURIComponent(result.next)}`);
}
