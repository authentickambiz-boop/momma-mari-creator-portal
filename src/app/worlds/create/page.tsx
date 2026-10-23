import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CharacterCreator } from "@/components/worlds/character-creator";
import { getDb } from "@/db/getDb";
import { isOwner } from "@/lib/authz";
import { requireViewer } from "@/lib/current-user";
import { canOpenCharacterCreator, characterSubjectForViewer, type CharacterSubject } from "@/lib/worlds/character";
import { readCharacter } from "@/lib/worlds/character-store";
import { findOfficeBot } from "@/lib/worlds/office-catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create your character · Momma Mari",
  robots: { index: false, follow: false },
};

export default async function CreateCharacterPage({
  searchParams,
}: {
  searchParams: Promise<{ bot?: string }>;
}) {
  const viewer = await requireViewer("/worlds/create");
  if (!canOpenCharacterCreator(viewer)) notFound();
  const params = await searchParams;
  let subject: CharacterSubject | null = characterSubjectForViewer(viewer);
  let title = "Your character";
  if (params.bot) {
    const bot = findOfficeBot(params.bot);
    if (!isOwner(viewer) || !bot) notFound();
    subject = { kind: "bot", id: bot.id };
    title = bot.name;
  }
  if (!subject) notFound();
  const db = await getDb();
  const character = await readCharacter(db, subject);
  return (
    <CharacterCreator
      subjectKind={subject.kind}
      subjectId={subject.id}
      initial={character.config}
      title={title}
      backHref={isOwner(viewer) ? "/worlds" : "/connect"}
      backLabel={isOwner(viewer) ? "Back to Worlds" : "Skip for now"}
    />
  );
}
