import * as THREE from "three";
import { OFFICE_FOV } from "./office-move";

/**
 * Invisible capsule around a bot. At the default camera (about 71 away,
 * 38° field of view) the diameter is roughly 80px on an 800px-tall view,
 * so a desk bot is easy to hit without zooming in.
 * The cylinder length plus both caps is the full height.
 */
export const BOT_CAPSULE_RADIUS = 2.5;
export const BOT_CAPSULE_LENGTH = 0.4;
/** Local offset. +Z points at the desk when a seated bot faces -Z. */
export const BOT_CAPSULE_CENTER: [number, number, number] = [0, 1.6, 0.35];

export type BotHitPose = {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
};

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const center = new THREE.Vector3();
const caster = new THREE.Raycaster();
const capsule = new THREE.Mesh(
  new THREE.CapsuleGeometry(BOT_CAPSULE_RADIUS, BOT_CAPSULE_LENGTH, 4, 8),
  new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),
);

/** World position of a bot's capsule center, after yaw. */
export function botCapsuleWorldCenter(pose: BotHitPose, target = new THREE.Vector3()) {
  center.set(BOT_CAPSULE_CENTER[0], BOT_CAPSULE_CENTER[1], BOT_CAPSULE_CENTER[2]);
  center.applyAxisAngle(Y_AXIS, pose.yaw);
  return target.set(pose.x + center.x, pose.y + center.y, pose.z + center.z);
}

/** On-screen diameter of the capsule at `distance` from a `viewHeight` view. */
export function botCapsuleScreenDiameter(distance: number, viewHeight: number, fovDeg = OFFICE_FOV) {
  if (!(distance > 0) || !(viewHeight > 0)) return 0;
  const half = Math.tan((fovDeg * Math.PI) / 360);
  return (BOT_CAPSULE_RADIUS * 2 * viewHeight) / (2 * half * distance);
}

/** Ray through a pointer on the canvas. Null when the canvas has no size. */
export function rayFromClient(
  camera: THREE.Camera,
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
) {
  if (!(rect.width > 0) || !(rect.height > 0)) return null;
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray.clone();
}

/**
 * Closest bot capsule the ray hits. Only capsules are tested, so a wall,
 * window, roof, floor, or desk in front of the bot cannot win.
 */
export function pickBotCapsule(ray: THREE.Ray, poses: readonly BotHitPose[]) {
  caster.ray.origin.copy(ray.origin);
  caster.ray.direction.copy(ray.direction);
  let bestId: string | null = null;
  let bestDistance = Infinity;
  for (const pose of poses) {
    botCapsuleWorldCenter(pose, capsule.position);
    capsule.rotation.set(0, pose.yaw, 0);
    capsule.updateMatrixWorld(true);
    const hit = caster.intersectObject(capsule, false)[0];
    if (hit && hit.distance < bestDistance) {
      bestDistance = hit.distance;
      bestId = pose.id;
    }
  }
  return bestId;
}
