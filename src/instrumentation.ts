import { logPortalError } from "@/lib/portal-error";

export async function register() {
  // Present so Next loads this file. Errors are recorded in onRequestError.
}

type RequestErrorContext = {
  routePath?: string;
  routeType?: string;
};

/**
 * Server Components hide the real message from the browser.
 * This keeps that message in the server log next to the short reference id.
 */
export async function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: RequestErrorContext,
) {
  const digest = error && typeof error === "object" && "digest" in error
    ? String((error as { digest?: unknown }).digest ?? "")
    : "";
  const path = (request.path ?? "").split("?")[0];
  const where = [context.routeType, context.routePath, request.method, path].filter(Boolean).join(" ");
  logPortalError(where || "request", error, digest || null);
}
