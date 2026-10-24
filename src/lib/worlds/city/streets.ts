/** Road rectangles drawn once, with a rounded curb return at each crossing. */

export type RoadRect = { id: string; x: number; z: number; w: number; d: number };

export type RoadSegment = RoadRect & {
  alongX: boolean;
  /** This end was cut by a crossing, so the curb should turn. */
  roundStart: boolean;
  roundEnd: boolean;
};

export type RoadCrossing = RoadRect & { perpendicular: boolean };

/**
 * Corner radius stays under a quarter of the road width so neighboring
 * curb discs meet the straight edge and do not cover each other.
 */
export const CURB_RADIUS = 2.4;
export const WALK_WIDTH = 1.2;

export type CurbReturn = {
  id: string;
  /** Center of the curb arc, inset into the asphalt. */
  x: number;
  z: number;
  /**
   * Y rotation for a cylinder quarter that starts in +X/+Z.
   * The quarter covers the sharp corner tip.
   */
  theta: number;
  radius: number;
};

export type RoadCap = {
  id: string;
  x: number;
  z: number;
  radius: number;
  /** Y rotation for a half-disc that bulges outward. Unrotated half occupies +X. */
  theta: number;
};

export type CityPaving = {
  asphalt: RoadRect[];
  walks: RoadRect[];
  rounds: CurbReturn[];
  caps: RoadCap[];
};

function overlap(a: RoadRect, b: RoadRect) {
  const x = Math.max(a.x, b.x);
  const z = Math.max(a.z, b.z);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const z2 = Math.min(a.z + a.d, b.z + b.d);
  if (x2 - x < 0.35 || z2 - z < 0.35) return null;
  return { x, z, w: x2 - x, d: z2 - z };
}

/** A join counts even when the shared sliver is thinner than a crossing pad. */
function touches(a: RoadRect, b: RoadRect) {
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const z2 = Math.min(a.z + a.d, b.z + b.d);
  return x2 - Math.max(a.x, b.x) > 0.05 && z2 - Math.max(a.z, b.z) > 0.05;
}

/**
 * Outer radius of the sidewalk ring that hides a square curb tip.
 * The ring starts at `radius` (the curb arc) and just clears the sharp corner.
 */
export function curbOuterRadius(radius: number) {
  return radius * Math.SQRT2 + 0.08;
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

function areaOverlap(a: RoadRect, b: RoadRect) {
  const hit = overlap(a, b);
  return hit ? hit.w * hit.d : 0;
}

/** Break `base` into the parts that do not sit on `cut`. */
function subtractRect(base: RoadRect, cut: RoadRect): RoadRect[] {
  const ix = Math.max(base.x, cut.x);
  const iz = Math.max(base.z, cut.z);
  const ix2 = Math.min(base.x + base.w, cut.x + cut.w);
  const iz2 = Math.min(base.z + base.d, cut.z + cut.d);
  if (ix2 - ix < 0.04 || iz2 - iz < 0.04) return [base];
  const x0 = base.x;
  const z0 = base.z;
  const x1 = base.x + base.w;
  const z1 = base.z + base.d;
  const parts: RoadRect[] = [];
  if (ix - x0 > 0.05) parts.push({ id: `${base.id}-w`, x: x0, z: z0, w: ix - x0, d: z1 - z0 });
  if (x1 - ix2 > 0.05) parts.push({ id: `${base.id}-e`, x: ix2, z: z0, w: x1 - ix2, d: z1 - z0 });
  if (iz - z0 > 0.05) parts.push({ id: `${base.id}-n`, x: ix, z: z0, w: ix2 - ix, d: iz - z0 });
  if (z1 - iz2 > 0.05) parts.push({ id: `${base.id}-s`, x: ix, z: iz2, w: ix2 - ix, d: z1 - iz2 });
  return parts;
}

/** One rectangle per patch of ground. Overlaps are given to the earlier rect. */
export function uniquifyRects(rects: readonly RoadRect[]): RoadRect[] {
  let pieces = rects.map((rect) => ({ ...rect }));
  let guard = 0;
  let changed = true;
  while (changed && guard < 80) {
    changed = false;
    guard += 1;
    for (let i = 0; i < pieces.length; i += 1) {
      for (let j = i + 1; j < pieces.length; j += 1) {
        if (areaOverlap(pieces[i], pieces[j]) < 0.02) continue;
        const parts = subtractRect(pieces[j], pieces[i]);
        pieces.splice(j, 1, ...parts);
        changed = true;
        break;
      }
      if (changed) break;
    }
  }
  return pieces.filter((rect) => rect.w > 0.12 && rect.d > 0.12);
}

function endSlice(road: RoadRect, alongX: boolean, fromStart: boolean, t: number): RoadRect {
  if (alongX) {
    const x = fromStart ? road.x + t : road.x + road.w - t - 0.35;
    return { id: "slice", x, z: road.z, w: 0.35, d: road.d };
  }
  const z = fromStart ? road.z + t : road.z + road.d - t - 0.35;
  return { id: "slice", x: road.x, z, w: road.w, d: 0.35 };
}

/** Pull a short dead-end stub back to the road it was trying to meet. */
export function trimStubs(roads: readonly RoadRect[]): RoadRect[] {
  return roads.map((road) => {
    const others = roads.filter((item) => item.id !== road.id);
    const alongX = road.w >= road.d;
    const trim = (fromStart: boolean) => {
      const span = alongX ? road.w : road.d;
      const limit = Math.min(4, span * 0.4);
      const joined = (t: number) => others.some((other) => touches(endSlice(road, alongX, fromStart, t), other));
      if (joined(0.2)) return 0;
      for (let t = 0.45; t <= limit; t += 0.25) {
        if (joined(t)) return t;
      }
      return 0;
    };
    let { x, z, w, d } = road;
    const start = trim(true);
    const end = trim(false);
    if (alongX) {
      x += start;
      w -= start + end;
    } else {
      z += start;
      d -= start + end;
    }
    if (w < 2.2 || d < 2.2) return { ...road };
    return { ...road, x, z, w, d };
  });
}

function pointOnRoad(roads: readonly RoadRect[], x: number, z: number) {
  return roads.some((road) => x >= road.x + 0.08 && x <= road.x + road.w - 0.08 && z >= road.z + 0.08 && z <= road.z + road.d - 0.08);
}

/**
 * A crossing corner gets a rounded return when the outside is grass and the
 * asphalt fills either three quadrants (a through-street fillet) or only the
 * inside quadrant (both roads end, so the tip itself must be rounded).
 * A straight edge of a T has two asphalt quadrants and is left alone.
 */
function curbCorner(roads: readonly RoadRect[], cx: number, cz: number, sx: number, sz: number) {
  const on = (x: number, z: number) => pointOnRoad(roads, cx + x, cz + z);
  const outside = on(sx * 0.55, sz * 0.55);
  const inside = on(-sx * 0.55, -sz * 0.55);
  const sideA = on(-sx * 0.55, sz * 0.55);
  const sideB = on(sx * 0.55, -sz * 0.55);
  const filled = [outside, inside, sideA, sideB].filter(Boolean).length;
  return !outside && inside && (filled === 3 || filled === 1);
}

function sidewalkStrips(road: RoadRect): RoadRect[] {
  const span = WALK_WIDTH;
  if (road.w >= road.d) {
    return [
      { id: `${road.id}-walk-n`, x: road.x, z: road.z - span, w: road.w, d: span },
      { id: `${road.id}-walk-s`, x: road.x, z: road.z + road.d, w: road.w, d: span },
    ];
  }
  return [
    { id: `${road.id}-walk-w`, x: road.x - span, z: road.z, w: span, d: road.d },
    { id: `${road.id}-walk-e`, x: road.x + road.w, z: road.z, w: span, d: road.d },
  ];
}

function deadCaps(roads: readonly RoadRect[]): RoadCap[] {
  const caps: RoadCap[] = [];
  roads.forEach((road) => {
    const others = roads.filter((item) => item.id !== road.id);
    const alongX = road.w >= road.d;
    const half = (alongX ? road.d : road.w) / 2;
    const ends: { fromStart: boolean }[] = [{ fromStart: true }, { fromStart: false }];
    ends.forEach(({ fromStart }) => {
      if (others.some((other) => touches(endSlice(road, alongX, fromStart, 0.15), other))) return;
      if (alongX && fromStart) caps.push({ id: `${road.id}-cap-w`, x: road.x, z: road.z + road.d / 2, radius: half, theta: Math.PI });
      else if (alongX) caps.push({ id: `${road.id}-cap-e`, x: road.x + road.w, z: road.z + road.d / 2, radius: half, theta: 0 });
      else if (fromStart) caps.push({ id: `${road.id}-cap-n`, x: road.x + road.w / 2, z: road.z, radius: half, theta: Math.PI / 2 });
      else caps.push({ id: `${road.id}-cap-s`, x: road.x + road.w / 2, z: road.z + road.d, radius: half, theta: -Math.PI / 2 });
    });
  });
  return caps;
}

/** Asphalt drawn once, sidewalks flush to the curb, and a rounded return only where the curb actually turns. */
export function paveCity(roads: readonly RoadRect[], radius = CURB_RADIUS): CityPaving {
  const trimmed = trimStubs(roads);
  const laid = roadPieces(trimmed);
  const asphalt = uniquifyRects([...laid.segments, ...laid.crossings]);
  const rounds: CurbReturn[] = [];
  const cornerWalks: RoadRect[] = [];
  laid.crossings.filter((cross) => cross.perpendicular).forEach((cross) => {
    const fit = Math.min(radius, Math.min(cross.w, cross.d) * 0.4);
    if (fit < 0.7) return;
    const corners: { x: number; z: number; sx: number; sz: number; theta: number }[] = [
      { x: cross.x, z: cross.z, sx: -1, sz: -1, theta: Math.PI },
      { x: cross.x + cross.w, z: cross.z, sx: 1, sz: -1, theta: Math.PI / 2 },
      { x: cross.x + cross.w, z: cross.z + cross.d, sx: 1, sz: 1, theta: 0 },
      { x: cross.x, z: cross.z + cross.d, sx: -1, sz: 1, theta: -Math.PI / 2 },
    ];
    corners.forEach((corner, index) => {
      if (!curbCorner(trimmed, corner.x, corner.z, corner.sx, corner.sz)) return;
      rounds.push({
        id: `${cross.id}-turn-${index}`,
        x: corner.x - corner.sx * fit,
        z: corner.z - corner.sz * fit,
        theta: corner.theta,
        radius: fit,
      });
      const walkX = corner.sx < 0 ? corner.x - WALK_WIDTH : corner.x;
      const walkZ = corner.sz < 0 ? corner.z - WALK_WIDTH : corner.z;
      const midX = corner.x + corner.sx * (WALK_WIDTH / 2);
      const midZ = corner.z + corner.sz * (WALK_WIDTH / 2);
      if (!pointOnRoad(trimmed, midX, midZ)) {
        cornerWalks.push({ id: `${cross.id}-corner-${index}`, x: walkX, z: walkZ, w: WALK_WIDTH, d: WALK_WIDTH });
      }
    });
  });
  const walks = uniquifyRects([...trimmed.flatMap(sidewalkStrips), ...cornerWalks]);
  return { asphalt, walks, rounds, caps: deadCaps(trimmed) };
}

/** Quarter-circle curb returns. Callers that have the roads should use paveCity, which drops straight T edges. */
export function curbReturns(crossings: readonly RoadCrossing[], radius = CURB_RADIUS): CurbReturn[] {
  return crossings.flatMap((cross) => {
    if (!cross.perpendicular) return [];
    const fit = Math.min(radius, Math.min(cross.w, cross.d) * 0.4);
    if (fit < 0.7) return [];
    const corners: { x: number; z: number; sx: number; sz: number; theta: number }[] = [
      { x: cross.x, z: cross.z, sx: -1, sz: -1, theta: Math.PI },
      { x: cross.x + cross.w, z: cross.z, sx: 1, sz: -1, theta: Math.PI / 2 },
      { x: cross.x + cross.w, z: cross.z + cross.d, sx: 1, sz: 1, theta: 0 },
      { x: cross.x, z: cross.z + cross.d, sx: -1, sz: 1, theta: -Math.PI / 2 },
    ];
    return corners.map((corner, index) => ({
      id: `${cross.id}-turn-${index}`,
      x: corner.x - corner.sx * fit,
      z: corner.z - corner.sz * fit,
      theta: corner.theta,
      radius: fit,
    }));
  });
}

export const CITY_PARK = { id: "city-park", x: -16, z: 2, w: 12, d: 14 };
export const MANSION_FOUNTAIN = { id: "mansion-fountain", x: -69.4, z: -2.3, w: 4.8, d: 4.8 };
