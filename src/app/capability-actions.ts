"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import {
  createScopedBot,
  managerAct,
  reviewCapabilityDraft,
  revokeScopedBot,
  setCapabilityLevel,
  setTrainingChecks,
  type CapabilityEffect,
} from "@/lib/capabilities";
import { currentViewer } from "@/lib/current-user";

function back(error?: string, saved?: string) {
  const query = new URLSearchParams();
  if (error) query.set("accessError", error);
  if (saved) query.set("saved", saved);
  const suffix = query.toString();
  return suffix ? `/access?${suffix}` : "/access";
}

export async function saveCapabilityAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const subjectType = String(formData.get("subjectType") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const capability = String(formData.get("capability") ?? "");
  const level = String(formData.get("level") ?? "");
  if (subjectType !== "manager" && subjectType !== "bot") redirect(back("Pick a person or a bot."));
  const db = await getDb();
  const training = await setTrainingChecks(db, {
    actorRole: viewer.role,
    actorEmail: viewer.email,
    subjectType,
    subjectId,
    capability,
    checked: formData.getAll("training").map(String),
  });
  if (!training.ok) redirect(back(training.error));
  const result = await setCapabilityLevel(db, {
    actorRole: viewer.role,
    actorEmail: viewer.email,
    subjectType,
    subjectId,
    capability,
    level,
  });
  if (!result.ok) redirect(back(result.error));
  redirect(back(undefined, "level"));
}

export async function reviewCapabilityAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const intent = String(formData.get("intent") ?? "");
  if (intent !== "approve" && intent !== "reject") redirect(back("Pick approve or reject."));
  const db = await getDb();
  const result = await reviewCapabilityDraft(db, {
    actorRole: viewer.role,
    actorEmail: viewer.email,
    draftId: String(formData.get("draftId") ?? ""),
    intent,
  });
  if (!result.ok) redirect(back(result.error));
  redirect(back(undefined, result.status));
}

export async function createBotAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await createScopedBot(db, {
    actorRole: viewer.role,
    actorEmail: viewer.email,
    name: String(formData.get("name") ?? ""),
  });
  if (!result.ok) redirect(back(result.error));
  redirect(back(undefined, "bot"));
}

export async function revokeBotAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await revokeScopedBot(db, {
    actorRole: viewer.role,
    actorEmail: viewer.email,
    botId: String(formData.get("botId") ?? ""),
  });
  if (!result.ok) redirect(back(result.error));
  redirect(back(undefined, "revoked"));
}

export async function submitCapabilityAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const capability = String(formData.get("capability") ?? "");
  const dealId = String(formData.get("dealId") ?? "").trim();
  const summary = String(formData.get("summary") ?? "");
  const note = String(formData.get("note") ?? "");
  const body = String(formData.get("body") ?? "");
  let effect: CapabilityEffect | null = null;
  if (capability === "negotiate" || capability === "review_contracts") effect = { kind: capability, dealId, note };
  else if (capability === "outreach") {
    effect = {
      kind: "outreach",
      dealId,
      to: String(formData.get("to") ?? ""),
      subject: String(formData.get("subject") ?? ""),
      body,
    };
  } else if (capability === "draft_replies") effect = { kind: "draft_replies", dealId, body };
  else if (capability === "approve_deals") effect = { kind: "approve_deals", dealId };
  if (!effect) redirect(back("Pick a capability."));
  const db = await getDb();
  const result = await managerAct(db, viewer, { capability, summary, effect });
  if (!result.ok) redirect(back(result.error));
  redirect(back(undefined, result.mode));
}
