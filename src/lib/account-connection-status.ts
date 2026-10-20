import type { Viewer } from "./types";

export const CONNECT_PLATFORMS = ["gmail", "drive", "tiktok", "instagram", "facebook", "youtube"] as const;

export type ConnectPlatform = (typeof CONNECT_PLATFORMS)[number];

export type ConnectionStatus = "connected" | "needs_reconnect" | "not_connected";

export function isConnectPlatform(value: string): value is ConnectPlatform {
  return (CONNECT_PLATFORMS as readonly string[]).includes(value);
}

/** Connected, needs reconnect, or not connected. A reconnect flag wins over a connected flag. */
export function connectionStatus(raw: string | null | undefined, needsReconnect = false): ConnectionStatus {
  const normalized = (raw ?? "").trim().toLowerCase().replaceAll(" ", "_");
  if (needsReconnect || normalized === "needs_reconnect") return "needs_reconnect";
  if (normalized === "connected") return "connected";
  return "not_connected";
}

export function storedConnectionStatus(connected: boolean, needsReconnect: boolean): ConnectionStatus {
  return connectionStatus(connected ? "connected" : null, needsReconnect);
}

export function connectionStatusLabel(status: ConnectionStatus) {
  if (status === "connected") return "Connected";
  if (status === "needs_reconnect") return "Needs reconnect";
  return "Not connected";
}

export function accountButtonState(status: ConnectionStatus) {
  const active = status === "connected" || status === "needs_reconnect";
  return {
    connect: status === "not_connected",
    reconnect: active,
    disconnect: active,
  };
}

export function disconnectConfirmMessage(label: string) {
  return `Disconnect ${label}? The saved connection is removed. You stay signed in to the portal.`;
}

export const CONNECTION_RETRY_NOTE = "That connection did not finish. Try again. You are still signed in.";

export function mappedConnectionNote(notes: Record<string, string>, code: string | undefined) {
  if (!code) return null;
  return notes[code] ?? CONNECTION_RETRY_NOTE;
}

export function canManageCreatorAccounts(viewer: Viewer, creatorId: string) {
  if (viewer.role === "admin") return true;
  return viewer.role === "creator" && viewer.creatorId === creatorId;
}
