import { setDealFolder } from "./bot-api";
import type { PortalDb } from "@/db";

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

export function driveConfigured() {
  if (process.env.GOOGLE_DRIVE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return true;
  }
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
}

function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function pemToPkcs8(pem: string) {
  if (!pem.includes("BEGIN PRIVATE KEY")) {
    throw new Error("Service account private_key must be a PKCS8 key (BEGIN PRIVATE KEY).");
  }
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

async function signServiceAccount(email: string, privateKeyPem: string) {
  const header = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const now = Math.floor(Date.now() / 1000);
  const payload = bytesToBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: email,
        scope: "https://www.googleapis.com/auth/drive",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${bytesToBase64Url(signature)}`;
}

async function fetchAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  let body: URLSearchParams;
  if (process.env.GOOGLE_DRIVE_REFRESH_TOKEN) {
    body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    });
  } else {
    const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "{}") as {
      client_email?: string;
      private_key?: string;
    };
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON needs client_email and private_key.");
    }
    const assertion = await signServiceAccount(parsed.client_email, parsed.private_key);
    body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    });
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await response.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error || "Google refused the Drive credential.");
  }
  tokenCache = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return json.access_token;
}

async function driveFetch(url: string, init: RequestInit = {}) {
  const token = await fetchAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

export async function ensureDealFolder(input: { parentId: string; name: string; existingId: string | null }) {
  if (input.existingId) return input.existingId;
  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${input.name.replaceAll("'", "\\'")}' and '${input.parentId}' in parents and trashed=false`,
  );
  const listed = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
  );
  const listJson = (await listed.json()) as { files?: { id: string }[]; error?: { message: string } };
  if (!listed.ok) throw new Error(listJson.error?.message || "Could not look up the Drive folder.");
  if (listJson.files?.[0]?.id) return listJson.files[0].id;
  const created = await driveFetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [input.parentId],
    }),
  });
  const createdJson = (await created.json()) as { id?: string; error?: { message: string } };
  if (!created.ok || !createdJson.id) throw new Error(createdJson.error?.message || "Could not create the Drive folder.");
  return createdJson.id;
}

export async function openResumableSession(input: {
  folderId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const response = await driveFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": input.mimeType || "application/octet-stream",
        "X-Upload-Content-Length": String(input.sizeBytes),
      },
      body: JSON.stringify({ name: input.filename, parents: [input.folderId] }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text.slice(0, 300) || "Drive did not start the upload.");
  }
  const location = response.headers.get("location");
  if (!location) throw new Error("Drive did not return an upload session.");
  return location;
}

export async function forwardChunk(input: {
  sessionUrl: string;
  bytes: Uint8Array;
  start: number;
  end: number;
  total: number;
}) {
  const response = await fetch(input.sessionUrl, {
    method: "PUT",
    headers: {
      "Content-Range": `bytes ${input.start}-${input.end}/${input.total}`,
      "Content-Type": "application/octet-stream",
    },
    body: new Blob([input.bytes.buffer.slice(input.bytes.byteOffset, input.bytes.byteOffset + input.bytes.byteLength) as ArrayBuffer]),
  });
  if (response.status === 308) return { complete: false as const };
  if (response.ok) {
    const json = (await response.json()) as { id?: string };
    return {
      complete: true as const,
      fileId: json.id ?? null,
      fileUrl: json.id ? `https://drive.google.com/file/d/${json.id}/view` : null,
    };
  }
  const text = await response.text();
  throw new Error(text.slice(0, 300) || `Drive rejected the chunk (${response.status}).`);
}

export async function prepareDriveFolder(
  db: PortalDb,
  deal: { id: string; brand: string; driveFolderId: string | null; creatorFolderId: string | null },
) {
  const parentId = deal.creatorFolderId || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || "";
  if (!parentId) {
    throw new Error("This creator has no Drive folder yet. Set creators.drive_folder_id or GOOGLE_DRIVE_ROOT_FOLDER_ID.");
  }
  const folderId = await ensureDealFolder({ parentId, name: deal.brand, existingId: deal.driveFolderId });
  if (folderId !== deal.driveFolderId) await setDealFolder(db, deal.id, folderId);
  return folderId;
}
