"use client";

import type { ReactNode } from "react";

/**
 * The office Canvas is the renderer (camera, drag-pan, zoom, joystick, lights).
 * City content sits in this group so a new location is another child, not a second scene.
 */
export function WorldSceneShell({ children }: { children: ReactNode }) {
  return <group name="world-scene-shell">{children}</group>;
}
