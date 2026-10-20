/** A short code for a refused inbox disconnect. Unknown wording stays the fixed fallback. */
export function disconnectErrorCode(error: string) {
  if (error === "email is required.") return "email";
  if (error === "No watched inbox uses that email.") return "inbox";
  return "1";
}
