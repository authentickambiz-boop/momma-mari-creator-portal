import { analyticsHookPayload } from "@/lib/analytics-hooks";

/** Mount point for analytics. Renders nothing until ANALYTICS_ENABLED is on. */
export function AnalyticsHooks() {
  const payload = analyticsHookPayload();
  if (!payload) return null;
  return (
    <script
      id="analytics-hooks"
      type="application/json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
