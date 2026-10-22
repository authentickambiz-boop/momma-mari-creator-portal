"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { promoErrorCode } from "@/lib/promo-notes";
import { savePromoVisual } from "@/lib/promo-visuals";

function safeReturn(value: string) {
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || /[\r\n]/.test(path)) return "/offers";
  const bare = path.split("?")[0] ?? "";
  if (bare.startsWith("/offers") || bare.startsWith("/gifts") || bare.startsWith("/deals")) return path;
  return "/offers";
}

function withNote(path: string, key: string, value: string) {
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}${key}=${encodeURIComponent(value)}`;
}

export async function savePromoVisualAction(formData: FormData) {
  const viewer = await currentViewer();
  const returnTo = safeReturn(String(formData.get("returnTo") ?? ""));
  if (!viewer) redirect("/login");
  const db = await getDb();
  const file = formData.get("imageFile");
  let upload: { mimeType: string; bytes: Uint8Array } | null = null;
  if (file instanceof File && file.size > 0) {
    upload = { mimeType: file.type || "application/octet-stream", bytes: new Uint8Array(await file.arrayBuffer()) };
  }
  const result = await savePromoVisual(db, viewer, {
    subjectType: String(formData.get("subjectType") ?? ""),
    subjectId: String(formData.get("subjectId") ?? ""),
    productName: String(formData.get("productName") ?? ""),
    productPageUrl: String(formData.get("productPageUrl") ?? ""),
    ownerImageUrl: String(formData.get("ownerImageUrl") ?? ""),
    upload,
  });
  if (!result.ok) redirect(withNote(returnTo, "promoError", promoErrorCode(result.error)));
  redirect(withNote(returnTo, "promo", "saved"));
}
