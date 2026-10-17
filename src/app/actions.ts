"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { devLoginEnabled } from "@/lib/authz";
import { resolveLogin } from "@/lib/queries";
import { createSession, destroySession, sessionCookieName, sessionCookieOptions } from "@/lib/session";

export async function logoutAction() {
  const jar = await cookies();
  const db = await getDb();
  await destroySession(db, jar.get(sessionCookieName())?.value);
  jar.delete(sessionCookieName());
  redirect("/login");
}

export async function devLoginAction(formData: FormData) {
  if (!devLoginEnabled()) redirect("/login?error=dev_disabled");
  const email = String(formData.get("email") ?? "");
  const db = await getDb();
  const result = await resolveLogin(db, email);
  if (!result.ok) redirect("/login?error=not_allowed");
  const session = await createSession(db, result.viewer);
  const jar = await cookies();
  jar.set(sessionCookieName(), session.cookieValue, sessionCookieOptions());
  redirect("/");
}
