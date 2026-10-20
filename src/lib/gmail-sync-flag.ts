/** Live Gmail sync stays off until Kamron sets this to the string "true". */
export function gmailSyncEnabled() {
  return process.env.GMAIL_SYNC_ENABLED === "true";
}
