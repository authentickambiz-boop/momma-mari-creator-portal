export const COMMUNITY_GUIDELINES =
  "Be kind. Don't post phone numbers, emails, addresses, schools, or dollar amounts. Ask before a photo shows a child's face. There are no direct messages here.";

export const COMMUNITY_EMOJIS = ["👍", "❤️", "🎉"] as const;

export function privateKinds(body: string) {
  const kinds: string[] = [];
  if (/(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]*)\d{3}[-.\s]?\d{4}/.test(body)) kinds.push("phone");
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(body)) kinds.push("email");
  if (/\b\d{1,5}\s+[A-Za-z0-9.]+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd)\b/i.test(body)) kinds.push("address");
  if (/\b(school|elementary|preschool|kindergarten)\b/i.test(body)) kinds.push("school");
  if (/\$\s?\d/.test(body)) kinds.push("money");
  return kinds;
}
