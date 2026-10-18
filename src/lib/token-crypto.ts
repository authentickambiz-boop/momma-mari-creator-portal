const VERSION = "v1";

export function tokenEncryptionConfigured() {
  return Boolean(process.env.TOKEN_ENCRYPTION_KEY?.trim());
}

function keyBytes() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim() ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes, written as 64 hex characters.");
  }
  const bytes = new Uint8Array(32);
  for (let index = 0; index < 32; index += 1) {
    bytes[index] = Number.parseInt(raw.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function aesKey() {
  return crypto.subtle.importKey("raw", keyBytes(), "AES-GCM", false, ["encrypt", "decrypt"]);
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** Encrypt a Gmail refresh token for storage. The database never sees the raw token. */
export async function encryptToken(plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), new TextEncoder().encode(plaintext)));
  const packed = new Uint8Array(iv.length + cipher.length);
  packed.set(iv, 0);
  packed.set(cipher, iv.length);
  return `${VERSION}:${bytesToBase64(packed)}`;
}

export async function decryptToken(stored: string) {
  const [version, payload] = stored.split(":");
  if (version !== VERSION || !payload) throw new Error("Stored token is not a v1 ciphertext.");
  const packed = base64ToBytes(payload);
  const iv = packed.slice(0, 12);
  const cipher = packed.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await aesKey(), cipher);
  return new TextDecoder().decode(plain);
}
