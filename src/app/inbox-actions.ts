"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { classifyThread, queueBrandReply, setThreadPrivate } from "@/lib/gmail-bridge";
import { inboxErrorCode } from "@/lib/inbox-notes";
import { currentViewer } from "@/lib/current-user";

function back(query: string) {
  redirect(`/inbox?${query}`);
}

function withCreator(formData: FormData, query: string) {
  const creator = String(formData.get("creator") ?? "").trim();
  if (!creator) return query;
  return `${query}&creator=${encodeURIComponent(creator)}`;
}

export async function queueBrandReplyAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await queueBrandReply(db, viewer, {
    threadId: String(formData.get("threadId") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  if (!result.ok) back(`error=${inboxErrorCode(result.error)}`);
  back("reply=saved");
}

export async function markThreadPrivateAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await setThreadPrivate(db, viewer, String(formData.get("threadId") ?? ""), formData.get("private") === "1");
  if (!result.ok) back(`error=${inboxErrorCode(result.error)}`);
  back("reply=private");
}

export async function classifyThreadAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const classification = String(formData.get("classification") ?? "");
  const result = await classifyThread(db, viewer, String(formData.get("threadId") ?? ""), classification);
  if (!result.ok) back(withCreator(formData, `error=${inboxErrorCode(result.error)}`));
  const reply = classification === "not_deal" ? "not_deal" : "deal";
  back(withCreator(formData, `reply=${reply}`));
}
