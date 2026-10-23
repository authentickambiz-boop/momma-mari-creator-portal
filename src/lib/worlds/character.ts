/**
 * Versioned look for a Worlds bot. Slots are item ids from a catalog so a
 * later item can be added without a new table. Shop item ids are listed here
 * so a saved look can wear them. This module stores no prices.
 */

import { isOwner } from "@/lib/authz";
import type { Viewer } from "@/lib/types";
import { findOfficeBot, OFFICE_BOTS } from "./office-catalog";

export const CHARACTER_VERSION = 1;
export const CHARACTER_PATH = "/api/worlds/characters";
export const CHARACTER_PAGE = "/worlds/create";

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

/** Shop clothes. They are not in the free starter set. */
export const SHOP_CLOTHING = {
  hair: ["waves"],
  headwear: ["crown"],
  top: ["jacket"],
  bottom: ["overalls"],
  shoes: ["heels"],
  accessory: ["watch"],
} as const;

export function characterSlotChoices(name: CharacterSlotName): readonly string[] {
  return [...CHARACTER_ITEMS[name], ...SHOP_CLOTHING[name]];
}

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
  const item = choiceOf(value.item, characterSlotChoices(name), name);
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

function eyeRadius(style: EyeStyle) {
  if (style === "wide") return 0.07;
  if (style === "sleepy") return 0.055;
  if (style === "star") return 0.05;
  return 0.042;
}

function addHair(parts: CharacterPart[], style: string, color: string, headY: number) {
  if (style === "none") return;
  if (style === "cap" || style === "bob" || style === "long" || style === "waves") {
    parts.push(part({
      id: "hair-cap",
      slot: "hair",
      shape: "sphere",
      args: [0.3, 12, 10],
      position: [0, headY + 0.08, -0.02],
      scale: style === "bob" || style === "long" ? [1.12, 0.72, 1.08] : [1.02, 0.5, 1.02],
      color,
    }));
  }
  if (style === "bob" || style === "long" || style === "waves") {
    parts.push(part({ id: "hair-l", slot: "hair", shape: "box", args: [0.08, style === "long" ? 0.42 : 0.22, 0.16], position: [-0.24, headY - 0.08, 0], color }));
    parts.push(part({ id: "hair-r", slot: "hair", shape: "box", args: [0.08, style === "long" ? 0.42 : 0.22, 0.16], position: [0.24, headY - 0.08, 0], color }));
  }
  if (style === "spikes") {
    for (let i = 0; i < 4; i += 1) {
      const x = -0.12 + (i % 2) * 0.24;
      const z = i < 2 ? 0.02 : -0.08;
      parts.push(part({
        id: `hair-spike-${i}`,
        slot: "hair",
        shape: "cone",
        args: [0.06, 0.16, 5],
        position: [x, headY + 0.28, z],
        color,
      }));
    }
  }
  if (style === "bun") {
    parts.push(part({ id: "hair-bun", slot: "hair", shape: "sphere", args: [0.11, 10, 8], position: [0, headY + 0.32, -0.04], color }));
  }
  if (style === "waves") {
    parts.push(part({ id: "hair-wave", slot: "hair", shape: "torus", args: [0.16, 0.04, 6, 10], position: [0, headY - 0.02, 0.08], rotation: [Math.PI / 2, 0, 0], color }));
  }
}

function addHeadwear(parts: CharacterPart[], style: string, color: string, headY: number) {
  if (style === "none") return;
  if (style === "cap") {
    parts.push(part({ id: "hat-crown", slot: "headwear", shape: "cylinder", args: [0.2, 0.2, 0.12, 10], position: [0, headY + 0.22, 0.02], color }));
    parts.push(part({ id: "hat-brim", slot: "headwear", shape: "box", args: [0.34, 0.03, 0.22], position: [0, headY + 0.16, 0.12], color }));
  } else if (style === "beanie") {
    parts.push(part({ id: "beanie", slot: "headwear", shape: "sphere", args: [0.3, 12, 10], position: [0, headY + 0.16, 0], scale: [1, 0.7, 1], color }));
  } else if (style === "bow") {
    parts.push(part({ id: "bow-l", slot: "headwear", shape: "sphere", args: [0.08, 8, 6], position: [-0.1, headY + 0.26, 0.08], scale: [1.4, 0.7, 0.5], color }));
    parts.push(part({ id: "bow-r", slot: "headwear", shape: "sphere", args: [0.08, 8, 6], position: [0.1, headY + 0.26, 0.08], scale: [1.4, 0.7, 0.5], color }));
    parts.push(part({ id: "bow-knot", slot: "headwear", shape: "box", args: [0.06, 0.06, 0.06], position: [0, headY + 0.26, 0.1], color }));
  } else if (style === "crown") {
    parts.push(part({ id: "crown", slot: "headwear", shape: "cylinder", args: [0.16, 0.16, 0.08, 6], position: [0, headY + 0.28, 0], color }));
    parts.push(part({ id: "crown-tip", slot: "headwear", shape: "cone", args: [0.05, 0.1, 4], position: [0, headY + 0.38, 0], color }));
  } else if (style === "headphones") {
    parts.push(part({ id: "phones-band", slot: "headwear", shape: "torus", args: [0.24, 0.03, 8, 12], position: [0, headY + 0.08, 0], rotation: [Math.PI / 2, 0, 0], color }));
    parts.push(part({ id: "phones-l", slot: "headwear", shape: "sphere", args: [0.08, 8, 8], position: [-0.26, headY, 0], color }));
    parts.push(part({ id: "phones-r", slot: "headwear", shape: "sphere", args: [0.08, 8, 8], position: [0.26, headY, 0], color }));
  }
}

function addClothes(parts: CharacterPart[], config: CharacterConfig, bodyY: number) {
  const top = config.slots.top;
  const bottom = config.slots.bottom;
  const shoes = config.slots.shoes;
  const extra = config.slots.accessory;
  if (top.item === "tee" || top.item === "vest") {
    parts.push(part({ id: "top", slot: "top", shape: "box", args: top.item === "vest" ? [0.34, 0.22, 0.22] : [0.4, 0.28, 0.26], position: [0, bodyY + 0.02, 0.02], color: top.color }));
  } else if (top.item === "hoodie") {
    parts.push(part({ id: "top", slot: "top", shape: "box", args: [0.46, 0.34, 0.3], position: [0, bodyY, 0], color: top.color }));
    parts.push(part({ id: "hood", slot: "top", shape: "sphere", args: [0.22, 10, 8], position: [0, bodyY + 0.28, -0.08], scale: [1.1, 0.7, 0.8], color: top.color }));
  } else if (top.item === "jacket") {
    parts.push(part({ id: "jacket", slot: "top", shape: "box", args: [0.48, 0.36, 0.32], position: [0, bodyY, 0], color: top.color }));
  } else if (top.item === "collar") {
    parts.push(part({ id: "collar", slot: "top", shape: "torus", args: [0.12, 0.03, 6, 10], position: [0, bodyY + 0.22, 0], rotation: [Math.PI / 2, 0, 0], color: top.color }));
  }
  if (bottom.item === "shorts") {
    parts.push(part({ id: "bottom", slot: "bottom", shape: "box", args: [0.34, 0.14, 0.2], position: [0, 0.4, 0], color: bottom.color }));
  } else if (bottom.item === "pants") {
    parts.push(part({ id: "pants-l", slot: "bottom", shape: "box", args: [0.12, 0.28, 0.12], position: [-0.09, 0.32, 0], color: bottom.color }));
    parts.push(part({ id: "pants-r", slot: "bottom", shape: "box", args: [0.12, 0.28, 0.12], position: [0.09, 0.32, 0], color: bottom.color }));
  } else if (bottom.item === "overalls") {
    parts.push(part({ id: "overalls-l", slot: "bottom", shape: "box", args: [0.12, 0.28, 0.12], position: [-0.09, 0.32, 0], color: bottom.color }));
    parts.push(part({ id: "overalls-r", slot: "bottom", shape: "box", args: [0.12, 0.28, 0.12], position: [0.09, 0.32, 0], color: bottom.color }));
    parts.push(part({ id: "overalls-strap", slot: "bottom", shape: "box", args: [0.22, 0.04, 0.04], position: [0, bodyY + 0.16, 0.1], color: bottom.color }));
  } else if (bottom.item === "skirt") {
    parts.push(part({ id: "skirt", slot: "bottom", shape: "cone", args: [0.26, 0.18, 8], position: [0, 0.36, 0], color: bottom.color }));
  }
  if (shoes.item !== "none") {
    const height = shoes.item === "boots" ? 0.12 : shoes.item === "heels" ? 0.14 : shoes.item === "sandals" ? 0.04 : 0.07;
    const width = shoes.item === "heels" ? 0.08 : 0.12;
    parts.push(part({ id: "shoe-l", slot: "shoes", shape: "box", args: [width, height, 0.18], position: [-0.09, height / 2, 0.03], color: shoes.color }));
    parts.push(part({ id: "shoe-r", slot: "shoes", shape: "box", args: [width, height, 0.18], position: [0.09, height / 2, 0.03], color: shoes.color }));
  }
  if (extra.item === "glasses") {
    parts.push(part({ id: "glass-l", slot: "accessory", shape: "torus", args: [0.06, 0.012, 6, 10], position: [-0.09, 0, 0.02], color: extra.color }));
    parts.push(part({ id: "glass-r", slot: "accessory", shape: "torus", args: [0.06, 0.012, 6, 10], position: [0.09, 0, 0.02], color: extra.color }));
  } else if (extra.item === "scarf") {
    parts.push(part({ id: "scarf", slot: "accessory", shape: "torus", args: [0.16, 0.04, 6, 10], position: [0, bodyY + 0.2, 0], rotation: [Math.PI / 2, 0, 0], color: extra.color }));
  } else if (extra.item === "bag") {
    parts.push(part({ id: "bag", slot: "accessory", shape: "box", args: [0.12, 0.16, 0.06], position: [0.32, bodyY - 0.04, 0], color: extra.color }));
  } else if (extra.item === "watch") {
    parts.push(part({ id: "watch", slot: "accessory", shape: "torus", args: [0.05, 0.015, 6, 8], position: [0.3, bodyY + 0.02, 0.04], rotation: [0, Math.PI / 2, 0], color: extra.color }));
  } else if (extra.item === "badge") {
    parts.push(part({ id: "badge", slot: "accessory", shape: "box", args: [0.1, 0.1, 0.02], position: [0.1, bodyY + 0.06, 0.16], color: extra.color }));
  }
}

export function characterFigure(config: CharacterConfig): { scale: number; parts: CharacterPart[] } {
  const shape = config.body.shape;
  const headY = shape === "tall" ? 1.42 : shape === "compact" ? 1.08 : 1.24;
  const bodyY = shape === "tall" ? 0.82 : shape === "compact" ? 0.62 : 0.72;
  const bodyScale: [number, number, number] = shape === "wide"
    ? [1.28, 0.9, 1.12]
    : shape === "tall"
      ? [0.88, 1.25, 0.88]
      : shape === "compact"
        ? [0.82, 0.78, 0.82]
        : [1.05, 0.95, 1.02];
  const skin = config.body.color;
  const parts: CharacterPart[] = [
    part({
      id: "body",
      slot: "body",
      shape: shape === "tall" ? "capsule" : "sphere",
      args: shape === "tall" ? [0.22, 0.42, 4, 8] : [0.34, 14, 12],
      position: [0, bodyY, 0],
      scale: bodyScale,
      color: skin,
    }),
    part({ id: "head", slot: "body", shape: "sphere", args: [0.28, 14, 12], position: [0, headY, 0], color: skin }),
    part({
      id: "arm-l",
      slot: "body",
      shape: "capsule",
      args: [0.045, 0.2, 4, 6],
      position: [-0.3, bodyY + 0.08, 0],
      color: skin,
      animate: "arm-l",
    }),
    part({
      id: "arm-r",
      slot: "body",
      shape: "capsule",
      args: [0.045, 0.2, 4, 6],
      position: [0.3, bodyY + 0.08, 0],
      color: skin,
      animate: "arm-r",
    }),
    part({
      id: "leg-l",
      slot: "body",
      shape: "capsule",
      args: [0.05, 0.16, 4, 6],
      position: [-0.1, 0.4, 0],
      color: skin,
      animate: "leg-l",
    }),
    part({
      id: "leg-r",
      slot: "body",
      shape: "capsule",
      args: [0.05, 0.16, 4, 6],
      position: [0.1, 0.4, 0],
      color: skin,
      animate: "leg-r",
    }),
  ];
  const radius = eyeRadius(config.face.eyes);
  const eyeY = headY + 0.04;
  const eyeShape = config.face.eyes === "star" ? "box" : "sphere";
  const eyeArgs = config.face.eyes === "star" ? [0.07, 0.07, 0.03] : [radius, 8, 8];
  const eyeScale: [number, number, number] = config.face.eyes === "sleepy" ? [1, 0.35, 1] : [1, 1, 1];
  parts.push(part({ id: "eye-l", slot: "face", shape: eyeShape, args: eyeArgs, position: [-0.09, eyeY, 0.22], scale: eyeScale, rotation: config.face.eyes === "star" ? [0, 0, 0.75] : [0, 0, 0], color: "#1c211e" }));
  parts.push(part({ id: "eye-r", slot: "face", shape: eyeShape, args: eyeArgs, position: [0.09, eyeY, 0.22], scale: [...eyeScale], rotation: config.face.eyes === "star" ? [0, 0, 0.75] : [0, 0, 0], color: "#1c211e" }));
  const mouth = config.face.mouth;
  parts.push(part({
    id: "mouth",
    slot: "face",
    shape: mouth === "open" ? "sphere" : mouth === "smile" ? "torus" : "box",
    args: mouth === "open" ? [0.045, 8, 8] : mouth === "smile" ? [0.07, 0.015, 6, 10] : mouth === "grin" ? [0.16, 0.04, 0.03] : [0.12, 0.02, 0.02],
    position: [0, headY - 0.1, 0.24],
    rotation: mouth === "smile" ? [0.5, 0, 0] : [0, 0, 0],
    color: "#8a3b24",
  }));
  const expression = config.face.expression;
  if (expression === "wink") {
    const eye = parts.find((item) => item.id === "eye-r");
    if (eye) eye.scale = [eye.scale[0], 0.2, eye.scale[2]];
  } else if (expression === "surprised") {
    for (const eye of parts.filter((item) => item.id.startsWith("eye-"))) eye.scale = [1.3, 1.3, 1];
    const lips = parts.find((item) => item.id === "mouth");
    if (lips) {
      lips.shape = "sphere";
      lips.args = [0.055, 8, 8];
    }
  } else if (expression === "calm") {
    const lips = parts.find((item) => item.id === "mouth");
    if (lips) {
      lips.shape = "box";
      lips.args = [0.1, 0.018, 0.02];
      lips.rotation = [0, 0, 0];
    }
  } else if (expression === "focused") {
    for (const eye of parts.filter((item) => item.id.startsWith("eye-"))) eye.position = [eye.position[0], eye.position[1], eye.position[2] + 0.03];
  }
  addHair(parts, config.slots.hair.item, config.slots.hair.color, headY);
  addHeadwear(parts, config.slots.headwear.item, config.slots.headwear.color, headY);
  addClothes(parts, config, bodyY);
  if (config.slots.accessory.item === "glasses") {
    for (const glass of parts.filter((item) => item.id.startsWith("glass-"))) {
      glass.position = [glass.position[0], eyeY, 0.26];
    }
  }
  return { scale: sizeScale(config.body.size), parts };
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
