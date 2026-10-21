import { PROFILE_INTAKE_ERRORS } from "./profile-intake";

const PROFILE_INTAKE_NOTES = {
  ...PROFILE_INTAKE_ERRORS,
  "1": "That was not saved. Nothing was emailed.",
} as const;

export function profileIntakeErrorCode(error: string) {
  const match = (Object.keys(PROFILE_INTAKE_ERRORS) as (keyof typeof PROFILE_INTAKE_ERRORS)[])
    .find((code) => PROFILE_INTAKE_ERRORS[code] === error);
  return match ?? "1";
}

export function profileIntakeErrorNote(code: string | undefined) {
  if (!code) return null;
  return PROFILE_INTAKE_NOTES[code as keyof typeof PROFILE_INTAKE_NOTES] ?? PROFILE_INTAKE_NOTES["1"];
}
