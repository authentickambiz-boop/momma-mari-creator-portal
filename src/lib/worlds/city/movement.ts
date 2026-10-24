/**
 * Where a city role may stand.
 * Office roster bots, including the owner figure in the office scene, stay
 * inside the office footprint until the buildings are connected.
 * User bots may walk the city and stop at the HQ walls.
 */

import type { AccessRole } from "./access";

export function insideOffice(layout: { width: number; depth: number }, x: number, z: number, pad = 0) {
  return x >= -pad && x <= layout.width + pad && z >= -pad && z <= layout.depth + pad;
}

export function roleMayStand(
  role: AccessRole,
  layout: { width: number; depth: number },
  x: number,
  z: number,
  checkingIn = false,
) {
  const inside = insideOffice(layout, x, z);
  if (role === "owner") return true;
  if (role === "officeBot") return inside;
  if (role === "user") return !inside;
  return !inside || checkingIn;
}
