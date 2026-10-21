import { COMPANY_NOTE_ERRORS } from "./company-pages";

const COMPANY_NOTES = {
  ...COMPANY_NOTE_ERRORS,
  "1": "That was not saved. Nothing was emailed.",
} as const;

export function companyNoteErrorCode(error: string) {
  const match = (Object.keys(COMPANY_NOTE_ERRORS) as (keyof typeof COMPANY_NOTE_ERRORS)[])
    .find((code) => COMPANY_NOTE_ERRORS[code] === error);
  return match ?? "1";
}

export function companyNoteErrorNote(code: string | undefined) {
  if (!code) return null;
  return COMPANY_NOTES[code as keyof typeof COMPANY_NOTES] ?? COMPANY_NOTES["1"];
}
