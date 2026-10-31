"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { requestClientIp } from "@/lib/request-ip";
import { signupCookieOptions, FREE_SIGNUP_COOKIE, prepareFreeSignup, SIGNUP_GRANT_COOKIE } from "@/lib/signup-codes";

export async function beginFreeSignupAction(formData: FormData) {
  const db = await getDb();
  const headerList = await headers();
  const prepared = await prepareFreeSignup(db, {
    code: String(formData.get("code") ?? ""),
    honeypot: String(formData.get("company") ?? ""),
    ip: requestClientIp(headerList),
  });
  if (!prepared.ok) redirect(`/signup?error=${prepared.error}`);
  const jar = await cookies();
  jar.set(FREE_SIGNUP_COOKIE, "1", signupCookieOptions());
  if (prepared.grant) jar.set(SIGNUP_GRANT_COOKIE, prepared.grant, signupCookieOptions());
  else jar.set(SIGNUP_GRANT_COOKIE, "", { ...signupCookieOptions(), maxAge: 0 });
  redirect("/api/auth/google?intent=signup");
}
