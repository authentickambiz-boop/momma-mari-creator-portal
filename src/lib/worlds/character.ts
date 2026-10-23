/**
 * Versioned look for a Worlds bot. Slots are item ids from a catalog so a
 * later item can be added without a new table. This module stores no prices
 * and does not sell anything.
 */

import { isOwner } from "@/lib/authz";
import type { Viewer } from "@/lib/types";
import { findOfficeBot, OFFICE_BOTS } from "./office-catalog";

export const CHARACTER_VERSION = 1;
export const CHARACTER_PATH = "/api/worlds/characters";
export const CHARACTER_PAGE = "/worlds/create";
/** Bot looks refresh faster than the rest of the office, and each fetch is cache-busted. */
export const LOOKS_POLL_MS = 8_000;

export const BODY_SHAPES = ["round", "tall", "wide", "compact"] as const;
export const BODY_SIZES = ["small", "medium", "large"] as const;
export const EYE_STYLES = ["dot", "wide", "sleepy", "star"] as const;
export const MOUTH_STYLES = ["smile", "open", "flat", "grin"] as const;
export const EXPRESSIONS = ["smile", "calm", "wink", "surprised", "focused"] as const;
export const NAME_TAG_STYLES = ["pill", "banner", "plain"] as const;

export const CHARACTER_ITEMS = {
  hair: ["none", "cap", "bob", "spikes", "bun", "long"],
  headwear: ["none", "cap", "beanie", "bow", "headphones"],
  top: ["none", "tee", "hoodie", "vest", "collar"],
  bottom: ["none", "shorts", "pants", "skirt"],
  shoes: ["none", "sneakers", "boots", "sandals"],
  accessory: ["none", "glasses", "scarf", "bag", "badge"],
} as const;

export const CHARACTER_SLOTS = ["hair", "headwear", "top", "bottom", "shoes", "accessory"] as const;

export const CHARACTER_SWATCHES = [
  "#f3d2b5",
  "#e0b08a",
  "#c68642",
  "#8d5524",
  "#3d2314",
  "#f7f1e4",
  "#1c211e",
  "#2f6d4f",
  "#b4532f",
  "#2f6283",
  "#9a6514",
  "#6b4c7a",
  "#d4567a",
  "#f2c14e",
  "#8ec4ea",
  "#ffffff",
] as const;

export type BodyShape = (typeof BODY_SHAPES)[number];
export type BodySize = (typeof BODY_SIZES)[number];
export type EyeStyle = (typeof EYE_STYLES)[number];
export type MouthStyle = (typeof MOUTH_STYLES)[number];
export type Expression = (typeof EXPRESSIONS)[number];
export type NameTagStyle = (typeof NAME_TAG_STYLES)[number];
export type CharacterSlotName = (typeof CHARACTER_SLOTS)[number];
export type CharacterSubjectKind = "user" | "bot";

export type CharacterSlot = { item: string; color: string };

export type CharacterConfig = {
  version: 1;
  body: { shape: BodyShape; size: BodySize; color: string };
  face: { eyes: EyeStyle; mouth: MouthStyle; expression: Expression };
  slots: Record<CharacterSlotName, CharacterSlot>;
  palette: { primary: string; secondary: string; accent: string };
  nameTag: { style: NameTagStyle; color: string };
};

export type CharacterSubject = { kind: CharacterSubjectKind; id: string };

export type CharacterPart = {
  id: string;
  slot: string;
  shape: "sphere" | "box" | "capsule" | "cylinder" | "torus" | "cone";
  args: number[];
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  animate: "none" | "arm-l" | "arm-r" | "leg-l" | "leg-r";
};

export type CharacterPose = { phase: number; moving: boolean; seated: boolean };

export type CharacterResult<T> = { ok: true; value: T } | { ok: false; error: string };

const SUBJECT_ID = /^[a-zA-Z0-9:_-]{1,80}$/;

export function worldsCharacterAccess(): "owner" | "all" | "off" {
  const raw = (process.env.WORLDS_CHARACTERS ?? "owner").trim().toLowerCase();
  if (raw === "all" || raw === "on" || raw === "creators") return "all";
  if (raw === "off" || raw === "false" || raw === "0") return "off";
  return "owner";
}

/** The creator page. /worlds itself stays owner-only. */
export function canOpenCharacterCreator(viewer: Viewer | null) {
  if (!viewer) return false;
  const access = worldsCharacterAccess();
  if (access === "off") return false;
  if (access === "all") return viewer.role === "admin" || viewer.role === "creator" || viewer.role === "manager";
  return isOwner(viewer);
}

export function characterPromptVisible(viewer: Viewer | null, finished: boolean) {
  return finished && canOpenCharacterCreator(viewer);
}

export function characterSubjectForViewer(viewer: Viewer): CharacterSubject | null {
  if (viewer.role === "admin") return { kind: "user", id: "owner" };
  if (viewer.role === "creator" && viewer.creatorId) return { kind: "user", id: viewer.creatorId };
  if (viewer.role === "manager" && viewer.managerId) return { kind: "user", id: `manager:${viewer.managerId}` };
  return null;
}

export function parseCharacterSubject(kind: unknown, id: unknown): CharacterResult<CharacterSubject> {
  if (kind !== "user" && kind !== "bot") return { ok: false, error: "subjectKind must be user or bot." };
  if (typeof id !== "string" || !SUBJECT_ID.test(id)) return { ok: false, error: "subjectId is not a character id." };
  return { ok: true, value: { kind, id } };
}

/** Signed-in people can read any look. Only that character's owner can write it. */
export function characterAccess(
  viewer: Viewer | null,
  action: "read" | "write",
  subject?: CharacterSubject,
): CharacterResult<CharacterSubject | null> {
  if (!viewer) return { ok: false, error: "Sign in to see a character." };
  if (action === "read") return { ok: true, value: subject ?? null };
  if (!subject) return { ok: false, error: "Choose a character to edit." };
  if (subject.kind === "bot") {
    if (!isOwner(viewer)) return { ok: false, error: "You can only edit your own character." };
    if (!findOfficeBot(subject.id)) return { ok: false, error: "That bot is not on the roster." };
    return { ok: true, value: subject };
  }
  const own = characterSubjectForViewer(viewer);
  if (!own || own.id !== subject.id) return { ok: false, error: "You can only edit your own character." };
  return { ok: true, value: subject };
}

export function characterAccessStatus(error: string) {
  if (error.startsWith("Sign in")) return 401;
  if (error.startsWith("That bot")) return 404;
  if (error.startsWith("You can only")) return 403;
  return 400;
}

function mix(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, values: readonly T[]): T {
  const index = Math.min(values.length - 1, Math.floor(rng() * values.length));
  return values[index] as T;
}

function slot(item: string, color: string): CharacterSlot {
  return { item, color };
}

export function buildCharacter(rng: () => number): CharacterConfig {
  const skin = pick(rng, CHARACTER_SWATCHES.slice(0, 5));
  const primary = pick(rng, CHARACTER_SWATCHES.slice(6));
  const secondary = pick(rng, CHARACTER_SWATCHES.slice(6));
  const accent = pick(rng, CHARACTER_SWATCHES.slice(6));
  return {
    version: 1,
    body: { shape: pick(rng, BODY_SHAPES), size: pick(rng, BODY_SIZES), color: skin },
    face: {
      eyes: pick(rng, EYE_STYLES),
      mouth: pick(rng, MOUTH_STYLES),
      expression: pick(rng, EXPRESSIONS),
    },
    slots: {
      hair: slot(pick(rng, CHARACTER_ITEMS.hair), pick(rng, CHARACTER_SWATCHES)),
      headwear: slot(pick(rng, CHARACTER_ITEMS.headwear), pick(rng, CHARACTER_SWATCHES)),
      top: slot(pick(rng, CHARACTER_ITEMS.top.filter((item) => item !== "none")), primary),
      bottom: slot(pick(rng, CHARACTER_ITEMS.bottom.filter((item) => item !== "none")), secondary),
      shoes: slot(pick(rng, CHARACTER_ITEMS.shoes.filter((item) => item !== "none")), accent),
      accessory: slot(pick(rng, CHARACTER_ITEMS.accessory), accent),
    },
    palette: { primary, secondary, accent },
    nameTag: { style: pick(rng, NAME_TAG_STYLES), color: primary },
  };
}

export function defaultCharacter(seed = "bot"): CharacterConfig {
  return buildCharacter(mix(seed));
}

export function randomCharacter(rng: () => number = Math.random): CharacterConfig {
  return buildCharacter(rng);
}

export function applyPalette(config: CharacterConfig): CharacterConfig {
  return {
    ...config,
    slots: {
      ...config.slots,
      hair: { ...config.slots.hair, color: config.palette.accent },
      top: { ...config.slots.top, color: config.palette.primary },
      bottom: { ...config.slots.bottom, color: config.palette.secondary },
      shoes: { ...config.slots.shoes, color: config.palette.accent },
      accessory: { ...config.slots.accessory, color: config.palette.accent },
    },
    nameTag: { ...config.nameTag, color: config.palette.primary },
  };
}

function fail(error: string): CharacterResult<never> {
  return { ok: false, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(record: Record<string, unknown>, keys: readonly string[]) {
  const got = Object.keys(record);
  return got.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(record, key));
}

function colorOf(value: unknown, label: string): CharacterResult<string> {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) return fail(`${label} must be a #rrggbb color.`);
  return { ok: true, value: value.toLowerCase() };
}

function choiceOf<T extends string>(value: unknown, allowed: readonly T[], label: string): CharacterResult<T> {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return { ok: true, value: value as T };
  return fail(`${label} is not a known choice.`);
}

function parseSlot(value: unknown, name: CharacterSlotName): CharacterResult<CharacterSlot> {
  if (!isRecord(value) || !exactKeys(value, ["item", "color"])) return fail(`${name} needs an item and a color.`);
  const item = choiceOf(value.item, CHARACTER_ITEMS[name], name);
  if (!item.ok) return item;
  const color = colorOf(value.color, name);
  if (!color.ok) return color;
  return { ok: true, value: { item: item.value, color: color.value } };
}

export function parseCharacter(value: unknown): CharacterResult<CharacterConfig> {
  if (!isRecord(value) || !exactKeys(value, ["version", "body", "face", "slots", "palette", "nameTag"])) {
    return fail("A character needs version, body, face, slots, palette, and nameTag.");
  }
  if (value.version !== CHARACTER_VERSION) return fail("That character version is not supported.");
  if (!isRecord(value.body) || !exactKeys(value.body, ["shape", "size", "color"])) return fail("Body needs a shape, size, and color.");
  if (!isRecord(value.face) || !exactKeys(value.face, ["eyes", "mouth", "expression"])) return fail("Face needs eyes, a mouth, and an expression.");
  if (!isRecord(value.slots) || !exactKeys(value.slots, CHARACTER_SLOTS)) return fail("Slots need hair, headwear, top, bottom, shoes, and accessory.");
  if (!isRecord(value.palette) || !exactKeys(value.palette, ["primary", "secondary", "accent"])) return fail("Palette needs primary, secondary, and accent.");
  if (!isRecord(value.nameTag) || !exactKeys(value.nameTag, ["style", "color"])) return fail("Name tag needs a style and a color.");
  const shape = choiceOf(value.body.shape, BODY_SHAPES, "Body shape");
  const size = choiceOf(value.body.size, BODY_SIZES, "Body size");
  const skin = colorOf(value.body.color, "Body color");
  const eyes = choiceOf(value.face.eyes, EYE_STYLES, "Eyes");
  const mouth = choiceOf(value.face.mouth, MOUTH_STYLES, "Mouth");
  const expression = choiceOf(value.face.expression, EXPRESSIONS, "Expression");
  const primary = colorOf(value.palette.primary, "Primary");
  const secondary = colorOf(value.palette.secondary, "Secondary");
  const accent = colorOf(value.palette.accent, "Accent");
  const tagStyle = choiceOf(value.nameTag.style, NAME_TAG_STYLES, "Name tag");
  const tagColor = colorOf(value.nameTag.color, "Name tag color");
  const slots: Partial<Record<CharacterSlotName, CharacterSlot>> = {};
  for (const name of CHARACTER_SLOTS) {
    const parsed = parseSlot(value.slots[name], name);
    if (!parsed.ok) return parsed;
    slots[name] = parsed.value;
  }
  const checks = [shape, size, skin, eyes, mouth, expression, primary, secondary, accent, tagStyle, tagColor];
  for (const check of checks) if (!check.ok) return check;
  if (!shape.ok || !size.ok || !skin.ok || !eyes.ok || !mouth.ok || !expression.ok || !primary.ok || !secondary.ok || !accent.ok || !tagStyle.ok || !tagColor.ok) {
    return fail("That character could not be read.");
  }
  return {
    ok: true,
    value: {
      version: 1,
      body: { shape: shape.value, size: size.value, color: skin.value },
      face: { eyes: eyes.value, mouth: mouth.value, expression: expression.value },
      slots: slots as Record<CharacterSlotName, CharacterSlot>,
      palette: { primary: primary.value, secondary: secondary.value, accent: accent.value },
      nameTag: { style: tagStyle.value, color: tagColor.value },
    },
  };
}

type PartInput = {
  id: string;
  slot: string;
  shape: CharacterPart["shape"];
  args: number[];
  position: [number, number, number];
  color: string;
  rotation?: [number, number, number];
  scale?: [number, number, number];
  animate?: CharacterPart["animate"];
};

function part(input: PartInput): CharacterPart {
  return {
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    animate: "none",
    ...input,
  };
}

function sizeScale(size: BodySize) {
  if (size === "small") return 0.86;
  if (size === "large") return 1.16;
  return 1;
}

function mixColor(hex: string, toward: string, amount: number) {
  const read = (value: string) => [1, 3, 5].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
  const from = read(hex);
  const to = read(toward);
  const mixed = from.map((channel, index) => Math.round(channel + ((to[index] ?? channel) - channel) * amount));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function shadeColor(hex: string) {
  return mixColor(hex, "#1a1614", 0.38);
}

function highlightColor(hex: string) {
  return mixColor(hex, "#ffffff", 0.62);
}

type ChibiLayout = {
  headR: number;
  headY: number;
  body: [number, number, number];
  bodyY: number;
  armX: number;
  legX: number;
  legY: number;
};

/** Oversized head, about half the figure height, on a small body. */
function chibiLayout(shape: BodyShape): ChibiLayout {
  if (shape === "tall") {
    return { headR: 0.4, headY: 1.18, body: [0.4, 0.52, 0.3], bodyY: 0.66, armX: 0.3, legX: 0.11, legY: 0.36 };
  }
  if (shape === "compact") {
    return { headR: 0.34, headY: 0.96, body: [0.42, 0.32, 0.3], bodyY: 0.48, armX: 0.28, legX: 0.11, legY: 0.32 };
  }
  if (shape === "wide") {
    return { headR: 0.4, headY: 1.12, body: [0.64, 0.4, 0.36], bodyY: 0.56, armX: 0.42, legX: 0.16, legY: 0.36 };
  }
  return { headR: 0.4, headY: 1.12, body: [0.46, 0.44, 0.32], bodyY: 0.58, armX: 0.32, legX: 0.12, legY: 0.36 };
}

function eyeRadius(style: EyeStyle, headR: number) {
  if (style === "wide") return headR * 0.28;
  if (style === "sleepy") return headR * 0.24;
  if (style === "star") return headR * 0.22;
  return headR * 0.2;
}

function hairPieces(style: string, color: string, headR: number, headY: number) {
  const back: CharacterPart[] = [];
  const front: CharacterPart[] = [];
  if (style === "none") return { back, front };
  if (style === "spikes") {
    back.push(part({
      id: "hair-back",
      slot: "hair",
      shape: "sphere",
      args: [headR * 0.55, 6, 5],
      position: [0, headY + headR * 0.2, -headR * 0.75],
      scale: [1.15, 0.7, 0.8],
      color,
    }));
    for (let i = 0; i < 4; i += 1) {
      const x = -headR * 0.42 + (i % 2) * headR * 0.84;
      const z = i < 2 ? headR * 0.2 : -headR * 0.05;
      front.push(part({
        id: `hair-front-${i}`,
        slot: "hair",
        shape: "cone",
        args: [headR * 0.16, headR * 0.55, 5],
        position: [x, headY + headR * 0.9, z],
        color,
      }));
    }
    return { back, front };
  }
  if (style === "bun") {
    back.push(part({ id: "hair-back", slot: "hair", shape: "sphere", args: [headR * 0.36, 8, 6], position: [0, headY + headR * 0.98, -headR * 0.15], color }));
  } else if (style === "long") {
    back.push(part({ id: "hair-back", slot: "hair", shape: "box", args: [headR * 1.85, headR * 1.65, headR * 0.34], position: [0, headY - headR * 0.25, -headR * 0.7], color }));
  } else if (style === "bob") {
    back.push(part({
      id: "hair-back",
      slot: "hair",
      shape: "sphere",
      args: [headR * 1.06, 8, 6],
      position: [0, headY + headR * 0.04, -headR * 0.32],
      scale: [1.06, 0.9, 0.7],
      color,
    }));
  } else {
    back.push(part({
      id: "hair-back",
      slot: "hair",
      shape: "sphere",
      args: [headR * 1.02, 8, 6],
      position: [0, headY + headR * 0.22, -headR * 0.16],
      scale: [1.02, 0.52, 0.92],
      color,
    }));
  }
  front.push(part({
    id: "hair-front",
    slot: "hair",
    shape: "box",
    args: [headR * (style === "long" || style === "bob" ? 1.4 : 1.05), headR * 0.26, headR * 0.2],
    position: [0, headY + headR * 0.32, headR * 0.78],
    color,
  }));
  if (style === "bob" || style === "long") {
    const drop = style === "long" ? headR * 0.95 : headR * 0.55;
    front.push(part({ id: "hair-front-l", slot: "hair", shape: "box", args: [headR * 0.28, drop, headR * 0.36], position: [-headR * 0.86, headY - drop * 0.15, headR * 0.05], color }));
    front.push(part({ id: "hair-front-r", slot: "hair", shape: "box", args: [headR * 0.28, drop, headR * 0.36], position: [headR * 0.86, headY - drop * 0.15, headR * 0.05], color }));
  }
  return { back, front };
}

function addHeadwear(parts: CharacterPart[], style: string, color: string, headR: number, headY: number) {
  if (style === "none") return;
  if (style === "cap") {
    parts.push(part({ id: "hat-crown", slot: "headwear", shape: "cylinder", args: [headR * 0.72, headR * 0.72, headR * 0.36, 8], position: [0, headY + headR * 0.78, headR * 0.06], color }));
    parts.push(part({ id: "hat-brim", slot: "headwear", shape: "box", args: [headR * 1.4, headR * 0.08, headR * 0.95], position: [0, headY + headR * 0.58, headR * 0.46], color }));
  } else if (style === "beanie") {
    parts.push(part({ id: "beanie", slot: "headwear", shape: "sphere", args: [headR * 1.05, 8, 6], position: [0, headY + headR * 0.28, 0], scale: [1.02, 0.62, 1], color }));
  } else if (style === "bow") {
    parts.push(part({ id: "bow-l", slot: "headwear", shape: "sphere", args: [headR * 0.22, 8, 6], position: [-headR * 0.28, headY + headR * 0.72, headR * 0.35], scale: [1.4, 0.7, 0.5], color }));
    parts.push(part({ id: "bow-r", slot: "headwear", shape: "sphere", args: [headR * 0.22, 8, 6], position: [headR * 0.28, headY + headR * 0.72, headR * 0.35], scale: [1.4, 0.7, 0.5], color }));
    parts.push(part({ id: "bow-knot", slot: "headwear", shape: "box", args: [headR * 0.16, headR * 0.16, headR * 0.16], position: [0, headY + headR * 0.72, headR * 0.42], color }));
  } else if (style === "headphones") {
    parts.push(part({ id: "phones-band", slot: "headwear", shape: "torus", args: [headR * 0.92, headR * 0.08, 8, 14], position: [0, headY + headR * 0.15, 0], rotation: [Math.PI / 2, 0, 0], color }));
    parts.push(part({ id: "phones-l", slot: "headwear", shape: "sphere", args: [headR * 0.22, 8, 6], position: [-headR * 0.98, headY, 0], color }));
    parts.push(part({ id: "phones-r", slot: "headwear", shape: "sphere", args: [headR * 0.22, 8, 6], position: [headR * 0.98, headY, 0], color }));
  }
}

function addTop(parts: CharacterPart[], item: string, color: string, layout: ChibiLayout) {
  if (item === "none") return;
  const [bodyW, bodyH, bodyD] = layout.body;
  const wrap = (id: string, sx: number, sy: number, sz: number, zPush: number) => {
    parts.push(part({
      id,
      slot: "top",
      shape: "box",
      args: [bodyW * sx, bodyH * sy, bodyD * sz],
      position: [0, layout.bodyY, zPush],
      color,
    }));
  };
  if (item === "tee") wrap("top", 1.22, 0.88, 1.34, 0.05);
  else if (item === "vest") wrap("top", 1.14, 0.66, 1.26, 0.05);
  else   if (item === "hoodie") {
    wrap("top", 1.28, 0.8, 1.36, 0.04);
    parts.push(part({
      id: "hood",
      slot: "top",
      shape: "sphere",
      args: [layout.headR * 1.08, 8, 6],
      position: [0, layout.headY + layout.headR * 0.08, -layout.headR * 0.55],
      scale: [1.12, 0.9, 0.62],
      color,
    }));
  } else if (item === "collar") {
    parts.push(part({
      id: "top",
      slot: "top",
      shape: "torus",
      args: [Math.max(bodyW, bodyD) * 0.42, 0.05, 8, 12],
      position: [0, layout.bodyY + bodyH * 0.42, bodyD * 0.42],
      rotation: [Math.PI / 2, 0, 0],
      color,
    }));
  }
}

function addBottom(parts: CharacterPart[], item: string, color: string, layout: ChibiLayout) {
  if (item === "none") return;
  const [bodyW, bodyH, bodyD] = layout.body;
  const hipY = layout.bodyY - bodyH * 0.36;
  if (item === "shorts") {
    parts.push(part({ id: "bottom", slot: "bottom", shape: "box", args: [bodyW * 1.2, 0.18, bodyD * 1.28], position: [0, hipY, 0.04], color }));
    return;
  }
  if (item === "skirt") {
    parts.push(part({ id: "skirt", slot: "bottom", shape: "cone", args: [bodyW * 0.72, 0.24, 8], position: [0, hipY - 0.04, 0.03], color }));
    return;
  }
  parts.push(part({ id: "bottom", slot: "bottom", shape: "box", args: [bodyW * 1.18, 0.16, bodyD * 1.26], position: [0, hipY, 0.04], color }));
  const legH = 0.34;
  const legY = hipY - 0.04 - legH / 2;
  parts.push(part({ id: "pants-l", slot: "bottom", shape: "box", args: [0.16, legH, 0.18], position: [-layout.legX, legY, 0.03], color }));
  parts.push(part({ id: "pants-r", slot: "bottom", shape: "box", args: [0.16, legH, 0.18], position: [layout.legX, legY, 0.03], color }));
}

function addShoes(parts: CharacterPart[], item: string, color: string, layout: ChibiLayout) {
  if (item === "none") return;
  const height = item === "boots" ? 0.16 : item === "sandals" ? 0.045 : 0.09;
  const depth = item === "boots" ? 0.22 : 0.26;
  parts.push(part({ id: "shoe-l", slot: "shoes", shape: "box", args: [0.18, height, depth], position: [-layout.legX, height / 2, 0.07], color }));
  parts.push(part({ id: "shoe-r", slot: "shoes", shape: "box", args: [0.18, height, depth], position: [layout.legX, height / 2, 0.07], color }));
}

function addAccessory(
  parts: CharacterPart[],
  item: string,
  color: string,
  layout: ChibiLayout,
  eye: { x: number; y: number; z: number; radius: number },
) {
  if (item === "none") return;
  const [bodyW, bodyH, bodyD] = layout.body;
  if (item === "glasses") {
    const ring = eye.radius * 1.15;
    parts.push(part({ id: "glass-l", slot: "accessory", shape: "torus", args: [ring, 0.015, 8, 12], position: [-eye.x, eye.y, eye.z + 0.03], color }));
    parts.push(part({ id: "glass-r", slot: "accessory", shape: "torus", args: [ring, 0.015, 8, 12], position: [eye.x, eye.y, eye.z + 0.03], color }));
    parts.push(part({ id: "glass-bridge", slot: "accessory", shape: "box", args: [eye.x * 0.7, 0.015, 0.015], position: [0, eye.y, eye.z + 0.03], color }));
  } else if (item === "scarf") {
    parts.push(part({
      id: "scarf",
      slot: "accessory",
      shape: "torus",
      args: [Math.max(bodyW, bodyD) * 0.46, 0.055, 8, 12],
      position: [0, layout.bodyY + bodyH * 0.46, bodyD * 0.2],
      rotation: [Math.PI / 2, 0, 0],
      color,
    }));
  } else if (item === "bag") {
    parts.push(part({ id: "bag", slot: "accessory", shape: "box", args: [0.14, 0.2, 0.08], position: [bodyW / 2 + 0.1, layout.bodyY - 0.02, 0.02], color }));
  } else if (item === "badge") {
    parts.push(part({ id: "badge", slot: "accessory", shape: "box", args: [0.12, 0.12, 0.03], position: [bodyW * 0.22, layout.bodyY + bodyH * 0.08, bodyD * 0.85], color }));
  }
}

/**
 * Low-poly chibi. Parts are ordered skin, face, hair back, hair front,
 * headwear, top, bottom, shoes, accessories, then a simple highlight and shade.
 * Clothes are shells larger than the body so a recolor reads at office zoom.
 */
export function characterFigure(config: CharacterConfig): { scale: number; parts: CharacterPart[] } {
  const layout = chibiLayout(config.body.shape);
  const { headR, headY, body, bodyY, armX, legX, legY } = layout;
  const [bodyW, bodyH, bodyD] = body;
  const skin = config.body.color;
  const skinParts: CharacterPart[] = [
    part({ id: "body", slot: "body", shape: "box", args: [bodyW, bodyH, bodyD], position: [0, bodyY, 0], color: skin }),
    part({ id: "head", slot: "body", shape: "sphere", args: [headR, 8, 6], position: [0, headY, 0], color: skin }),
    part({ id: "arm-l", slot: "body", shape: "capsule", args: [0.05, 0.12, 4, 6], position: [-armX, bodyY + bodyH * 0.18, 0], color: skin, animate: "arm-l" }),
    part({ id: "arm-r", slot: "body", shape: "capsule", args: [0.05, 0.12, 4, 6], position: [armX, bodyY + bodyH * 0.18, 0], color: skin, animate: "arm-r" }),
    part({ id: "leg-l", slot: "body", shape: "capsule", args: [0.055, 0.14, 4, 6], position: [-legX, legY, 0], color: skin, animate: "leg-l" }),
    part({ id: "leg-r", slot: "body", shape: "capsule", args: [0.055, 0.14, 4, 6], position: [legX, legY, 0], color: skin, animate: "leg-r" }),
  ];
  const radius = eyeRadius(config.face.eyes, headR);
  const eyeY = headY + headR * 0.04;
  const eyeZ = headR * 0.98;
  const eyeX = headR * 0.34;
  const eyeShape = config.face.eyes === "star" ? "box" : "sphere";
  const eyeArgs = config.face.eyes === "star" ? [radius * 1.7, radius * 1.7, headR * 0.08] : [radius, 8, 6];
  const eyeScale: [number, number, number] = config.face.eyes === "sleepy" ? [1, 0.38, 1] : [1, 1, 1];
  const starSpin: [number, number, number] = config.face.eyes === "star" ? [0, 0, 0.75] : [0, 0, 0];
  const pupilR = radius * 0.58;
  const face: CharacterPart[] = [
    part({ id: "eye-l", slot: "face", shape: eyeShape, args: eyeArgs, position: [-eyeX, eyeY, eyeZ], scale: eyeScale, rotation: starSpin, color: "#f7f4ee" }),
    part({ id: "eye-r", slot: "face", shape: eyeShape, args: eyeArgs, position: [eyeX, eyeY, eyeZ], scale: [...eyeScale], rotation: starSpin, color: "#f7f4ee" }),
    part({ id: "pupil-l", slot: "face", shape: eyeShape, args: config.face.eyes === "star" ? [pupilR, pupilR, headR * 0.05] : [pupilR, 6, 5], position: [-eyeX, eyeY, eyeZ + 0.03], scale: [...eyeScale], rotation: starSpin, color: "#1c211e" }),
    part({ id: "pupil-r", slot: "face", shape: eyeShape, args: config.face.eyes === "star" ? [pupilR, pupilR, headR * 0.05] : [pupilR, 6, 5], position: [eyeX, eyeY, eyeZ + 0.03], scale: [...eyeScale], rotation: starSpin, color: "#1c211e" }),
    part({ id: "catch-l", slot: "face", shape: "sphere", args: [radius * 0.22, 6, 4], position: [-eyeX - radius * 0.28, eyeY + radius * 0.28, eyeZ + 0.05], color: "#ffffff" }),
    part({ id: "catch-r", slot: "face", shape: "sphere", args: [radius * 0.22, 6, 4], position: [eyeX - radius * 0.28, eyeY + radius * 0.28, eyeZ + 0.05], color: "#ffffff" }),
  ];
  const mouth = config.face.mouth;
  face.push(part({
    id: "mouth",
    slot: "face",
    shape: mouth === "open" ? "sphere" : mouth === "smile" ? "torus" : "box",
    args: mouth === "open" ? [headR * 0.12, 8, 6] : mouth === "smile" ? [headR * 0.16, 0.02, 6, 10] : mouth === "grin" ? [headR * 0.42, headR * 0.1, 0.03] : [headR * 0.28, 0.02, 0.02],
    position: [0, headY - headR * 0.34, headR * 0.92],
    rotation: mouth === "smile" ? [0.4, 0, 0] : [0, 0, 0],
    color: "#8a3b24",
  }));
  const expression = config.face.expression;
  if (expression === "wink") {
    for (const eye of face.filter((item) => item.id.endsWith("-r") && item.id !== "catch-r")) eye.scale = [eye.scale[0], 0.16, eye.scale[2]];
    const catchR = face.find((item) => item.id === "catch-r");
    if (catchR) catchR.scale = [1, 0.2, 1];
  } else if (expression === "surprised") {
    for (const eye of face.filter((item) => item.id.startsWith("eye-") || item.id.startsWith("pupil-"))) eye.scale = [1.28, 1.28, 1];
    const lips = face.find((item) => item.id === "mouth");
    if (lips) {
      lips.shape = "sphere";
      lips.args = [headR * 0.16, 8, 6];
    }
  } else if (expression === "calm") {
    const lips = face.find((item) => item.id === "mouth");
    if (lips) {
      lips.shape = "box";
      lips.args = [headR * 0.26, 0.018, 0.02];
      lips.rotation = [0, 0, 0];
    }
  } else if (expression === "focused") {
    for (const eye of face.filter((item) => item.id.startsWith("eye-") || item.id.startsWith("pupil-"))) {
      eye.position = [eye.position[0], eye.position[1], eye.position[2] + 0.03];
    }
  }
  const hair = hairPieces(config.slots.hair.item, config.slots.hair.color, headR, headY);
  const hats: CharacterPart[] = [];
  addHeadwear(hats, config.slots.headwear.item, config.slots.headwear.color, headR, headY);
  const tops: CharacterPart[] = [];
  addTop(tops, config.slots.top.item, config.slots.top.color, layout);
  const bottoms: CharacterPart[] = [];
  addBottom(bottoms, config.slots.bottom.item, config.slots.bottom.color, layout);
  const footwear: CharacterPart[] = [];
  addShoes(footwear, config.slots.shoes.item, config.slots.shoes.color, layout);
  const extras: CharacterPart[] = [];
  addAccessory(extras, config.slots.accessory.item, config.slots.accessory.color, layout, { x: eyeX, y: eyeY, z: eyeZ, radius });
  const light: CharacterPart[] = [
    part({
      id: "highlight",
      slot: "highlight",
      shape: "sphere",
      args: [headR * 0.16, 6, 4],
      position: [-headR * 0.28, headY + headR * 0.48, headR * 0.82],
      color: highlightColor(skin),
    }),
    part({
      id: "shade",
      slot: "shade",
      shape: "sphere",
      args: [headR * 0.14, 6, 4],
      position: [headR * 0.42, headY - headR * 0.08, headR * 0.78],
      color: shadeColor(skin),
    }),
  ];
  const worn = tops[0];
  if (worn && worn.shape === "box") {
    const front = worn.position[2] + worn.args[2] / 2;
    light.push(part({
      id: "top-highlight",
      slot: "highlight",
      shape: "box",
      args: [worn.args[0] * 0.22, worn.args[1] * 0.22, 0.03],
      position: [-worn.args[0] * 0.18, worn.position[1] + worn.args[1] * 0.16, front + 0.02],
      color: highlightColor(config.slots.top.color),
    }));
    light.push(part({
      id: "top-shade",
      slot: "shade",
      shape: "box",
      args: [worn.args[0] * 0.16, worn.args[1] * 0.45, 0.03],
      position: [worn.args[0] * 0.28, worn.position[1] - worn.args[1] * 0.08, front + 0.02],
      color: shadeColor(config.slots.top.color),
    }));
  }
  return {
    scale: sizeScale(config.body.size),
    parts: [...skinParts, ...face, ...hair.back, ...hair.front, ...hats, ...tops, ...bottoms, ...footwear, ...extras, ...light],
  };
}

export function limbRotation(animate: CharacterPart["animate"], pose: CharacterPose): [number, number, number] {
  const swing = pose.moving ? Math.sin(pose.phase) * 0.65 : 0;
  if (animate === "arm-l") return [pose.seated ? 0.4 : -swing, 0, 0];
  if (animate === "arm-r") return [pose.seated ? 0.25 : swing, 0, 0];
  if (animate === "leg-l" || animate === "leg-r") return [pose.seated ? -1.15 : animate === "leg-l" ? swing : -swing, 0, 0];
  return [0, 0, 0];
}

export function nameTagFrame(style: NameTagStyle) {
  if (style === "banner") return { width: 2.1, height: 0.32, radius: 4, filled: true };
  if (style === "plain") return { width: 1.6, height: 0.28, radius: 0, filled: false };
  return { width: 1.45, height: 0.36, radius: 18, filled: true };
}

export function rosterBotIds() {
  return OFFICE_BOTS.map((bot) => bot.id);
}
