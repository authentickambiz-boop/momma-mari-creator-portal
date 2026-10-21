"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { finishIntake, intakeErrorCode, isIntakeStep, nextIntakeStep, saveIntakeStep } from "@/lib/intake-form";
import { requestClientIp } from "@/lib/request-ip";

function baseFor(intent: string) {
  return intent === "bench" ? "/bench/join" : "/apply";
}

export async function saveIntakeAction(formData: FormData) {
  const intent: "apply" | "bench" = String(formData.get("intent") ?? "") === "bench" ? "bench" : "apply";
  const base = baseFor(intent);
  const stepValue = String(formData.get("step") ?? "");
  const step = isIntakeStep(stepValue) ? stepValue : "contact";
  const token = String(formData.get("token") ?? "");
  const action = String(formData.get("intakeAction") ?? "next");
  const db = await getDb();
  const headerList = await headers();
  const meta = {
    token: token || undefined,
    honeypot: String(formData.get("website") ?? ""),
    ip: requestClientIp(headerList),
    channel: intent,
  };
  if (action === "submit") {
    const result = await finishIntake(db, formData, meta);
    if (!result.ok) {
      const nextToken = token ? `&token=${encodeURIComponent(token)}` : "";
      redirect(`${base}?step=analytics&intakeError=${intakeErrorCode(result.error)}${nextToken}`);
    }
    if ("dropped" in result && result.dropped) redirect("/apply/thanks");
    if (result.route === "curriculum" && result.band) redirect(`/curriculum?band=${result.band}`);
    redirect("/apply/thanks");
  }
  const saved = await saveIntakeStep(db, step, formData, meta);
  if (!saved.ok) {
    const nextToken = token ? `&token=${encodeURIComponent(token)}` : "";
    redirect(`${base}?step=${step}&intakeError=${intakeErrorCode(saved.error)}${nextToken}`);
  }
  if ("dropped" in saved && saved.dropped) redirect("/apply/thanks");
  const destination = action === "save" ? step : nextIntakeStep(step);
  const savedFlag = action === "save" ? "&saved=1" : "";
  redirect(`${base}?step=${destination}&token=${encodeURIComponent(saved.token)}${savedFlag}`);
}
