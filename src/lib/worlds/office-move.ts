/** Stick axes are -1..1. x is to the right, y is up the screen. */
export type Stick = { x: number; y: number };

function num(value: number) {
  return value === 0 ? 0 : value;
}

/** A shorter movement still counts as a click, so bots and objects can open. */
export const PAN_DRAG_PX = 10;

/** World units per second when the stick is pushed all the way. */
export const STICK_SPEED = 12;

export function stickFromDrag(dx: number, dy: number, radius: number): Stick {
  if (!(radius > 0)) return { x: 0, y: 0 };
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return { x: 0, y: 0 };
  const clamped = Math.min(dist, radius) / radius;
  return {
    x: num((dx / dist) * clamped),
    y: num((-dy / dist) * clamped),
  };
}

/** Camera-forward and camera-right on the ground, from the camera's offset to the target. */
export function cameraPlan(offsetX: number, offsetZ: number) {
  const len = Math.hypot(offsetX, offsetZ);
  if (len < 1e-6) {
    return { forwardX: 0, forwardZ: -1, rightX: 1, rightZ: 0 };
  }
  const forwardX = -offsetX / len;
  const forwardZ = -offsetZ / len;
  return {
    forwardX,
    forwardZ,
    rightX: -forwardZ,
    rightZ: forwardX,
  };
}

export function moveDelta(
  stick: Stick,
  offsetX: number,
  offsetZ: number,
  dt: number,
  speed = STICK_SPEED,
) {
  const step = speed * dt;
  const { forwardX, forwardZ, rightX, rightZ } = cameraPlan(offsetX, offsetZ);
  return {
    x: num((rightX * stick.x + forwardX * stick.y) * step),
    z: num((rightZ * stick.x + forwardZ * stick.y) * step),
  };
}

/** Shift the target so the grabbed ground point stays under the pointer. */
export function grabPanDelta(
  grabbed: { x: number; z: number },
  underPointer: { x: number; z: number },
) {
  return { x: grabbed.x - underPointer.x, z: grabbed.z - underPointer.z };
}

/** Where a ray meets the horizontal plane at planeY. Null when the ray misses it. */
export function rayGroundPoint(
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  planeY: number,
) {
  if (Math.abs(direction.y) < 1e-8) return null;
  const t = (planeY - origin.y) / direction.y;
  if (!(t >= 0)) return null;
  return {
    x: origin.x + direction.x * t,
    z: origin.z + direction.z * t,
  };
}
