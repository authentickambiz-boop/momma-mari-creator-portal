import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { statusIncidents } from "@/db/schema";
import { nowIso } from "./format";
import type { Viewer } from "./types";

export const INCIDENT_STATES = ["investigating", "identified", "resolved"] as const;

export const INCIDENT_ERRORS = {
  own: "Only Kamron records an incident.",
  title: "Add a title.",
  body: "Write what people should know.",
  state: "Choose investigating, identified, or resolved.",
} as const;

export async function portalHealth() {
  try {
    const { getDb } = await import("@/db/getDb");
    const { listCreators } = await import("./queries");
    const db = await getDb();
    const creators = await listCreators(db);
    const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
    return { ok: true as const, storage: onWorkers ? "d1" : "local-sqlite", creators: creators.length };
  } catch {
    return { ok: false as const };
  }
}

export async function listStatusIncidents(db: PortalDb) {
  const rows = await db.select().from(statusIncidents);
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function statusSnapshot(db: PortalDb, health = { ok: true }) {
  const incidents = await listStatusIncidents(db);
  const open = incidents.filter((row) => row.state !== "resolved");
  return {
    healthOk: health.ok,
    banner: !health.ok || open.length > 0,
    incidents,
  };
}

export async function saveStatusIncident(
  db: PortalDb,
  viewer: Viewer | null,
  input: { title: string; body: string; state: string },
) {
  if (viewer?.role !== "admin") return { ok: false as const, error: INCIDENT_ERRORS.own };
  const title = input.title.trim().slice(0, 140);
  const body = input.body.trim().slice(0, 2000);
  if (!title) return { ok: false as const, error: INCIDENT_ERRORS.title };
  if (!body) return { ok: false as const, error: INCIDENT_ERRORS.body };
  if (!(INCIDENT_STATES as readonly string[]).includes(input.state)) {
    return { ok: false as const, error: INCIDENT_ERRORS.state };
  }
  const timestamp = nowIso();
  const id = crypto.randomUUID();
  await db.insert(statusIncidents).values({
    id,
    title,
    body,
    state: input.state,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return { ok: true as const, id };
}

export async function setStatusIncidentState(db: PortalDb, viewer: Viewer | null, id: string, state: string) {
  if (viewer?.role !== "admin") return { ok: false as const, error: INCIDENT_ERRORS.own };
  if (!(INCIDENT_STATES as readonly string[]).includes(state)) {
    return { ok: false as const, error: INCIDENT_ERRORS.state };
  }
  const rows = await db.select().from(statusIncidents).where(eq(statusIncidents.id, id));
  if (!rows[0]) return { ok: false as const, error: INCIDENT_ERRORS.title };
  await db.update(statusIncidents).set({ state, updatedAt: nowIso() }).where(eq(statusIncidents.id, id));
  return { ok: true as const };
}
