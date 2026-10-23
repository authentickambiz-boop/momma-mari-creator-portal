import * as THREE from "three";

/** Stick axes are -1..1. x is to the right, y is up the screen. */
export type Stick = { x: number; y: number };

export const OFFICE_FOV = 38;
export const MAP_MIN_DISTANCE = 3.2;
export const MAP_MAX_DISTANCE = 200;

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

/**
 * Default camera for a 4:3 frame. The same view direction as the map,
 * pulled back until the building, plus a small margin, sits inside the picture.
 */
export function officeCameraHome(width: number, depth: number) {
  const lookX = width / 2;
  const lookY = 1.4;
  const lookZ = depth * 0.45;
  const target = new THREE.Vector3(lookX, lookY, lookZ);
  const aim = new THREE.Vector3(18, 26.8, depth + 32 - depth * 0.42);
  if (aim.lengthSq() < 1) aim.set(18, 27, 40);
  aim.normalize();
  const camera = new THREE.PerspectiveCamera(OFFICE_FOV, 4 / 3, 0.1, 800);
  const corners: THREE.Vector3[] = [];
  for (const y of [0, 3.4]) {
    for (const x of [-1.5, width + 1.5]) {
      for (const z of [-1.5, depth + 1.5]) corners.push(new THREE.Vector3(x, y, z));
    }
  }
  const fits = (distance: number) => {
    camera.position.copy(target).addScaledVector(aim, distance);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    for (const corner of corners) {
      const ndc = corner.clone().project(camera);
      if (ndc.z < -1 || ndc.z > 1) return false;
      if (Math.abs(ndc.x) > 0.9 || Math.abs(ndc.y) > 0.9) return false;
    }
    return true;
  };
  let lo = 12;
  let hi = 220;
  if (!fits(hi)) {
    return { position: target.clone().addScaledVector(aim, hi), target, distance: hi };
  }
  for (let step = 0; step < 24; step += 1) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return { position: target.clone().addScaledVector(aim, hi), target, distance: hi };
}

/** A pose the map can keep drawing. Anything else is sent back to the default framing. */
export function officeCameraPoseOk(
  position: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  layout: { width: number; depth: number },
) {
  const values = [position.x, position.y, position.z, target.x, target.y, target.z, layout.width, layout.depth];
  if (values.some((value) => !Number.isFinite(value))) return false;
  if (target.x < -14 || target.x > layout.width + 14) return false;
  if (target.y < 0.4 || target.y > 3.2) return false;
  if (target.z < -14 || target.z > layout.depth + 28) return false;
  const distance = Math.hypot(position.x - target.x, position.y - target.y, position.z - target.z);
  if (distance < MAP_MIN_DISTANCE - 0.05 || distance > MAP_MAX_DISTANCE + 0.05) return false;
  if (position.y < 0.15) return false;
  return true;
}
