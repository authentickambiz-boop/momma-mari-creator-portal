/** Road rectangles drawn once, with a rounded curb return at each crossing. */

export type RoadRect = { id: string; x: number; z: number; w: number; d: number };

export type RoadSegment = RoadRect & {
  alongX: boolean;
  /** This end was cut by a crossing, so the curb should turn. */
  roundStart: boolean;
  roundEnd: boolean;
};

export type RoadCrossing = RoadRect & { perpendicular: boolean };

/** Big enough that a wide overview still shows the curve, and small enough that neighboring corners do not meet. */
export const CURB_RADIUS = 2.9;
export const WALK_BAND = 1.35;

export type CurbReturn = {
  id: string;
  x: number;
  z: number;
  /** Theta start for a quarter turn, radians, three.js cylinder convention. */
  theta: number;
  /** Asphalt quarter radius. The sidewalk quarter is this plus the walk band. */
  radius: number;
};

function overlap(a: RoadRect, b: RoadRect) {
  const x = Math.max(a.x, b.x);
  const z = Math.max(a.z, b.z);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const z2 = Math.min(a.z + a.d, b.z + b.d);
  if (x2 - x < 0.35 || z2 - z < 0.35) return null;
  return { x, z, w: x2 - x, d: z2 - z };
}

export function roadPieces(roads: readonly RoadRect[]): { segments: RoadSegment[]; crossings: RoadCrossing[] } {
  const crossings: RoadCrossing[] = [];
  for (let i = 0; i < roads.length; i += 1) {
    for (let j = i + 1; j < roads.length; j += 1) {
      const hit = overlap(roads[i], roads[j]);
      if (!hit) continue;
      const aAcross = roads[i].w >= roads[i].d;
      const bAcross = roads[j].w >= roads[j].d;
      crossings.push({
        id: `xing-${roads[i].id}-${roads[j].id}`,
        ...hit,
        perpendicular: aAcross !== bAcross && Math.min(hit.w, hit.d) >= 2.6,
      });
    }
  }
  const segments: RoadSegment[] = [];
  roads.forEach((road) => {
    const alongX = road.w >= road.d;
    const cuts: [number, number][] = [];
    for (const cross of crossings) {
      if (!overlap(road, cross)) continue;
      if (alongX) cuts.push([Math.max(road.x, cross.x), Math.min(road.x + road.w, cross.x + cross.w)]);
      else cuts.push([Math.max(road.z, cross.z), Math.min(road.z + road.d, cross.z + cross.d)]);
    }
    cuts.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const cut of cuts) {
      const last = merged[merged.length - 1];
      if (!last || cut[0] > last[1] + 0.04) merged.push([cut[0], cut[1]]);
      else last[1] = Math.max(last[1], cut[1]);
    }
    const start = alongX ? road.x : road.z;
    const end = alongX ? road.x + road.w : road.z + road.d;
    const spans: [number, number][] = [];
    let cursor = start;
    for (const [a, b] of merged) {
      if (a - cursor > 0.45) spans.push([cursor, a]);
      cursor = Math.max(cursor, b);
    }
    if (end - cursor > 0.45) spans.push([cursor, end]);
    spans.forEach(([a, b], index) => {
      const roundStart = Math.abs(a - start) > 0.2;
      const roundEnd = Math.abs(b - end) > 0.2;
      if (alongX) {
        segments.push({ id: `${road.id}-seg-${index}`, x: a, z: road.z, w: b - a, d: road.d, alongX, roundStart, roundEnd });
      } else {
        segments.push({ id: `${road.id}-seg-${index}`, x: road.x, z: a, w: road.w, d: b - a, alongX, roundStart, roundEnd });
      }
    });
  });
  return { segments, crossings };
}

/** Quarter-circle curb returns just outside each corner of a real junction. */
export function curbReturns(crossings: readonly RoadCrossing[], radius = CURB_RADIUS): CurbReturn[] {
  const turns: CurbReturn[] = [];
  crossings.filter((cross) => cross.perpendicular).forEach((cross) => {
    const fit = Math.min(radius, Math.min(cross.w, cross.d) * 0.46);
    if (fit < 1.35) return;
    const corners: { x: number; z: number; theta: number }[] = [
      { x: cross.x, z: cross.z, theta: Math.PI },
      { x: cross.x + cross.w, z: cross.z, theta: -Math.PI / 2 },
      { x: cross.x + cross.w, z: cross.z + cross.d, theta: 0 },
      { x: cross.x, z: cross.z + cross.d, theta: Math.PI / 2 },
    ];
    corners.forEach((corner, index) => {
      turns.push({
        id: `${cross.id}-turn-${index}`,
        x: corner.x,
        z: corner.z,
        theta: corner.theta,
        radius: fit,
      });
    });
  });
  return turns;
}

export const CITY_PARK = { id: "city-park", x: -16, z: 2, w: 12, d: 14 };
export const MANSION_FOUNTAIN = { id: "mansion-fountain", x: -69.4, z: -2.3, w: 4.8, d: 4.8 };
