import { DEPOSIT_ERRORS } from "./brand-deposits";

const TEXT = DEPOSIT_ERRORS;

export function depositErrorCode(error: string) {
  const match = (Object.keys(TEXT) as (keyof typeof TEXT)[]).find((code) => TEXT[code] === error);
  return match ?? "1";
}

export function depositErrorNote(code: string | undefined) {
  if (!code || code === "1") return null;
  return TEXT[code as keyof typeof TEXT] ?? null;
}
