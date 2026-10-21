"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { companyNoteErrorCode } from "@/lib/company-notes";
import { savePublicNote } from "@/lib/company-pages";

async function saveNote(path: "/contact" | "/careers", subject: "Contact" | "Talent network", formData: FormData) {
  const db = await getDb();
  const result = await savePublicNote(db, {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    message: String(formData.get("message") ?? ""),
    subject,
    honeypot: String(formData.get("website") ?? ""),
  });
  if (!result.ok) redirect(`${path}?noteError=${companyNoteErrorCode(result.error)}`);
  redirect(`${path}?saved=1`);
}

export async function saveContactAction(formData: FormData) {
  await saveNote("/contact", "Contact", formData);
}

export async function saveTalentAction(formData: FormData) {
  await saveNote("/careers", "Talent network", formData);
}
