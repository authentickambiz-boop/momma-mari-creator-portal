import { and, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { officeCharacters } from "@/db/schema";
import { nowIso } from "@/lib/format";
import {
  CHARACTER_VERSION,
  defaultCharacter,
  parseCharacter,
  rosterBotIds,
  type CharacterConfig,
  type CharacterSubject,
  type CharacterSubjectKind,
} from "./character";

export type PublicCharacter = {
  subjectKind: CharacterSubjectKind;
  subjectId: string;
  version: number;
  config: CharacterConfig;
  updatedAt: string | null;
  saved: boolean;
};

function subjectKey(subject: CharacterSubject) {
  return `${subject.kind}:${subject.id}`;
}

function parsedDocument(document: string) {
  try {
    return parseCharacter(JSON.parse(document));
  } catch {
    return { ok: false as const, error: "That character could not be read." };
  }
}

function toPublic(subject: CharacterSubject, config: CharacterConfig, updatedAt: string | null, saved: boolean): PublicCharacter {
  return {
    subjectKind: subject.kind,
    subjectId: subject.id,
    version: config.version,
    config,
    updatedAt,
    saved,
  };
}

export async function readCharacter(db: PortalDb, subject: CharacterSubject): Promise<PublicCharacter> {
  const rows = await db.select().from(officeCharacters).where(and(
    eq(officeCharacters.subjectKind, subject.kind),
    eq(officeCharacters.subjectId, subject.id),
  ));
  const row = rows[0];
  if (!row) return toPublic(subject, defaultCharacter(subject.id), null, false);
  const parsed = parsedDocument(row.document);
  if (!parsed.ok) return toPublic(subject, defaultCharacter(subject.id), null, false);
  return toPublic(subject, parsed.value, row.updatedAt, true);
}

export async function listBotCharacters(db: PortalDb): Promise<PublicCharacter[]> {
  const rows = await db.select().from(officeCharacters).where(eq(officeCharacters.subjectKind, "bot"));
  const saved = new Map<string, PublicCharacter>();
  for (const row of rows) {
    const parsed = parsedDocument(row.document);
    if (!parsed.ok) continue;
    saved.set(row.subjectId, toPublic({ kind: "bot", id: row.subjectId }, parsed.value, row.updatedAt, true));
  }
  return rosterBotIds().map((id) => saved.get(id) ?? toPublic({ kind: "bot", id }, defaultCharacter(id), null, false));
}

export async function writeCharacter(
  db: PortalDb,
  subject: CharacterSubject,
  config: CharacterConfig,
  updatedBy: string,
): Promise<PublicCharacter> {
  const now = nowIso();
  const document = JSON.stringify(config);
  const existing = await db.select().from(officeCharacters).where(and(
    eq(officeCharacters.subjectKind, subject.kind),
    eq(officeCharacters.subjectId, subject.id),
  ));
  if (existing[0]) {
    await db.update(officeCharacters).set({
      version: CHARACTER_VERSION,
      document,
      updatedBy,
      updatedAt: now,
    }).where(eq(officeCharacters.id, existing[0].id));
  } else {
    await db.insert(officeCharacters).values({
      id: subjectKey(subject),
      subjectKind: subject.kind,
      subjectId: subject.id,
      version: CHARACTER_VERSION,
      document,
      updatedBy,
      createdAt: now,
      updatedAt: now,
    });
  }
  return toPublic(subject, config, now, true);
}
