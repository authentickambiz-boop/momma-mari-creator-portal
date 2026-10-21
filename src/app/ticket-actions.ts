"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { openSupportTicket, replyToSupportTicket } from "@/lib/support-tickets";
import { ticketErrorCode } from "@/lib/ticket-notes";

export async function openPublicTicketAction(formData: FormData) {
  const db = await getDb();
  const result = await openSupportTicket(db, {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    category: String(formData.get("category") ?? ""),
    priority: String(formData.get("priority") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    body: String(formData.get("body") ?? ""),
    honeypot: String(formData.get("website") ?? ""),
  });
  if (!result.ok) redirect(`/help?ticketError=${ticketErrorCode(result.error)}`);
  redirect("/help?saved=1");
}

export async function replyTicketAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await replyToSupportTicket(db, viewer, {
    ticketId: String(formData.get("ticketId") ?? ""),
    body: String(formData.get("body") ?? ""),
    status: String(formData.get("status") ?? ""),
  });
  if (!result.ok) redirect(`/support?ticketError=${ticketErrorCode(result.error)}`);
  redirect("/support?saved=1");
}
