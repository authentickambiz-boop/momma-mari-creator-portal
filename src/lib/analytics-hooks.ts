import { analyticsEnabled } from "./analytics-flag";

/** Names a later collector can subscribe to. Nothing is sent while the flag is off. */
export const ANALYTICS_HOOKS = ["page_view", "waitlist_join", "quote_request", "apply_start"] as const;

export type AnalyticsHookName = (typeof ANALYTICS_HOOKS)[number];

export function isAnalyticsHook(name: string): name is AnalyticsHookName {
  return (ANALYTICS_HOOKS as readonly string[]).includes(name);
}

/** Null while analytics are off, so the page adds no script. */
export function analyticsHookPayload() {
  if (!analyticsEnabled()) return null;
  return { ready: true as const, hooks: [...ANALYTICS_HOOKS] };
}

/**
 * Records that a hook fired. The return value stays on the server.
 * No third-party request is made.
 */
export function recordAnalyticsHook(name: string) {
  if (!analyticsEnabled() || !isAnalyticsHook(name)) return { sent: false as const };
  return { sent: false as const, ready: true as const, name };
}
