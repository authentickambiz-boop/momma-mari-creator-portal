const INBOX_ERROR_TEXT = {
  empty: "Write the reply first.",
  thread: "That thread is not on your list.",
  address: "That thread has no brand address.",
  deal: "This thread is not on a deal yet.",
  private: "Only the creator can mark a thread private.",
  owner: "Only the owner can change this.",
  label: "Pick deal or not a deal.",
} as const;

export function inboxErrorCode(error: string) {
  const match = (Object.keys(INBOX_ERROR_TEXT) as (keyof typeof INBOX_ERROR_TEXT)[])
    .find((code) => INBOX_ERROR_TEXT[code] === error);
  return match ?? "1";
}

export function inboxErrorNote(code: string | undefined) {
  if (!code) return null;
  if (code === "1") return "That was not saved.";
  return INBOX_ERROR_TEXT[code as keyof typeof INBOX_ERROR_TEXT] ?? "That was not saved.";
}
