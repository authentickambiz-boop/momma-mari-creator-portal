/** Short line for the center quest banner. */
export function nextUpLine(options: {
  todos: readonly { task: string; done: boolean }[];
  charactersEnabled: boolean;
  place: "office" | "city";
}) {
  const open = options.todos.find((todo) => !todo.done && todo.task.trim());
  if (open) return open.task.trim();
  if (options.charactersEnabled) return "Customize your character";
  if (options.place === "city") return "Walk the block";
  return "Walk the office";
}

export type WorldsRailId = "places" | "shop" | "tasks" | "settings" | "inventory";

export const WORLDS_RAIL: readonly { id: WorldsRailId; label: string }[] = [
  { id: "places", label: "Places" },
  { id: "shop", label: "Shop" },
  { id: "tasks", label: "Tasks" },
  { id: "settings", label: "Settings" },
  { id: "inventory", label: "Inventory" },
];
