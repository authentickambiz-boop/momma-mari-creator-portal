/** Wall-hugging room plans. The center aisle stays open up to the objective. */

import type { BuildingModel } from "./locations";
import { HOUSE_ROW_GAP, STUDIO_ROW_GAP } from "./roofs";

export type InteriorZone = "entry" | "work" | "lounge" | "decor" | "path" | "objective";

export type InteriorFinish = "wood" | "metal" | "stone" | "plaster" | "glass" | "paint";

export type InteriorProp =
  | "plain"
  | "sofa"
  | "desk"
  | "chair"
  | "table"
  | "shelf"
  | "booth"
  | "counter"
  | "vault"
  | "bed"
  | "plant"
  | "art"
  | "window"
  | "lamp"
  | "tv"
  | "kitchen"
  | "books"
  | "queue"
  | "atm"
  | "notes"
  | "coffee"
  | "floorlamp"
  | "bin"
  | "cabinet"
  | "rack";

export type InteriorFace = "left" | "right" | "back";

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
  /** Composed mesh. Plain falls back to one box. */
  prop?: InteriorProp;
  /** Which way the front of the prop points. Left-wall props face into the room. */
  face?: InteriorFace;
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
  prop?: InteriorProp;
  face?: InteriorFace;
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
/**
 * Interior width and depth for one housing unit.
 * `plotW` and `plotD` are the district plot. The shell scales those before this inset.
 */
export function housingInteriorSize(model: BuildingModel, plotW: number, plotD: number) {
  const w = plotW * 0.92;
  const d = plotD * 0.72;
  if (model === "studio") {
    const unit = w / 4 - STUDIO_ROW_GAP;
    return { w: Math.max(2.1, unit - 0.45), d: Math.max(2.2, d * 0.7 - 0.45) };
  }
  if (model === "apartment") return { w: w * 0.86 - 0.7, d: d * 0.78 - 0.7 };
  if (model === "houses") {
    const unit = w / 3 - HOUSE_ROW_GAP;
    return { w: unit - 0.55, d: d * 0.62 - 0.55 };
  }
  if (model === "loft") return { w: w * 0.4 - 0.6, d: d * 0.7 - 0.6 };
  if (model === "mansion") return { w: w * 0.72 - 0.7, d: d * 0.62 - 0.7 };
  return { w: plotW - 0.75, d: plotD - 0.75 };
}

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
  return { finish: "wood", prop: "plain", ...piece };
}

/** A prop against the left or right wall, kept out of the aisle. */
function along(
  room: Room,
  which: "left" | "right",
  id: string,
  z: number,
  wantW: number,
  wantD: number,
  h: number,
  color: string,
  zone: InteriorZone,
  prop: InteriorProp,
  finish: InteriorFinish = "wood",
): InteriorBox {
  const span = Math.max(0.36, room.halfW - room.aisle - 0.22);
  const w = Math.min(wantW, span);
  const depth = Math.min(wantD, Math.max(0.28, room.halfD * 0.7));
  const x = which === "left" ? -room.halfW + 0.18 + w / 2 : room.halfW - 0.18 - w / 2;
  return box({ id, zone, x, y: h / 2, z, w, h, d: depth, color, finish, prop, face: which });
}

/** A prop on the back wall, behind the objective marker. */
function alongBack(
  room: Room,
  id: string,
  wantW: number,
  wantD: number,
  h: number,
  color: string,
  zone: InteriorZone,
  prop: InteriorProp,
  finish: InteriorFinish = "wood",
): InteriorBox {
  const w = Math.min(wantW, room.halfW * 2 - 0.7);
  const depth = Math.min(wantD, 0.72);
  const z = room.objectiveZ - depth * 0.5 - 0.1;
  return box({ id, zone, x: 0, y: h / 2, z, w, h, d: depth, color, finish, prop, face: "back" });
}

function framed(room: Room, id: string, x: number, y: number, z: number, wide: number, tall: number, color: string, face: InteriorFace): InteriorBox {
  if (face === "back") {
    return box({ id, zone: "decor", x, y, z: -room.halfD + 0.14, w: wide, h: tall, d: 0.06, color, finish: "paint", prop: "art", face });
  }
  const edge = face === "left" ? -room.halfW + 0.14 : room.halfW - 0.14;
  return box({ id, zone: "decor", x: edge, y, z, w: 0.06, h: tall, d: wide, color, finish: "paint", prop: "art", face });
}

function windowPane(room: Room, id: string, x: number, z: number, wide: number, tall: number, face: InteriorFace): InteriorBox {
  if (face === "back") {
    return box({
      id, zone: "decor", x, y: 1.42, z: -room.halfD + 0.16, w: wide, h: tall, d: 0.08,
      color: "#d7eef6", finish: "glass", glass: true, prop: "window", face,
    });
  }
  const edge = face === "left" ? -room.halfW + 0.16 : room.halfW - 0.16;
  return box({
    id, zone: "decor", x: edge, y: 1.42, z, w: 0.08, h: tall, d: wide,
    color: "#d7eef6", finish: "glass", glass: true, prop: "window", face,
  });
}

function windows(room: Room): InteriorBox[] {
  const wide = Math.min(0.95, Math.max(0.55, room.halfW * 0.42));
  return [
    windowPane(room, "win-bl", -room.halfW * 0.38, 0, wide, 0.85, "back"),
    windowPane(room, "win-br", room.halfW * 0.38, 0, wide, 0.85, "back"),
    windowPane(room, "win-l", 0, room.halfD * 0.05, wide, 0.85, "left"),
    windowPane(room, "win-r", 0, -room.halfD * 0.12, wide, 0.85, "right"),
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
  return plantAt(room, which, "plant", room.halfD * 0.42);
}

function plantAt(room: Room, which: "left" | "right", id: string, z: number): InteriorBox {
  const x = which === "left" ? -room.halfW + 0.42 : room.halfW - 0.42;
  return box({
    id,
    zone: "entry",
    x,
    y: 0.45,
    z,
    w: 0.36,
    h: 0.85,
    d: 0.36,
    color: "#2f6d4f",
    finish: "plaster",
    prop: "plant",
    face: which,
  });
}

/** A small prop just outside the aisle, in front of the wall furniture. */
function beside(
  room: Room,
  which: "left" | "right",
  id: string,
  z: number,
  wantW: number,
  wantD: number,
  h: number,
  color: string,
  zone: InteriorZone,
  prop: InteriorProp,
  finish: InteriorFinish = "wood",
): InteriorBox {
  const span = Math.max(0.34, room.halfW - room.aisle - 0.4);
  const w = Math.min(wantW, span);
  const depth = Math.min(wantD, 0.5);
  const inner = room.aisle + 0.12;
  const x = which === "left" ? -(inner + w / 2) : inner + w / 2;
  return box({ id, zone, x, y: h / 2, z, w, h, d: depth, color, finish, prop, face: which });
}

function wallMount(
  room: Room,
  id: string,
  x: number,
  y: number,
  z: number,
  wide: number,
  tall: number,
  color: string,
  face: InteriorFace,
  prop: InteriorProp,
): InteriorBox {
  if (face === "back") {
    return box({ id, zone: "decor", x, y, z: -room.halfD + 0.14, w: wide, h: tall, d: 0.08, color, finish: "wood", prop, face });
  }
  const edge = face === "left" ? -room.halfW + 0.14 : room.halfW - 0.14;
  return box({ id, zone: "decor", x: edge, y, z, w: 0.08, h: tall, d: wide, color, finish: "wood", prop, face });
}

function shared(room: Room, path: string, mark: string): InteriorBox[] {
  return [...windows(room), runner(room, path), marker(room, mark), plant(room, "right")];
}

/** A floor cloth under wall furniture. Decor, so it does not count as an obstacle. */
function rug(room: Room, which: "left" | "right", id: string, z: number, wantW: number, wantD: number, color: string): InteriorBox {
  const span = Math.max(0.36, room.halfW - room.aisle - 0.28);
  const w = Math.min(wantW, span);
  const depth = Math.min(wantD, room.halfD * 0.55);
  const x = which === "left" ? -room.halfW + 0.22 + w / 2 : room.halfW - 0.22 - w / 2;
  return box({
    id, zone: "decor", x, y: 0.13, z, w, h: 0.02, d: depth, color, finish: "plaster", unlit: true, prop: "plain", face: which,
  });
}

function layoutFor(model: BuildingModel, room: Room): InteriorBox[] {
  const mid = room.halfD * 0.08;
  if (model === "library") {
    return [
      ...shared(room, "#6b4a32", "#f2c14e"),
      along(room, "left", "stacks", -room.halfD * 0.22, 0.9, 0.42, 1.55, "#6b3a28", "work", "shelf"),
      along(room, "left", "stacks-b", room.halfD * 0.12, 0.78, 0.4, 1.45, "#8d5524", "work", "shelf"),
      along(room, "left", "stacks-c", room.halfD * 0.42, 0.62, 0.38, 1.15, "#4e3418", "work", "shelf"),
      along(room, "right", "reading", -room.halfD * 0.08, 1.05, 0.85, 0.9, "#f7f1e4", "lounge", "desk"),
      along(room, "right", "reader", room.halfD * 0.32, 0.46, 0.46, 0.9, "#6b4c7a", "lounge", "chair", "plaster"),
      along(room, "right", "side-table", room.halfD * 0.14, 0.36, 0.36, 0.55, "#c4a574", "lounge", "books"),
      alongBack(room, "catalog", 1.15, 0.4, 1.45, "#4e3418", "work", "shelf"),
      framed(room, "tips", -0.55, 1.7, 0, 0.62, 0.42, "#1f3b2d", "back"),
      framed(room, "hours", 0.55, 1.65, 0, 0.48, 0.32, "#f2c14e", "back"),
    ];
  }
  if (model === "call-center") {
    return [
      ...shared(room, "#8ec4ea", "#9dff6a"),
      along(room, "left", "booth-a", -room.halfD * 0.18, 1.05, 0.85, 1.15, "#d7e7f2", "work", "booth", "paint"),
      along(room, "left", "booth-c", room.halfD * 0.22, 1.05, 0.85, 1.15, "#c5d7ea", "work", "booth", "paint"),
      along(room, "right", "booth-b", -room.halfD * 0.18, 1.05, 0.85, 1.15, "#d7e7f2", "work", "booth", "paint"),
      along(room, "right", "booth-d", room.halfD * 0.22, 1.05, 0.85, 1.15, "#c5d7ea", "work", "booth", "paint"),
      along(room, "right", "break", room.halfD * 0.02, 0.42, 0.42, 0.85, "#6b4a32", "lounge", "chair"),
      along(room, "left", "notes", room.halfD * 0.46, 0.32, 0.2, 0.7, "#f6e2a8", "decor", "notes", "paint"),
      alongBack(room, "screen", 1.15, 0.16, 0.7, "#1f3b2d", "work", "tv", "paint"),
      framed(room, "script", -0.7, 1.7, 0, 0.42, 0.36, "#f2c14e", "back"),
      framed(room, "board", 0.7, 1.7, 0, 0.42, 0.36, "#8ec4ea", "back"),
    ];
  }
  if (model === "learning") {
    return [
      ...shared(room, "#d7c4a3", "#f2c14e"),
      along(room, "right", "lesson", mid, 1.05, 0.85, 0.9, "#f7f1e4", "work", "desk"),
      along(room, "left", "seat", mid, 0.7, 0.7, 0.85, "#243044", "lounge", "sofa", "plaster"),
      framed(room, "badge", -0.4, 1.55, 0, 0.4, 0.4, "#f2c14e", "back"),
      framed(room, "badge-b", 0.4, 1.55, 0, 0.4, 0.4, "#e07a5f", "back"),
    ];
  }
  if (model === "art") {
    return [
      ...shared(room, "#f4efe4", "#e07a5f"),
      along(room, "left", "easel", mid, 0.7, 0.45, 1.35, "#f2b4c4", "work", "art", "paint"),
      along(room, "right", "drawing", mid, 1.05, 0.85, 0.9, "#f7f1e4", "work", "desk"),
      along(room, "right", "stool", room.halfD * 0.38, 0.4, 0.4, 0.8, "#6b4a32", "lounge", "chair"),
      framed(room, "thumb-b", -0.45, 1.5, 0, 0.38, 0.38, "#8ec4ea", "back"),
      framed(room, "thumb-c", 0.45, 1.5, 0, 0.38, 0.38, "#f2c14e", "back"),
    ];
  }
  if (model === "lab") {
    return [
      ...shared(room, "#d9d3c8", "#8ec4ea"),
      alongBack(room, "bench", 1.4, 0.55, 0.95, "#d9d3c8", "work", "counter", "metal"),
      along(room, "left", "samples", mid, 0.7, 0.4, 1.2, "#8ec4ea", "work", "shelf", "glass"),
      along(room, "right", "scope", mid, 1.0, 0.8, 0.9, "#f7f1e4", "lounge", "desk", "metal"),
      framed(room, "brief", 0, 1.6, 0, 0.6, 0.4, "#1f3b2d", "back"),
    ];
  }
  if (model === "computers") {
    return [
      ...shared(room, "#1c3330", "#9dff6a"),
      along(room, "left", "desk-a", mid, 1.05, 0.85, 0.9, "#1c3330", "work", "desk", "metal"),
      along(room, "right", "desk-b", -room.halfD * 0.05, 1.05, 0.85, 0.9, "#243044", "work", "desk", "metal"),
      along(room, "right", "stool", room.halfD * 0.38, 0.4, 0.4, 0.8, "#6b4a32", "lounge", "chair"),
      alongBack(room, "rack", 0.6, 0.4, 1.4, "#1c3330", "work", "shelf", "metal"),
      framed(room, "qa", 0.55, 1.5, 0, 0.45, 0.36, "#f7f1e4", "back"),
    ];
  }
  if (model === "music") {
    return [
      ...shared(room, "#1c211e", "#f2c14e"),
      alongBack(room, "keys", 1.2, 0.5, 0.9, "#1c211e", "work", "desk"),
      along(room, "left", "booth", mid, 0.7, 0.55, 1.05, "#243044", "lounge", "booth", "paint"),
      along(room, "right", "speaker", mid, 0.45, 0.4, 0.9, "#f2c14e", "work", "shelf", "metal"),
      framed(room, "poster", 0, 1.55, 0, 0.55, 0.4, "#e07a5f", "back"),
    ];
  }
  if (model === "club") {
    return [
      ...shared(room, "#3d2a48", "#f2c14e"),
      alongBack(room, "stage", 1.5, 0.55, 0.4, "#3d2a48", "work", "counter"),
      along(room, "left", "booth-l", mid, 1.05, 0.7, 0.85, "#6b4c7a", "lounge", "sofa", "plaster"),
      along(room, "right", "bar", mid, 1.0, 0.5, 1.05, "#2a2e33", "work", "counter"),
      framed(room, "lights", 0, 1.6, 0, 0.7, 0.32, "#f6e2a8", "back"),
    ];
  }
  if (model === "bank") {
    return [
      ...shared(room, "#c6a15a", "#f2c14e"),
      alongBack(room, "teller", 1.7, 0.55, 1.15, "#243044", "work", "counter", "stone"),
      along(room, "left", "vault", -room.halfD * 0.16, 0.8, 0.28, 1.45, "#2a2e33", "work", "vault", "metal"),
      along(room, "left", "atm", room.halfD * 0.18, 0.55, 0.4, 1.35, "#243044", "work", "atm", "metal"),
      along(room, "right", "ledger", -room.halfD * 0.02, 1.0, 0.8, 0.9, "#f7f1e4", "lounge", "desk"),
      along(room, "right", "queue", room.halfD * 0.32, 0.9, 0.28, 0.9, "#c6a15a", "lounge", "queue", "metal"),
      along(room, "left", "wait", room.halfD * 0.42, 0.42, 0.42, 0.85, "#6b4a32", "lounge", "chair"),
      along(room, "right", "wait-b", room.halfD * 0.18, 0.42, 0.42, 0.85, "#8d5524", "lounge", "chair"),
      framed(room, "rates", -0.55, 1.72, 0, 0.55, 0.34, "#c6a15a", "back"),
      framed(room, "hours", 0.55, 1.68, 0, 0.42, 0.3, "#f7f1e4", "back"),
    ];
  }
  if (model === "clothing") {
    return [
      ...shared(room, "#f7e7ee", "#d4567a"),
      along(room, "left", "rack", mid, 0.8, 0.45, 1.4, "#6a243c", "work", "shelf", "metal"),
      along(room, "right", "counter", room.halfD * 0.2, 1.0, 0.55, 1.0, "#f4efe4", "lounge", "counter"),
      alongBack(room, "mirror", 0.7, 0.12, 1.2, "#d7eef6", "decor", "art", "glass"),
    ];
  }
  if (model === "furniture") {
    return [
      ...shared(room, "#e7d3b0", "#f2c14e"),
      along(room, "left", "sofa", mid, 1.15, 0.7, 0.85, "#8d5524", "lounge", "sofa", "plaster"),
      along(room, "right", "chair", mid, 0.48, 0.48, 0.9, "#5c3c0c", "work", "chair"),
      alongBack(room, "swatches", 1.1, 0.2, 0.8, "#e7ffc4", "work", "art", "paint"),
      framed(room, "swatch-b", -0.55, 1.35, 0, 0.32, 0.32, "#6b4c7a", "back"),
    ];
  }
  if (model === "studio" || model === "home") {
    return [
      ...shared(room, "#c4a574", "#e07a5f"),
      alongBack(room, "bed", 1.15, 0.7, 0.7, "#f4efe4", "lounge", "bed", "plaster"),
      along(room, "right", "desk", mid, 1.0, 0.85, 0.9, "#c4a574", "work", "desk"),
      framed(room, "print", -0.15, 1.45, 0, 0.42, 0.34, "#e07a5f", "back"),
    ];
  }
  if (model === "apartment") {
    return [
      ...shared(room, "#d7c4a3", "#6b4c7a"),
      along(room, "left", "bed", -room.halfD * 0.12, 1.15, 0.72, 0.7, "#f4efe4", "lounge", "bed", "plaster"),
      along(room, "left", "night", room.halfD * 0.22, 0.36, 0.36, 0.7, "#c4a574", "lounge", "lamp"),
      along(room, "left", "wardrobe", -room.halfD * 0.5, 0.7, 0.42, 1.5, "#8d5524", "work", "cabinet"),
      along(room, "left", "floor-lamp", room.halfD * 0.38, 0.3, 0.3, 1.35, "#f6e2a8", "lounge", "floorlamp", "metal"),
      plantAt(room, "left", "fern", room.halfD * 0.58),
      alongBack(room, "kitchen", 1.35, 0.55, 0.95, "#efe6d6", "work", "kitchen", "plaster"),
      along(room, "right", "sofa", -room.halfD * 0.05, 1.1, 0.68, 0.85, "#6b4c7a", "lounge", "sofa", "plaster"),
      beside(room, "right", "coffee", -room.halfD * 0.05, 0.48, 0.4, 0.36, "#c4a574", "lounge", "coffee"),
      along(room, "right", "tv", room.halfD * 0.72, 0.7, 0.4, 0.85, "#2a2e33", "work", "tv", "metal"),
      rug(room, "right", "rug", -room.halfD * 0.05, 1.2, 0.8, "#6b4c7a"),
      wallMount(room, "shelf", 0, 1.55, room.halfD * 0.02, 0.7, 0.28, "#6b4a32", "right", "rack"),
      framed(room, "print", -0.7, 1.5, 0, 0.36, 0.3, "#8ec4ea", "back"),
      framed(room, "print-b", 0, 1.62, 0, 0.32, 0.32, "#e07a5f", "back"),
      framed(room, "print-c", 0.7, 1.48, 0, 0.34, 0.28, "#f2c14e", "back"),
    ];
  }
  if (model === "houses") {
    return [
      ...shared(room, "#c4a574", "#e07a5f"),
      along(room, "left", "sofa", mid, 1.2, 0.7, 0.86, "#6b4c7a", "lounge", "sofa", "plaster"),
      beside(room, "left", "coffee", mid, 0.48, 0.4, 0.36, "#c4a574", "lounge", "coffee"),
      along(room, "left", "lamp", mid + room.halfD * 0.28, 0.34, 0.34, 0.72, "#c4a574", "lounge", "lamp"),
      along(room, "left", "floor-lamp", room.halfD * 0.58, 0.3, 0.3, 1.35, "#f6e2a8", "lounge", "floorlamp", "metal"),
      plantAt(room, "left", "fern", room.halfD * 0.74),
      along(room, "left", "tv", -room.halfD * 0.3, 0.72, 0.4, 0.9, "#2a2e33", "work", "tv", "metal"),
      along(room, "left", "bed", -room.halfD * 0.64, 1.05, 0.7, 0.7, "#f4efe4", "lounge", "bed", "plaster"),
      along(room, "left", "night", -room.halfD * 0.9, 0.32, 0.32, 0.7, "#c4a574", "lounge", "lamp"),
      along(room, "right", "desk", room.halfD * 0.16, 1.05, 0.88, 0.92, "#8d5524", "work", "desk"),
      along(room, "right", "kitchen", -room.halfD * 0.28, 0.9, 0.5, 0.95, "#efe6d6", "work", "kitchen", "plaster"),
      along(room, "right", "bin", -room.halfD * 0.52, 0.28, 0.28, 0.48, "#2a2e33", "work", "bin", "metal"),
      along(room, "right", "cabinet", -room.halfD * 0.78, 0.7, 0.4, 1.5, "#8d5524", "work", "cabinet"),
      alongBack(room, "dining", 1.35, 0.78, 0.78, "#c4a574", "work", "table"),
      rug(room, "left", "rug", mid, 1.25, 0.85, "#8d5524"),
      wallMount(room, "shelf", 0, 1.72, -room.halfD * 0.64, 0.62, 0.26, "#6b4a32", "left", "rack"),
      framed(room, "art", 0, 1.55, -room.halfD * 0.28, 0.42, 0.32, "#e07a5f", "left"),
      framed(room, "art-b", 0, 1.48, room.halfD * 0.4, 0.36, 0.28, "#8ec4ea", "left"),
      framed(room, "art-c", 0, 1.62, 0, 0.46, 0.34, "#f2c14e", "back"),
    ];
  }
  if (model === "loft") {
    return [
      ...shared(room, "#d5e7f0", "#8ec4ea"),
      along(room, "left", "work-table", -room.halfD * 0.05, 1.15, 0.88, 0.92, "#f7f1e4", "work", "desk"),
      along(room, "left", "floor-lamp", room.halfD * 0.16, 0.3, 0.3, 1.35, "#f6e2a8", "lounge", "floorlamp", "metal"),
      along(room, "left", "lamp", room.halfD * 0.28, 0.34, 0.34, 0.72, "#c4a574", "lounge", "lamp"),
      along(room, "left", "books", room.halfD * 0.42, 0.32, 0.28, 0.4, "#e07a5f", "work", "books"),
      along(room, "left", "kitchen", -room.halfD * 0.48, 0.95, 0.5, 0.95, "#efe6d6", "work", "kitchen", "plaster"),
      plantAt(room, "left", "fern", room.halfD * 0.68),
      along(room, "right", "daybed", mid, 1.15, 0.7, 0.7, "#8a4b3c", "lounge", "bed", "plaster"),
      beside(room, "right", "coffee", mid, 0.48, 0.4, 0.36, "#c4a574", "lounge", "coffee"),
      along(room, "right", "tv", room.halfD * 0.64, 0.62, 0.36, 0.8, "#243044", "work", "tv", "metal"),
      along(room, "right", "wardrobe", -room.halfD * 0.48, 0.72, 0.42, 1.5, "#4e3418", "work", "cabinet"),
      rug(room, "right", "rug", mid, 1.2, 0.8, "#8a4b3c"),
      alongBack(room, "dining", 1.35, 0.72, 0.78, "#c4a574", "work", "table"),
      wallMount(room, "shelf", 0, 1.7, mid, 0.7, 0.26, "#6b4a32", "right", "rack"),
      framed(room, "still", -1.15, 1.55, 0, 0.36, 0.36, "#e07a5f", "back"),
      framed(room, "still-b", -0.45, 1.62, 0, 0.32, 0.4, "#8ec4ea", "back"),
      framed(room, "still-c", 0.45, 1.58, 0, 0.34, 0.32, "#f2c14e", "back"),
      framed(room, "still-d", 1.15, 1.5, 0, 0.3, 0.36, "#6b4c7a", "back"),
    ];
  }
  if (model === "mansion") {
    return [
      ...shared(room, "#6b4c7a", "#c6a15a"),
      alongBack(room, "table", 1.6, 0.78, 0.78, "#8d5524", "work", "table"),
      along(room, "left", "settee", mid, 1.2, 0.7, 0.86, "#c6a15a", "lounge", "sofa", "plaster"),
      beside(room, "left", "coffee", mid, 0.48, 0.4, 0.36, "#c4a574", "lounge", "coffee"),
      along(room, "left", "floor-lamp", room.halfD * 0.42, 0.3, 0.3, 1.35, "#f6e2a8", "lounge", "floorlamp", "metal"),
      plantAt(room, "left", "fern", room.halfD * 0.62),
      rug(room, "left", "rug", mid, 1.3, 0.9, "#6b4c7a"),
      along(room, "right", "sideboard", mid, 1.05, 0.45, 0.9, "#4e3418", "work", "counter"),
      framed(room, "gallery-a", -0.55, 1.55, 0, 0.36, 0.46, "#e07a5f", "back"),
      framed(room, "gallery-b", 0, 1.6, 0, 0.36, 0.5, "#f2c14e", "back"),
      framed(room, "gallery-c", 0.55, 1.55, 0, 0.36, 0.46, "#8ec4ea", "back"),
    ];
  }
  return [
    ...shared(room, "#c4a574", "#f2c14e"),
    along(room, "left", "seat", mid, 0.9, 0.65, 0.85, "#6b4c7a", "lounge", "sofa", "plaster"),
    along(room, "right", "desk", mid, 1.0, 0.85, 0.9, "#f7f1e4", "work", "desk"),
    framed(room, "board", 0, 1.5, 0, 0.7, 0.45, "#1f3b2d", "back"),
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
