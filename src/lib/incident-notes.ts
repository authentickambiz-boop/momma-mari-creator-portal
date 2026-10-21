import { INCIDENT_ERRORS } from "./status-page";

const INCIDENT_NOTES = {
  ...INCIDENT_ERRORS,
  "1": "That was not saved. Nothing was emailed.",
} as const;

export function incidentErrorCode(error: string) {
  const match = (Object.keys(INCIDENT_ERRORS) as (keyof typeof INCIDENT_ERRORS)[])
    .find((code) => INCIDENT_ERRORS[code] === error);
  return match ?? "1";
}

export function incidentErrorNote(code: string | undefined) {
  if (!code) return null;
  return INCIDENT_NOTES[code as keyof typeof INCIDENT_NOTES] ?? INCIDENT_NOTES["1"];
}
