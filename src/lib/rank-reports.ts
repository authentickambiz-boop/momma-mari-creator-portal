import { eq } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PortalDb } from "@/db";
import { creators, rankReports } from "@/db/schema";
import { compositeScore, latestRanks, rankHistory, rankSettings, scoringInputs, tierFor } from "./creator-rank";
import { listPods, podCollabs } from "./pods";
import type { Viewer } from "./types";

export type ReportLevel = "creator" | "team" | "cross";

export type ReportChoices = {
  breakdown: boolean;
  strengths: boolean;
  improve: boolean;
  trend: boolean;
  averages: boolean;
  contributors: boolean;
  collabs: boolean;
};

export type ReportBody = {
  title: string;
  sections: { heading: string; lines: string[] }[];
};

const ALL_ON: ReportChoices = {
  breakdown: true,
  strengths: true,
  improve: true,
  trend: true,
  averages: true,
  contributors: true,
  collabs: true,
};

function linesOf(sections: ReportBody["sections"], heading: string, lines: string[]) {
  if (lines.length) sections.push({ heading, lines });
}

export async function buildReportBody(
  db: PortalDb,
  input: { level: ReportLevel; subjectId: string | null; choices: ReportChoices; showRanks: boolean },
): Promise<ReportBody> {
  const choices = { ...ALL_ON, ...input.choices };
  const ranks = await latestRanks(db);
  const people = await db.select().from(creators);
  const nameOf = new Map(people.map((person) => [person.id, person.name]));
  const sections: ReportBody["sections"] = [];
  if (input.level === "creator") {
    const creatorId = input.subjectId ?? "";
    const name = nameOf.get(creatorId) ?? "Creator";
    const settings = await rankSettings(db);
    const inputs = await scoringInputs(db, creatorId);
    const scored = compositeScore(inputs, settings.weights);
    const saved = ranks.get(creatorId);
    const score = saved?.score ?? scored.score;
    if (choices.breakdown) {
      if (input.showRanks) {
        linesOf(sections, "Score", [`Score ${score}`, `Rank ${saved?.rank ?? "not saved yet"}`, tierFor(score)]);
        linesOf(sections, "Breakdown", scored.parts.map((part) => `${part.label}: ${part.unit}`));
      } else {
        linesOf(sections, "Score", ["Rank numbers are hidden on this copy.", tierFor(score)]);
      }
    }
    const ordered = [...scored.parts].sort((a, b) => b.unit - a.unit);
    if (choices.strengths) linesOf(sections, "Strengths", ordered.slice(0, 3).map((part) => part.label));
    if (choices.improve) linesOf(sections, "Room to grow", ordered.slice(-3).reverse().map((part) => part.label));
    if (choices.trend) {
      const history = await rankHistory(db, { role: "admin", email: "", creatorId: null, name: "" }, creatorId);
      const rows = history.ok ? history.rows : [];
      linesOf(
        sections,
        "Trend",
        rows.length
          ? rows.map((row) => (input.showRanks ? `${row.recordedOn}: ${row.score}` : row.recordedOn))
          : ["No saved trend yet."],
      );
    }
    return { title: `${name} creator report`, sections };
  }
  const pods = await listPods(db, { role: "admin", email: "", creatorId: null, name: "Kamron" });
  const relevant = input.level === "team" ? pods.filter((pod) => pod.managerId === input.subjectId) : pods;
  if (choices.averages || choices.contributors) {
    const memberIds = [...new Set(relevant.flatMap((pod) => pod.memberIds))];
    const scores = memberIds.map((id) => ranks.get(id)?.score ?? 0);
    const average = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
    if (choices.averages) {
      linesOf(sections, "Group average", [input.showRanks ? `Average score ${average}` : "Numbers are hidden on this copy."]);
    }
    if (choices.contributors) {
      const ordered = memberIds
        .map((id) => ({ name: nameOf.get(id) ?? id, score: ranks.get(id)?.score ?? 0, rank: ranks.get(id)?.rank ?? null }))
        .sort((a, b) => b.score - a.score);
      linesOf(
        sections,
        "Top contributors",
        ordered.slice(0, 5).map((row) => (input.showRanks ? `${row.name}: ${row.score}` : row.name)),
      );
    }
  }
  if (choices.collabs) {
    let posted = 0;
    for (const pod of relevant) posted += (await podCollabs(db, pod.id)).filter((idea) => idea.status === "posted").length;
    linesOf(sections, "Collab results", [`${posted} collab posts tracked.`]);
  }
  const title = input.level === "cross" ? "Cross-team comparison" : "Team report";
  if (input.level === "cross" && choices.averages) {
    linesOf(
      sections,
      "Teams",
      pods.map((pod) => {
        const scores = pod.memberIds.map((id) => ranks.get(id)?.score ?? 0);
        const average = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
        return input.showRanks ? `${pod.name}: ${average}` : pod.name;
      }),
    );
  }
  return { title, sections };
}

export async function createRankReport(
  db: PortalDb,
  viewer: Viewer,
  input: { level: ReportLevel; subjectId: string | null; choices: ReportChoices; showRanks: boolean },
) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can build a rank report." };
  if (input.level !== "creator" && input.level !== "team" && input.level !== "cross") {
    return { ok: false as const, error: "Pick a creator, a team, or a cross-team report." };
  }
  const body = await buildReportBody(db, input);
  const id = crypto.randomUUID();
  const token = crypto.randomUUID().replaceAll("-", "");
  await db.insert(rankReports).values({
    id,
    level: input.level,
    subjectId: input.subjectId,
    title: body.title,
    showRanks: input.showRanks,
    token,
    bodyJson: JSON.stringify(body),
    createdAt: new Date().toISOString(),
  });
  return { ok: true as const, id, token };
}

export async function listRankReports(db: PortalDb, viewer: Viewer) {
  if (viewer.role !== "admin") return [];
  const rows = await db.select().from(rankReports);
  return rows
    .map((row) => ({ id: row.id, title: row.title, level: row.level, showRanks: row.showRanks, token: row.token, createdAt: row.createdAt }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function sharedReport(db: PortalDb, token: string) {
  const rows = await db.select().from(rankReports).where(eq(rankReports.token, token));
  if (!rows[0]) return null;
  try {
    return JSON.parse(rows[0].bodyJson) as ReportBody;
  } catch {
    return null;
  }
}

export async function reportRecord(db: PortalDb, id: string) {
  const rows = await db.select().from(rankReports).where(eq(rankReports.id, id));
  return rows[0] ?? null;
}

export async function reportPdf(body: ReportBody) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let y = 740;
  page.drawText(body.title.slice(0, 80), { x: 48, y, size: 18, font, color: rgb(0.2, 0.15, 0.12) });
  y -= 28;
  for (const section of body.sections) {
    if (y < 72) break;
    page.drawText(section.heading.slice(0, 80), { x: 48, y, size: 13, font });
    y -= 18;
    for (const line of section.lines) {
      if (y < 56) break;
      page.drawText(line.slice(0, 90), { x: 60, y, size: 11, font });
      y -= 16;
    }
    y -= 8;
  }
  return pdf.save();
}
