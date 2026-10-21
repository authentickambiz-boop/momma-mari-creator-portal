"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { saveFeedback } from "@/lib/feedback";
import { feedbackErrorCode } from "@/lib/feedback-notes";
import { requestClientIp } from "@/lib/request-ip";

export async function saveFeedbackAction(formData: FormData) {
  const db = await getDb();
  const viewer = await currentViewer();
  const headerList = await headers();
  const result = await saveFeedback(db, viewer, {
    category: String(formData.get("category") ?? ""),
    rating: String(formData.get("rating") ?? ""),
    body: String(formData.get("body") ?? ""),
    followUp: formData.get("followUp") === "1",
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("name") ?? ""),
    honeypot: String(formData.get("website") ?? ""),
    ip: requestClientIp(headerList),
  });
  if (!result.ok) redirect(`/feedback?feedbackError=${feedbackErrorCode(result.error)}`);
  redirect("/feedback?saved=1");
}
