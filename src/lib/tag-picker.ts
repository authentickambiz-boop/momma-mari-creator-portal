export type TagChoice = { value: string; add: boolean };

export function cleanTag(value: string) {
  return value.trim().replace(/,/g, " ").replace(/\s+/g, " ").slice(0, 40);
}

export function tagChoices(options: readonly string[], selected: readonly string[], query: string): TagChoice[] {
  const chosen = new Set(selected.map((item) => item.toLowerCase()));
  const needle = query.trim().toLowerCase();
  const matches = options
    .filter((option) => !chosen.has(option.toLowerCase()))
    .filter((option) => !needle || option.toLowerCase().includes(needle))
    .slice(0, 8)
    .map((value) => ({ value, add: false }));
  const custom = cleanTag(query);
  const known = options.some((option) => option.toLowerCase() === custom.toLowerCase());
  if (custom && !known && !chosen.has(custom.toLowerCase())) {
    matches.push({ value: custom, add: true });
  }
  return matches;
}
