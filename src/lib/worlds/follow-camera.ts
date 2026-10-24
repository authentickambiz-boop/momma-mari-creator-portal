import { rotateOffset } from "./office-move";

/** Follow sits behind the player. Overview is the owner office map. */
export type CameraMode = "follow" | "overview";

export type FollowOrbit = {
  /** Matches the character yaw when the camera is directly behind them. */
  yaw: number;
  /** Radians above the horizon. */
  pitch: number;
  distance: number;
};

export const FOLLOW_LOOK_Y = 1.15;
export const FOLLOW_SHOULDER = 0.42;
export const FOLLOW_DEFAULT_DISTANCE = 6.4;
export const FOLLOW_MIN_DISTANCE = 3.2;
export const FOLLOW_MAX_DISTANCE = 16;
export const FOLLOW_DEFAULT_PITCH = 0.48;
export const FOLLOW_MIN_PITCH = 0.28;
export const FOLLOW_MAX_PITCH = 1.05;
/** Higher catches the character faster. Orbit itself is applied immediately. */
export const FOLLOW_SMOOTH = 7;

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function followOrbitBehind(characterYaw = 0): FollowOrbit {
  return {
    yaw: Number.isFinite(characterYaw) ? characterYaw : 0,
    pitch: FOLLOW_DEFAULT_PITCH,
    distance: FOLLOW_DEFAULT_DISTANCE,
  };
}

/**
 * Third-person pose. The look target is the character, so they stay centered.
 * The camera sits behind and a little to the right (over the shoulder).
 * Yaw 0 matches a character facing +Z.
 */
export function desiredFollowPose(
  focus: { x: number; z: number },
  orbit: FollowOrbit,
) {
  const distance = clamp(orbit.distance, FOLLOW_MIN_DISTANCE, FOLLOW_MAX_DISTANCE);
  const pitch = clamp(orbit.pitch, FOLLOW_MIN_PITCH, FOLLOW_MAX_PITCH);
  const yaw = Number.isFinite(orbit.yaw) ? orbit.yaw : 0;
  const horizontal = Math.cos(pitch) * distance;
  const raised = Math.sin(pitch) * distance;
  const x = focus.x - Math.sin(yaw) * horizontal + Math.cos(yaw) * FOLLOW_SHOULDER;
  const z = focus.z - Math.cos(yaw) * horizontal - Math.sin(yaw) * FOLLOW_SHOULDER;
  return {
    position: { x, y: FOLLOW_LOOK_Y + raised, z },
    target: { x: focus.x, y: FOLLOW_LOOK_Y, z: focus.z },
    distance,
    pitch,
    yaw,
  };
}

/** Distance only. Azimuth and pitch stay put. */
export function zoomFollowDistance(distance: number, factor: number) {
  const current = Number.isFinite(distance) ? distance : FOLLOW_DEFAULT_DISTANCE;
  const scale = Number.isFinite(factor) ? factor : 1;
  return clamp(current * scale, FOLLOW_MIN_DISTANCE, FOLLOW_MAX_DISTANCE);
}

/** Right-drag or two-finger orbit. Distance is unchanged. */
export function orbitFollow(
  orbit: FollowOrbit,
  dx: number,
  dy: number,
  viewportHeight: number,
): FollowOrbit {
  const turn = rotateOffset(dx, dy, viewportHeight, 0.7);
  return {
    yaw: orbit.yaw + turn.theta,
    pitch: clamp(orbit.pitch + turn.phi, FOLLOW_MIN_PITCH, FOLLOW_MAX_PITCH),
    distance: orbit.distance,
  };
}

/** Exponential catch-up. One small step never leaps past the character. */
export function smoothFollowValue(current: number, goal: number, dt: number, lambda = FOLLOW_SMOOTH) {
  if (!Number.isFinite(goal)) return Number.isFinite(current) ? current : 0;
  if (!Number.isFinite(current)) return goal;
  const step = Math.min(Math.max(dt, 0), 0.05);
  const t = 1 - Math.exp(-lambda * step);
  return current + (goal - current) * t;
}

/**
 * City block at /worlds/city. Off unless the flag is true, on, or 1.
 * The page stays owner-only either way. Real money is not involved.
 */
export function worldsCityEnabled(env: string | undefined = process.env.WORLDS_CITY) {
  const raw = (env ?? "").trim().toLowerCase();
  return raw === "true" || raw === "on" || raw === "1";
}
