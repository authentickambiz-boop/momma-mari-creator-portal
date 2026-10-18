import { drizzle } from "drizzle-orm/d1";
import type { D1Database, KVNamespace, R2Bucket } from "@cloudflare/workers-types";
import * as schema from "./schema";

export function createDb(database: D1Database) {
  return drizzle(database, { schema });
}

export type PortalDb = ReturnType<typeof createDb>;

export async function resolveD1(): Promise<D1Database> {
  const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
  if (onWorkers) {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = await getCloudflareContext({ async: true });
    return context.env.DB;
  }
  const { openLocalFile } = await import("./local-d1");
  return openLocalFile();
}

export async function getKv(): Promise<KVNamespace | null> {
  const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
  if (!onWorkers) return null;
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const context = await getCloudflareContext({ async: true });
  return (context.env.SESSIONS as KVNamespace | undefined) ?? null;
}

export async function getCommunityBucket(): Promise<R2Bucket | null> {
  const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
  if (!onWorkers) return null;
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const context = await getCloudflareContext({ async: true });
  return (context.env.COMMUNITY_PHOTOS as R2Bucket | undefined) ?? null;
}
