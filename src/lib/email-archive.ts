import { eq } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PortalDb } from "@/db";
import { creators, deals, emailCopies, emailCopyFiles } from "@/db/schema";
import { nowIso } from "./format";

export type EmailCopyKind = "approved" | "sent";

type ArchiveRow = {
  id: string;
  dealId: string;
  gate: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
};

function driveLooksConfigured() {
  if (process.env.GOOGLE_DRIVE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) return true;
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
}

function ascii(value: string) {
  return value.replace(/[^\x20-\x7E\n]/g, " ");
}

function wrap(value: string, width: number) {
  const lines: string[] = [];
  for (const raw of ascii(value).split("\n")) {
    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > width && line) {
        lines.push(line);
        line = word.slice(0, width);
      } else {
        line = next.slice(0, width);
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export function emailCopyFilename(gate: string, kind: EmailCopyKind, subject: string) {
  const slug = subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "email";
  return `${gate}-${kind}-${slug}.pdf`;
}

export async function buildEmailPdf(input: {
  from: string;
  to: string;
  subject: string;
  body: string;
  gate: string;
  status: string;
  timestamp: string;
}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const lines = [
    `From: ${ascii(input.from)}`,
    `To: ${ascii(input.to)}`,
    `Subject: ${ascii(input.subject)}`,
    `Gate: ${ascii(input.gate)}`,
    `Status: ${ascii(input.status)}`,
    `Saved: ${ascii(input.timestamp)}`,
    "",
    ...wrap(input.body, 85),
  ];
  let page = doc.addPage([612, 792]);
  let y = 740;
  for (const line of lines) {
    if (y < 72) {
      page = doc.addPage([612, 792]);
      y = 740;
    }
    page.drawText(line, { x: 54, y, size: 11, font, color: rgb(0.12, 0.12, 0.12) });
    y -= 16;
  }
  return doc.save();
}

async function sha256Hex(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Keep a PDF of an approved or sent email. A Drive miss does not undo the approval. */
export async function archiveApprovalCopy(db: PortalDb, row: ArchiveRow, kind: EmailCopyKind) {
  try {
    const existing = await db.select().from(emailCopies).where(eq(emailCopies.approvalId, row.id));
    if (existing.some((copy) => copy.kind === kind)) return;
    const timestamp = nowIso();
    const status = kind === "sent" ? "sent" : "approved";
    const bytes = await buildEmailPdf({
      from: row.fromEmail,
      to: row.toEmail,
      subject: row.subject,
      body: row.body,
      gate: row.gate,
      status,
      timestamp,
    });
    const filename = emailCopyFilename(row.gate, kind, row.subject);
    const sha256 = await sha256Hex(bytes);
    let driveFileId: string | null = null;
    let driveFileUrl: string | null = null;
    let driveFolderId: string | null = null;
    let stored: "drive" | "portal" = "portal";

    if (driveLooksConfigured()) {
      try {
        const drive = await import("./drive");
        if (drive.driveConfigured()) {
          const dealRows = await db.select().from(deals).where(eq(deals.id, row.dealId));
          const deal = dealRows[0];
          if (deal) {
            const creatorRows = await db.select().from(creators).where(eq(creators.id, deal.creatorId));
            driveFolderId = await drive.prepareEmailsFolder(db, {
              id: deal.id,
              brand: deal.brand,
              driveFolderId: deal.driveFolderId,
              creatorFolderId: creatorRows[0]?.driveFolderId ?? null,
            });
            const uploaded = await drive.uploadDriveFile({
              folderId: driveFolderId,
              filename,
              mimeType: "application/pdf",
              bytes,
            });
            driveFileId = uploaded.fileId;
            driveFileUrl = uploaded.fileUrl;
            stored = "drive";
          }
        }
      } catch {
        driveFileId = null;
        driveFileUrl = null;
        driveFolderId = null;
        stored = "portal";
      }
    }

    const id = crypto.randomUUID();
    await db.insert(emailCopies).values({
      id,
      approvalId: row.id,
      dealId: row.dealId,
      kind,
      filename,
      sha256,
      driveFileId,
      driveFileUrl,
      driveFolderId,
      stored,
      createdAt: timestamp,
    });
    await db.insert(emailCopyFiles).values({
      copyId: id,
      bytesBase64: Buffer.from(bytes).toString("base64"),
    });
  } catch {
    // The email status is already saved. A missing PDF must not undo that.
  }
}
