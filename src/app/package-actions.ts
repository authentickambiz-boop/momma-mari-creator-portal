"use server";

import { redirect } from "next/navigation";

/** Deposit checkout is not wired. This never starts a Stripe session. */
export async function bookPackageAction() {
  redirect("/packages?checkout=off");
}
