import { TICKET_ERRORS } from "./support-tickets";

const TICKET_NOTES = {
  ...TICKET_ERRORS,
  "1": "That was not saved. Nothing was emailed.",
} as const;

export function ticketErrorCode(error: string) {
  const match = (Object.keys(TICKET_ERRORS) as (keyof typeof TICKET_ERRORS)[])
    .find((code) => TICKET_ERRORS[code] === error);
  return match ?? "1";
}

export function ticketErrorNote(code: string | undefined) {
  if (!code) return null;
  return TICKET_NOTES[code as keyof typeof TICKET_NOTES] ?? TICKET_NOTES["1"];
}
