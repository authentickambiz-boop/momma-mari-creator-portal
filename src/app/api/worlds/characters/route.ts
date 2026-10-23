import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { readBody } from "@/lib/http";
import {
  characterAccess,
  characterAccessStatus,
  characterSubjectForViewer,
  parseCharacter,
  parseCharacterSubject,
} from "@/lib/worlds/character";
import { listBotCharacters, readCharacter, writeCharacter } from "@/lib/worlds/character-store";
import { findOfficeBot } from "@/lib/worlds/office-catalog";

export const dynamic = "force-dynamic";

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
      Pragma: "no-cache",
    },
  });
}

function denied(error: string) {
  return noStore({ error }, characterAccessStatus(error));
}

export async function GET(request: Request) {
  const viewer = await currentViewer();
  const gate = characterAccess(viewer, "read");
  if (!gate.ok) return denied(gate.error);
  const url = new URL(request.url);
  const db = await getDb();
  if (url.searchParams.get("kind") === "bot") {
    return noStore({ characters: await listBotCharacters(db) });
  }
  if (url.searchParams.get("mine") === "1") {
    const own = viewer ? characterSubjectForViewer(viewer) : null;
    if (!own) return noStore({ error: "This sign-in has no character yet." }, 404);
    return noStore({ character: await readCharacter(db, own) });
  }
  const subject = parseCharacterSubject(url.searchParams.get("subjectKind"), url.searchParams.get("subjectId"));
  if (!subject.ok) return noStore({ error: subject.error }, 400);
  if (subject.value.kind === "bot" && !findOfficeBot(subject.value.id)) {
    return noStore({ error: "That bot is not on the roster." }, 404);
  }
  return noStore({ character: await readCharacter(db, subject.value) });
}

export async function PUT(request: Request) {
  const viewer = await currentViewer();
  if (!viewer) return denied("Sign in to see a character.");
  const body = await readBody(request);
  if (!body || typeof body !== "object") return noStore({ error: "Expected JSON." }, 400);
  const record = body as { subjectKind?: unknown; subjectId?: unknown; config?: unknown };
  const subject = parseCharacterSubject(record.subjectKind, record.subjectId);
  if (!subject.ok) return noStore({ error: subject.error }, 400);
  const gate = characterAccess(viewer, "write", subject.value);
  if (!gate.ok) return denied(gate.error);
  const config = parseCharacter(record.config);
  if (!config.ok) return noStore({ error: config.error }, 400);
  const db = await getDb();
  const character = await writeCharacter(db, subject.value, config.value, viewer.email);
  return noStore({ character });
}
