const ACCESS_ERROR_TEXT = {
  person: "Pick a person or a bot.",
  intent: "Pick approve or reject.",
  capability: "Pick a capability.",
  level: "Pick a capability and a level.",
  training: "Mark the training complete before raising this level.",
  owner: "Only Kamron can change a capability.",
  trainOwner: "Only Kamron can mark training.",
  approveOwner: "Only Kamron can approve this.",
  botOwner: "Only Kamron can add a bot.",
  revokeOwner: "Only Kamron can revoke a bot.",
  manager: "Manager not found.",
  bot: "Bot not found.",
  signin: "Open this from a manager sign-in.",
  deal: "Deal not found.",
  list: "That creator is not on your list.",
  match: "That action does not match the capability.",
  summary: "Write a short summary.",
  off: "That capability is off.",
  draft: "Draft not found.",
  reviewed: "This was already reviewed.",
  unreadable: "That draft could not be read.",
  name: "Name the bot.",
  stage: "That is not a deal stage.",
  move: "You can't move this deal.",
  to: "to must be an email address.",
  subject: "subject is required.",
  body: "body is required.",
  gate: "gate must be interest, revision, signed_contract, video, decline, post_link, reminder, report, usage_renewal, or brand_recap.",
} as const;

export const ACCESS_NOTES: Record<string, string> = {
  ...ACCESS_ERROR_TEXT,
  "1": "That was not saved.",
};

export function accessErrorCode(error: string) {
  const match = (Object.keys(ACCESS_ERROR_TEXT) as (keyof typeof ACCESS_ERROR_TEXT)[])
    .find((code) => ACCESS_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function accessErrorNote(code: string | undefined) {
  if (!code) return null;
  return ACCESS_NOTES[code] ?? ACCESS_NOTES["1"];
}
