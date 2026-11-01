import type { PortalDb } from "@/db";
import { getKv } from "@/db";
import { assignedCreatorIds } from "./managers";
import { findCreatorById } from "./queries";
import { rememberSessionProfile, type SessionRecord } from "./session";
import type { Viewer } from "./types";

/** Fills the session cache so the next page can skip the creator or manager lookup. */
export async function warmSessionProfile(db: PortalDb, record: SessionRecord, viewer: Viewer) {
  if (!(await getKv())) return;
  let next = viewer;
  if (viewer.role === "creator" && viewer.creatorId && !viewer.initials) {
    const creator = await findCreatorById(db, viewer.creatorId);
    if (!creator) return;
    next = { ...viewer, name: creator.name, initials: creator.initials };
  } else if (viewer.role === "manager" && viewer.managerId && !viewer.assignedCreatorIds) {
    next = {
      ...viewer,
      initials: viewer.initials || viewer.name.slice(0, 1).toUpperCase(),
      assignedCreatorIds: await assignedCreatorIds(db, viewer.managerId),
    };
  } else if (viewer.role === "admin" && !viewer.initials) {
    next = { ...viewer, initials: "K" };
  }
  await rememberSessionProfile(record, next);
}
