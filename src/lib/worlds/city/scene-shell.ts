/**
 * Camera contract shared with the bot office.
 * The office Canvas in office-canvas.tsx is the renderer.
 * These bounds let the city pan farther without changing the office limits.
 */

import { MAP_MAX_DISTANCE, MAP_MIN_DISTANCE, officeCameraHome } from "../office-move";
import { sunElevation, weatherFromClock, type OfficeWeather } from "../office-weather";

export type TargetBounds = {
  kind: "office" | "city";
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

/** The same clamp the office has always used. */
export function officeTargetBounds(layout: { width: number; depth: number }): TargetBounds {
  return {
    kind: "office",
    minX: -14,
    maxX: layout.width + 14,
    minY: 0.4,
    maxY: 3.2,
    minZ: -14,
    maxZ: layout.depth + 28,
  };
}

export function poseInsideBounds(
  position: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  bounds: TargetBounds,
) {
  const values = [position.x, position.y, position.z, target.x, target.y, target.z];
  if (values.some((value) => !Number.isFinite(value))) return false;
  if (target.x < bounds.minX || target.x > bounds.maxX) return false;
  if (target.y < bounds.minY || target.y > bounds.maxY) return false;
  if (target.z < bounds.minZ || target.z > bounds.maxZ) return false;
  const distance = Math.hypot(position.x - target.x, position.y - target.y, position.z - target.z);
  if (distance < MAP_MIN_DISTANCE - 0.05 || distance > MAP_MAX_DISTANCE + 0.05) return false;
  if (position.y < 0.15) return false;
  return true;
}

/**
 * The office sun and sky, held at a clear afternoon.
 * The live office keeps the real Mooresville clock. The city starts in daylight
 * so the streets read, and the same lighting math still goes dark at night.
 */
export function cityDayWeather(date = new Date()): OfficeWeather {
  const hour = 14;
  const elevation = sunElevation(hour);
  const weather = weatherFromClock(date, { kind: "clear", cloud: 0.1, wind: 1.5, tempC: 22 });
  return {
    ...weather,
    hour,
    sunElevation: elevation,
    isDay: elevation > 0,
    kind: "clear",
    cloud: 0.1,
    label: "Mooresville · 72°F · Clear",
  };
}

/** Same lighting math as the office, held after dark so street lamps can be checked. */
export function cityNightWeather(date = new Date()): OfficeWeather {
  const hour = 21;
  const elevation = sunElevation(hour);
  const weather = weatherFromClock(date, { kind: "clear", cloud: 0.05, wind: 1, tempC: 14 });
  return {
    ...weather,
    hour,
    sunElevation: elevation,
    isDay: elevation > 0,
    kind: "clear",
    cloud: 0.05,
    label: "Mooresville · night",
  };
}

/** Billboard size for a district name. Tall enough to read from the city overview. */
export function districtBillboard(label: string) {
  const wide = Math.max(18, Math.min(34, label.length * 1.7));
  return { wide, tall: 6.4 };
}

/**
 * Eye just inside a walk-in, aimed across the room.
 * The office polar limit still applies, so the eye stays a little above the aim.
 */
export function interiorStand(plot: { x: number; z: number; w: number; d: number; yaw: number }) {
  const cx = plot.x + plot.w / 2;
  const cz = plot.z + plot.d / 2;
  const ox = Math.sin(plot.yaw);
  const oz = Math.cos(plot.yaw);
  const eyeReach = Math.min(Math.max(plot.d * 0.16, 1.15), 2.35);
  const aimReach = eyeReach - 3.45;
  return {
    eye: { x: cx + ox * eyeReach, y: 1.95, z: cz + oz * eyeReach },
    aim: { x: cx + ox * aimReach, y: 1.15, z: cz + oz * aimReach },
  };
}

/** Same aim as the office, pulled back so the streets around HQ fit in frame. */
export function cityOverviewHome(layout: { width: number; depth: number }) {
  const office = officeCameraHome(layout.width, layout.depth);
  const offset = office.position.clone().sub(office.target);
  const distance = Math.min(MAP_MAX_DISTANCE - 6, Math.max(offset.length() * 2.6, 188));
  offset.setLength(distance);
  return {
    position: office.target.clone().add(offset),
    target: office.target.clone(),
    distance,
  };
}
