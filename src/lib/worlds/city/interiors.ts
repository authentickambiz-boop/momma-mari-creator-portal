/** Wall-hugging room plans. The center aisle stays open up to the objective. */

import type { BuildingModel } from "./locations";

export type InteriorZone = "entry" | "work" | "lounge" | "decor" | "path" | "objective";

export type InteriorFinish = "wood" | "metal" | "stone" | "plaster" | "glass" | "paint";

export type InteriorBox = {
  id: string;
  zone: InteriorZone;
  /** Center of the box, in the building's local space. */
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
  finish: InteriorFinish;
  /** Window glass, drawn from both sides. */
  glass?: boolean;
  /** Floor marker at the end of the aisle. It is the destination, not an obstacle. */
  marker?: boolean;
  /** Ignore the room light so a floor stripe stays readable. */
  unlit?: boolean;
};

export type InteriorAisle = {
  half: number;
  objectiveZ: number;
  /** Min-corner rect of the walkable aisle, stopping short of the marker. */
  x: number;
  z: number;
  w: number;
  d: number;
};

type Room = {
  halfW: number;
  halfD: number;
  aisle: number;
  objectiveZ: number;
};

type Piece = {
  id: string;
  zone: InteriorZone;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
  finish?: InteriorFinish;
  glass?: boolean;
  marker?: boolean;
  unlit?: boolean;
};

const MODELS: readonly BuildingModel[] = [
  "library",
  "learning",
  "call-center",
  "art",
  "lab",
  "computers",
  "music",
  "club",
  "bank",
  "clothing",
  "furniture",
  "studio",
  "apartment",
  "houses",
  "loft",
  "mansion",
  "home",
];

export function interiorModels() {
  return MODELS;
}

/**
 * Local shift from the plot center to the furnished unit.
 * House lane's middle house is centered. The loft and studio rooms are not.
 */
export function homeRoomShift(model: BuildingModel, plotW: number, _plotD: number) {
  const w = plotW * 0.92;
  if (model === "loft") return { x: -w * 0.24, z: 0 };
  if (model === "studio") return { x: -w * 0.125, z: 0 };
  if (model === "houses") return { x: 0, z: -0.4 };
  return { x: 0, z: 0 };
}

export function interiorAisle(w: number, d: number): InteriorAisle {
  const half = Math.min(0.42, Math.max(0.24, w * 0.12));
  const objectiveZ = -d / 2 + Math.min(1.05, Math.max(0.7, d * 0.26));
  const z = objectiveZ + 0.38;
  const front = d / 2 - 0.08;
  return { half, objectiveZ, x: -half, z, w: half * 2, d: Math.max(0.4, front - z) };
}

function roomOf(w: number, d: number): Room {
  const aisle = interiorAisle(w, d);
  return { halfW: w / 2, halfD: d / 2, aisle: aisle.half, objectiveZ: aisle.objectiveZ };
}

function box(piece: Piece): InteriorBox {
  return { finish: "wood", ...piece };
}

/** A block against the left or right wall, kept out of the aisle. */
function side(room: Room, which: "left" | "right", id: string, z: number, wantW: number, h: number, wantD: number, color: string, zone: InteriorZone, finish: InteriorFinish = "wood", y = h / 2): InteriorBox {
  const span = Math.max(0.28, room.halfW - room.aisle - 0.18);
  const w = Math.min(wantW, span);
  const x = which === "left" ? -room.halfW + 0.14 + w / 2 : room.halfW - 0.14 - w / 2;
  const depth = Math.min(wantD, Math.max(0.28, room.halfD * 0.55));
  return box({ id, zone, x, y, z, w, h, d: depth, color, finish });
}

/** Furniture on the back wall, behind the objective marker. */
function back(room: Room, id: string, wantW: number, h: number, wantD: number, color: string, zone: InteriorZone, finish: InteriorFinish = "wood", y = h / 2): InteriorBox {
  const w = Math.min(wantW, room.halfW * 2 - 0.5);
  const depth = Math.min(wantD, 0.55);
  const z = room.objectiveZ - depth * 0.35;
  return box({ id, zone, x: 0, y, z, w, h, d: depth, color, finish });
}

function poster(room: Room, id: string, x: number, y: number, z: number, wide: number, tall: number, color: string, facing: "back" | "left" | "right"): InteriorBox {
  if (facing === "back") {
    return box({ id, zone: "decor", x, y, z: -room.halfD + 0.1, w: wide, h: tall, d: 0.05, color, finish: "paint" });
  }
  const edge = facing === "left" ? -room.halfW + 0.1 : room.halfW - 0.1;
  return box({ id, zone: "decor", x: edge, y, z, w: 0.05, h: tall, d: wide, color, finish: "paint" });
}

function windowPane(room: Room, id: string, x: number, z: number, wide: number, tall: number, facing: "back" | "side"): InteriorBox {
  if (facing === "back") {
    return box({ id, zone: "decor", x, y: 1.45, z: -room.halfD + 0.12, w: wide, h: tall, d: 0.05, color: "#d7eef6", finish: "glass", glass: true });
  }
  const edge = x < 0 ? -room.halfW + 0.12 : room.halfW - 0.12;
  return box({ id, zone: "decor", x: edge, y: 1.45, z, w: 0.05, h: tall, d: wide, color: "#d7eef6", finish: "glass", glass: true });
}

function windows(room: Room, prefix: string): InteriorBox[] {
  const wide = Math.min(0.7, room.halfW * 0.4);
  return [
    windowPane(room, `${prefix}-win-bl`, -room.halfW * 0.42, 0, wide, 0.72, "back"),
    windowPane(room, `${prefix}-win-br`, room.halfW * 0.42, 0, wide, 0.72, "back"),
    windowPane(room, `${prefix}-win-l`, -1, room.halfD * 0.15, wide, 0.72, "side"),
    windowPane(room, `${prefix}-win-r`, 1, -room.halfD * 0.05, wide, 0.72, "side"),
  ];
}

function runner(room: Room, color: string): InteriorBox {
  const aisle = interiorAisle(room.halfW * 2, room.halfD * 2);
  return box({
    id: "path",
    zone: "path",
    x: 0,
    y: 0.125,
    z: aisle.z + aisle.d / 2,
    w: Math.max(0.42, aisle.w),
    h: 0.04,
    d: aisle.d,
    color,
    finish: "plaster",
    unlit: true,
  });
}

function marker(room: Room, color: string): InteriorBox {
  return box({
    id: "objective",
    zone: "objective",
    x: 0,
    y: 0.2,
    z: room.objectiveZ + 0.22,
    w: 0.2,
    h: 0.4,
    d: 0.2,
    color,
    finish: "paint",
    marker: true,
  });
}

function plant(room: Room, which: "left" | "right"): InteriorBox {
  const x = which === "left" ? -room.halfW + 0.32 : room.halfW - 0.32;
  return box({
    id: "plant",
    zone: "entry",
    x,
    y: 0.28,
    z: room.halfD - 0.36,
    w: 0.28,
    h: 0.5,
    d: 0.28,
    color: "#2f6d4f",
    finish: "plaster",
  });
}

function shared(room: Room, path: string, mark: string): InteriorBox[] {
  return [...windows(room, "room"), runner(room, path), marker(room, mark), plant(room, "right")];
}

function layoutFor(model: BuildingModel, room: Room): InteriorBox[] {
  if (model === "library") {
    return [
      ...shared(room, "#6b4a32", "#f2c14e"),
      side(room, "left", "stacks-a", -room.halfD * 0.15, 0.55, 1.45, 0.9, "#6b3a28", "work"),
      side(room, "left", "stacks-b", room.halfD * 0.28, 0.55, 1.35, 0.8, "#8d5524", "work"),
      side(room, "right", "reading-table", 0.05, 0.7, 0.08, 0.7, "#f7f1e4", "lounge", "wood", 0.42),
      side(room, "right", "reading-leg", 0.05, 0.08, 0.36, 0.08, "#6b4a32", "lounge", "wood", 0.18),
      side(room, "right", "lamp", 0.28, 0.14, 0.22, 0.14, "#f6e2a8", "lounge", "metal", 0.58),
      back(room, "catalog", 1.1, 0.7, 0.4, "#4e3418", "work"),
      poster(room, "tips", 0, 1.55, 0, 0.9, 0.55, "#1f3b2d", "back"),
    ];
  }
  if (model === "call-center") {
    return [
      ...shared(room, "#8ec4ea", "#9dff6a"),
      side(room, "left", "booth-desk", 0, 0.7, 0.08, 0.55, "#d7e7f2", "work", "paint", 0.42),
      side(room, "left", "booth-screen", -0.08, 0.42, 0.32, 0.05, "#8ec4ea", "work", "glass", 0.66),
      side(room, "left", "headset", 0.18, 0.1, 0.12, 0.1, "#243044", "work", "metal", 0.54),
      side(room, "right", "queue-desk", 0.05, 0.7, 0.08, 0.55, "#d7e7f2", "work", "paint", 0.42),
      side(room, "right", "queue-screen", 0, 0.4, 0.3, 0.05, "#1f3b2d", "work", "glass", 0.64),
      side(room, "right", "coffee", room.halfD * 0.35, 0.35, 0.4, 0.35, "#6b3a28", "lounge"),
      back(room, "script-board", 1.3, 0.7, 0.08, "#1f3b2d", "work", "paint", 1.25),
      poster(room, "script-card", room.halfW * 0.35, 1.5, 0, 0.45, 0.35, "#f2c14e", "back"),
    ];
  }
  if (model === "learning") {
    return [
      ...shared(room, "#d7c4a3", "#f2c14e"),
      side(room, "right", "lesson-desk", 0, 0.75, 0.08, 0.55, "#f7f1e4", "work", "wood", 0.42),
      side(room, "right", "notebook", 0.08, 0.16, 0.05, 0.2, "#8ec4ea", "work", "paint", 0.5),
      side(room, "left", "booth", -0.1, 0.55, 1.1, 0.4, "#243044", "lounge", "paint"),
      back(room, "badge-wall", 1.4, 0.85, 0.08, "#1f3b2d", "work", "paint", 1.3),
      poster(room, "badge", -0.35, 1.45, 0, 0.32, 0.32, "#f2c14e", "back"),
      poster(room, "badge-b", 0.35, 1.45, 0, 0.32, 0.32, "#e07a5f", "back"),
    ];
  }
  if (model === "art") {
    return [
      ...shared(room, "#f4efe4", "#e07a5f"),
      side(room, "left", "easel-post", -0.05, 0.08, 1.25, 0.08, "#6b3a28", "work"),
      side(room, "left", "canvas", 0.02, 0.5, 0.62, 0.05, "#f2b4c4", "work", "paint", 1.05),
      side(room, "right", "drawing-table", 0, 0.8, 0.08, 0.6, "#f7f1e4", "work", "wood", 0.42),
      side(room, "right", "paint-a", 0.15, 0.12, 0.14, 0.12, "#e07a5f", "lounge", "paint", 0.52),
      side(room, "right", "paint-b", 0.32, 0.1, 0.12, 0.1, "#f2c14e", "lounge", "paint", 0.5),
      back(room, "thumb-a", 0.4, 0.36, 0.05, "#e07a5f", "decor", "paint", 1.35),
      poster(room, "thumb-b", -0.45, 1.4, 0, 0.4, 0.36, "#8ec4ea", "back"),
      poster(room, "thumb-c", 0.45, 1.4, 0, 0.4, 0.36, "#f2c14e", "back"),
    ];
  }
  if (model === "lab") {
    return [
      ...shared(room, "#d9d3c8", "#8ec4ea"),
      back(room, "bench", 1.5, 0.85, 0.48, "#d9d3c8", "work", "metal"),
      side(room, "left", "samples", 0, 0.4, 0.9, 0.35, "#8ec4ea", "work", "glass"),
      side(room, "right", "scope-table", 0, 0.7, 0.08, 0.5, "#f7f1e4", "lounge", "metal", 0.42),
      poster(room, "brief", room.halfW * 0.2, 1.5, 0, 0.7, 0.45, "#1f3b2d", "back"),
    ];
  }
  if (model === "computers") {
    return [
      ...shared(room, "#1c3330", "#9dff6a"),
      side(room, "left", "desk-a", 0, 0.75, 0.08, 0.5, "#1c3330", "work", "metal", 0.42),
      side(room, "left", "screen-a", -0.06, 0.48, 0.34, 0.05, "#9dff6a", "work", "glass", 0.66),
      side(room, "right", "desk-b", 0.05, 0.75, 0.08, 0.5, "#243044", "work", "metal", 0.42),
      side(room, "right", "screen-b", 0, 0.46, 0.32, 0.05, "#9dff6a", "work", "glass", 0.64),
      side(room, "right", "stool", room.halfD * 0.32, 0.32, 0.42, 0.32, "#6b4a32", "lounge"),
      back(room, "rack", 0.55, 1.2, 0.4, "#1c3330", "work", "metal"),
      poster(room, "qa", 0.55, 1.45, 0, 0.55, 0.4, "#f7f1e4", "back"),
    ];
  }
  if (model === "music") {
    return [
      ...shared(room, "#1c211e", "#f2c14e"),
      back(room, "keys", 1.2, 0.7, 0.42, "#1c211e", "work"),
      side(room, "left", "booth", 0, 0.4, 1.05, 0.35, "#243044", "lounge", "paint"),
      side(room, "right", "speaker", 0, 0.28, 0.7, 0.28, "#f2c14e", "work", "metal"),
      side(room, "right", "mixer", room.halfD * 0.32, 0.5, 0.1, 0.35, "#6b4a32", "work", "wood", 0.48),
      poster(room, "poster", 0, 1.45, 0, 0.7, 0.45, "#e07a5f", "back"),
    ];
  }
  if (model === "club") {
    return [
      ...shared(room, "#3d2a48", "#f2c14e"),
      back(room, "stage", 1.6, 0.28, 0.55, "#3d2a48", "work"),
      side(room, "left", "booth-l", 0.1, 0.7, 0.4, 0.7, "#6b4c7a", "lounge"),
      side(room, "right", "bar", 0, 0.9, 0.55, 0.4, "#2a2e33", "work", "wood"),
      poster(room, "lights", 0, 1.55, 0, 0.8, 0.28, "#f6e2a8", "back"),
    ];
  }
  if (model === "bank") {
    return [
      ...shared(room, "#c6a15a", "#f2c14e"),
      back(room, "teller", 1.6, 0.95, 0.42, "#243044", "work", "stone"),
      side(room, "left", "vault", -0.05, 0.7, 1.15, 0.12, "#2a2e33", "work", "metal"),
      side(room, "right", "ledger", 0.15, 0.55, 0.7, 0.35, "#f7f1e4", "lounge"),
      side(room, "left", "chair-a", room.halfD * 0.32, 0.32, 0.42, 0.32, "#6b4a32", "lounge"),
      side(room, "right", "chair-b", room.halfD * 0.32, 0.32, 0.42, 0.32, "#6b4a32", "lounge"),
      poster(room, "rates", 0, 1.55, 0, 0.9, 0.32, "#c6a15a", "back"),
    ];
  }
  if (model === "clothing") {
    return [
      ...shared(room, "#f7e7ee", "#d4567a"),
      side(room, "left", "rack-a", 0, 0.1, 1.3, 0.55, "#6a243c", "work", "metal"),
      side(room, "left", "garment-a", 0.02, 0.45, 0.6, 0.12, "#f7e7ee", "work", "plaster"),
      side(room, "right", "rack-b", -0.05, 0.1, 1.2, 0.5, "#6a243c", "work", "metal"),
      side(room, "right", "counter", room.halfD * 0.3, 0.7, 0.5, 0.4, "#f4efe4", "lounge"),
      back(room, "mirror", 0.7, 1.05, 0.06, "#d7eef6", "decor", "glass"),
    ];
  }
  if (model === "furniture") {
    return [
      ...shared(room, "#e7d3b0", "#f2c14e"),
      side(room, "left", "sofa", 0, 0.9, 0.42, 0.5, "#8d5524", "lounge"),
      side(room, "right", "chair", 0.05, 0.42, 0.46, 0.42, "#5c3c0c", "work"),
      side(room, "right", "lamp", room.halfD * 0.32, 0.16, 0.55, 0.16, "#f6e2a8", "decor", "metal"),
      back(room, "swatches", 1.1, 0.7, 0.08, "#e7ffc4", "work", "paint"),
      poster(room, "swatch-b", -0.4, 1.15, 0, 0.28, 0.28, "#6b4c7a", "back"),
    ];
  }
  if (model === "studio" || model === "home") {
    return [
      ...shared(room, "#c4a574", "#e07a5f"),
      back(room, "bed", 1.15, 0.34, 0.7, "#f4efe4", "lounge", "plaster"),
      side(room, "right", "desk", 0, 0.6, 0.08, 0.42, "#c4a574", "work", "wood", 0.42),
      poster(room, "print", -0.2, 1.35, 0, 0.45, 0.35, "#e07a5f", "back"),
    ];
  }
  if (model === "apartment") {
    return [
      ...shared(room, "#d7c4a3", "#6b4c7a"),
      side(room, "left", "bed", -0.05, 0.9, 0.34, 1.15, "#f4efe4", "lounge", "plaster"),
      back(room, "kitchen", 1.15, 0.75, 0.4, "#efe6d6", "work", "plaster"),
      side(room, "right", "sofa", 0.1, 0.7, 0.38, 0.45, "#6b4c7a", "lounge", "plaster"),
      poster(room, "print", 0.3, 1.4, 0, 0.4, 0.3, "#8ec4ea", "back"),
    ];
  }
  if (model === "houses") {
    return [
      ...shared(room, "#c4a574", "#e07a5f"),
      side(room, "left", "sofa", 0.05, 1.05, 0.36, 0.48, "#6b4c7a", "lounge", "plaster"),
      side(room, "right", "desk", 0, 0.7, 0.08, 0.5, "#8d5524", "work", "wood", 0.42),
      side(room, "right", "chair", room.halfD * 0.28, 0.28, 0.42, 0.28, "#6b4a32", "work"),
      back(room, "dining", 1.15, 0.08, 0.5, "#8d5524", "work", "wood", 0.42),
      poster(room, "art", -room.halfW * 0.15, 1.4, 0, 0.5, 0.4, "#e07a5f", "left"),
    ];
  }
  if (model === "loft") {
    return [
      ...shared(room, "#d5e7f0", "#8ec4ea"),
      side(room, "left", "work-table", 0, 0.9, 0.08, 0.55, "#f7f1e4", "work", "wood", 0.42),
      side(room, "left", "monitor", -0.06, 0.6, 0.4, 0.05, "#d5e7f0", "work", "glass", 0.68),
      side(room, "right", "daybed", 0.05, 1.0, 0.32, 0.5, "#8a4b3c", "lounge", "plaster"),
      back(room, "backdrop", 1.2, 0.85, 0.06, "#f7f1e4", "decor", "paint"),
      poster(room, "still", 0.4, 1.45, 0, 0.36, 0.36, "#e07a5f", "back"),
    ];
  }
  if (model === "mansion") {
    return [
      ...shared(room, "#6b4c7a", "#c6a15a"),
      back(room, "table", 1.7, 0.08, 0.55, "#8d5524", "work", "wood", 0.42),
      side(room, "left", "settee", 0, 1.05, 0.38, 0.48, "#c6a15a", "lounge", "plaster"),
      side(room, "right", "sideboard", 0, 1.0, 0.55, 0.4, "#4e3418", "work"),
      poster(room, "gallery-a", -0.55, 1.5, 0, 0.36, 0.46, "#e07a5f", "back"),
      poster(room, "gallery-b", 0, 1.55, 0, 0.36, 0.5, "#f2c14e", "back"),
      poster(room, "gallery-c", 0.55, 1.5, 0, 0.36, 0.46, "#8ec4ea", "back"),
    ];
  }
  return [
    ...shared(room, "#c4a574", "#f2c14e"),
    side(room, "left", "seat", 0, 0.7, 0.4, 0.45, "#6b4c7a", "lounge", "plaster"),
      side(room, "right", "desk", 0, 0.7, 0.08, 0.45, "#f7f1e4", "work", "wood", 0.42),
    back(room, "board", 1.0, 0.7, 0.08, "#1f3b2d", "work", "paint", 1.2),
  ];
}

/** Props for one room. Furniture stays on the walls. The aisle leads to the marker. */
export function interiorLayout(model: BuildingModel, w: number, d: number): InteriorBox[] {
  const width = Math.max(2.1, w);
  const depth = Math.max(2.2, d);
  return layoutFor(model, roomOf(width, depth));
}

function centerBox(piece: InteriorBox) {
  return { x: piece.x - piece.w / 2, z: piece.z - piece.d / 2, w: piece.w, d: piece.d };
}

function overlaps(a: { x: number; z: number; w: number; d: number }, b: { x: number; z: number; w: number; d: number }) {
  return a.x < b.x + b.w - 0.02 && a.x + a.w - 0.02 > b.x && a.z < b.z + b.d - 0.02 && a.z + a.d - 0.02 > b.z;
}

/** True when work, lounge, and entry props leave the aisle open. */
export function interiorPathClear(pieces: readonly InteriorBox[], w: number, d: number) {
  const aisle = interiorAisle(Math.max(2.1, w), Math.max(2.2, d));
  if (aisle.d < 0.35) return false;
  const walk = { x: aisle.x, z: aisle.z, w: aisle.w, d: aisle.d };
  return pieces.every((piece) => {
    if (piece.marker || piece.glass || piece.zone === "path" || piece.zone === "decor") return true;
    return !overlaps(centerBox(piece), walk);
  });
}
