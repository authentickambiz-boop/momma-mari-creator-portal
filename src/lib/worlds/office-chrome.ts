/** Saved on this browser. "off" hides every office panel until it is turned back on. */
export const PANELS_STORAGE_KEY = "mm-worlds-panels";

export function panelsEnabledFromStorage(value: string | null | undefined) {
  return value !== "off";
}

export function panelsStorageValue(enabled: boolean) {
  return enabled ? "on" : "off";
}
