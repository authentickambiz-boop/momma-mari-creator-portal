"use server";

import { logPortalError, portalErrorRef } from "@/lib/portal-error";

/** The error page calls this so a client-side failure is in the server log too. */
export async function reportPortalError(input: { message?: string; digest?: string; stack?: string }) {
  const digest = (input.digest ?? "").slice(0, 120);
  const ref = portalErrorRef(digest || null);
  const error = new Error((input.message ?? "").slice(0, 500));
  if (input.stack) error.stack = input.stack.slice(0, 2000);
  logPortalError(digest ? `boundary digest=${digest}` : "boundary", error, ref);
  return ref;
}
