/**
 * Data for every Worlds City location. Positions are a ring around the office
 * footprint so the live floor plan stays the center of the map.
 */

import {
  HOME_TIER_FLOORS,
  HOME_TIER_SCALE,
  shopItemsFor,
  type HomeTier,
} from "../economy";
import type { TargetBounds } from "./scene-shell";

export const CITY_LOCATION_IDS = [
  "office",
  "home",
  "social-club",
  "research-lab",
  "library",
  "computer-lab",
  "learning-center",
  "call-center",
  "art-studio",
  "music-studio",
  "bank",
  "clothing-shop",
  "furniture-shop",
] as const;

export type CityLocationId = (typeof CITY_LOCATION_IDS)[number];

export type BuildingModel =
  | "hq"
  | "home"
  | "club"
  | "lab"
  | "library"
  | "computers"
  | "learning"
  | "call-center"
  | "art"
  | "music"
  | "bank"
  | "clothing"
  | "furniture";

export type SkillId =
  | "research"
  | "writing"
  | "outreach"
  | "design"
  | "audio"
  | "data"
  | "hospitality"
  | "finance";

export const SKILL_LABEL: Record<SkillId, string> = {
  research: "brand and market research",
  writing: "content summaries",
  outreach: "outreach call scripts and reviewed DMs",
  design: "thumbnails and graphics",
  audio: "audio snippets",
  data: "data entry and QA",
  hospitality: "hosting",
  finance: "in-game banking",
};

export type CityLocationDef = {
  id: CityLocationId;
  name: string;
  buildingModel: BuildingModel;
  /** Walk-in rooms are a 3D interior. The panel still holds the actions. */
  interior: "panel" | "walk-in";
  taskTypes: readonly string[];
  skills: readonly SkillId[];
  /** Real-world task category this building stands in for. */
  realWorldCategory: string;
  summary: string;
  interiorProps: readonly string[];
  /** The rooms are the existing office scene. This plot is the street-facing HQ. */
  usesOfficeScene?: boolean;
  /** Money movement opens the existing vault bank. */
  reusesBank?: boolean;
};

export const CITY_LOCATIONS: readonly CityLocationDef[] = [
  {
    id: "office",
    name: "Office",
    buildingModel: "hq",
    interior: "panel",
    taskTypes: ["bots", "calendar", "todos", "box", "conference"],
    skills: [],
    realWorldCategory: "office operations",
    summary: "Momma Mari HQ. The live office stays in the middle of the city. Bots, the calendar, to-dos, Box, and the conference table are the same taps as the office.",
    interiorProps: ["HQ desk", "Roster", "Calendar", "To-dos", "Box", "Conference table"],
    usesOfficeScene: true,
  },
  {
    id: "home",
    name: "Personal home",
    buildingModel: "home",
    interior: "walk-in",
    taskTypes: ["rest", "journal", "cook", "host", "idea", "gallery"],
    skills: ["hospitality"],
    realWorldCategory: "home life",
    summary: "Your place in the city. Studio, Apartment, House, Creator loft, and Mansion. Bigger tiers unlock more in-home activities and items. Momma Mari owns the property.",
    interiorProps: ["Bed", "Desk", "Sofa", "Table", "Backdrop", "Gallery wall"],
  },
  {
    id: "social-club",
    name: "Social club",
    buildingModel: "club",
    interior: "panel",
    taskTypes: ["hello", "lounge"],
    skills: ["hospitality"],
    realWorldCategory: "community",
    summary: "A lounge for saying hello. Club visits stay in the city. They are not work for Momma Mari.",
    interiorProps: ["Booth", "Bar", "Stage", "Coat rack"],
  },
  {
    id: "research-lab",
    name: "Research lab",
    buildingModel: "lab",
    interior: "panel",
    taskTypes: ["brand-scan"],
    skills: ["research"],
    realWorldCategory: "brand and market research",
    summary: "Brand and market research. The paid scan unlocks after the learning center lesson.",
    interiorProps: ["Bench", "Samples", "Brief board", "Microscope"],
  },
  {
    id: "library",
    name: "Library",
    buildingModel: "library",
    interior: "panel",
    taskTypes: ["summary"],
    skills: ["writing"],
    realWorldCategory: "content summaries",
    summary: "Content summaries. This is the city library, separate from the office library room.",
    interiorProps: ["Stacks", "Reading table", "Card catalog", "Lamp"],
  },
  {
    id: "computer-lab",
    name: "Computer lab",
    buildingModel: "computers",
    interior: "panel",
    taskTypes: ["data-entry", "qa-check"],
    skills: ["data"],
    realWorldCategory: "data entry and QA",
    summary: "Data entry and QA. Lessons come first, then the paid checks.",
    interiorProps: ["Row of screens", "Keyboard", "QA checklist", "Server rack"],
  },
  {
    id: "learning-center",
    name: "Learning center",
    buildingModel: "learning",
    interior: "walk-in",
    taskTypes: ["lesson", "skill-badge"],
    skills: ["research", "writing", "outreach", "design", "audio", "data"],
    realWorldCategory: "skill lessons",
    summary: "Lessons and skill badges. This is not a school. A lesson teaches the skill before the paid version unlocks.",
    interiorProps: ["Lesson desk", "Badge wall", "Practice booth", "Notebook"],
  },
  {
    id: "call-center",
    name: "Call center",
    buildingModel: "call-center",
    interior: "panel",
    taskTypes: ["call-script", "dm-review"],
    skills: ["outreach"],
    realWorldCategory: "outreach call scripts and reviewed DMs",
    summary: "Outreach call scripts and reviewed DMs. Both are opt-in and say what they earn.",
    interiorProps: ["Headset booth", "Script board", "DM queue", "Coffee"],
  },
  {
    id: "art-studio",
    name: "Art studio",
    buildingModel: "art",
    interior: "panel",
    taskTypes: ["thumbnail"],
    skills: ["design"],
    realWorldCategory: "thumbnails and graphics",
    summary: "Thumbnails and graphics. Describe the frame. Nothing is uploaded.",
    interiorProps: ["Easel", "Drawing table", "Thumbnail wall", "Paint"],
  },
  {
    id: "music-studio",
    name: "Music studio",
    buildingModel: "music",
    interior: "panel",
    taskTypes: ["audio-snippet"],
    skills: ["audio"],
    realWorldCategory: "audio snippets",
    summary: "Audio snippets. Describe a short cue. No file is recorded or sent.",
    interiorProps: ["Booth", "Keys", "Speakers", "Mixer"],
  },
  {
    id: "bank",
    name: "Bank",
    buildingModel: "bank",
    interior: "panel",
    taskTypes: ["visit-bank"],
    skills: ["finance"],
    realWorldCategory: "in-game bank",
    summary: "The same in-game bank as the office vault. Shops spend the wallet. No real payment is sent.",
    interiorProps: ["Teller window", "Vault door", "Ledger", "Interest board"],
    reusesBank: true,
  },
  {
    id: "clothing-shop",
    name: "Clothing shop",
    buildingModel: "clothing",
    interior: "panel",
    taskTypes: ["shop"],
    skills: [],
    realWorldCategory: "clothing",
    summary: "Clothes for the city. Momma Mari owns every item. Kash only. No real payment.",
    interiorProps: ["Rack", "Mirror", "Counter", "Boxes"],
  },
  {
    id: "furniture-shop",
    name: "Furniture shop",
    buildingModel: "furniture",
    interior: "panel",
    taskTypes: ["shop"],
    skills: [],
    realWorldCategory: "furniture",
    summary: "Furniture for the home. Momma Mari owns every item. Kash only. No real payment.",
    interiorProps: ["Floor model", "Swatches", "Counter", "Lamp row"],
  },
];

export type Plot = {
  id: CityLocationId;
  x: number;
  z: number;
  w: number;
  d: number;
  floors: number;
  /** Radians. Door faces local +z before this turn. */
  yaw: number;
  entrance: { x: number; z: number };
  wall: string;
  roof: string;
  accent: string;
};

export type Street = {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  kind: "road" | "walk";
};

export type CityDistrict = {
  plots: Plot[];
  streets: Street[];
  bounds: TargetBounds;
  ground: { x: number; z: number; w: number; d: number };
};

const ROAD = 6.4;
const GAP = 1.6;
const HALF = ROAD / 2;

type Box = { x: number; z: number; w: number; d: number };

export function boxesOverlap(a: Box, b: Box, gap = 0) {
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.z < b.z + b.d + gap && a.z + a.d + gap > b.z;
}

function plot(
  id: CityLocationId,
  x: number,
  z: number,
  w: number,
  d: number,
  yaw: number,
  entrance: { x: number; z: number },
  floors: number,
  wall: string,
  roof: string,
  accent: string,
): Plot {
  return { id, x, z, w, d, yaw, entrance, floors, wall, roof, accent };
}

/**
 * Streets and buildings around the office. The office footprint is left empty
 * so the existing lawn, door, and parking lot stay put.
 */
export function buildCityDistrict(layout: { width: number; depth: number }, tier: HomeTier = "studio"): CityDistrict {
  const width = layout.width;
  const depth = layout.depth;
  const westX = -22;
  const eastX = width + 22;
  const northZ = -20;
  const southZ = depth + 32;
  const spanX = eastX - westX;
  const spanZ = southZ - northZ;

  const streets: Street[] = [
    { id: "road-north", x: westX, z: northZ - HALF, w: spanX, d: ROAD, kind: "road" },
    { id: "road-south", x: westX, z: southZ - HALF, w: spanX, d: ROAD, kind: "road" },
    { id: "road-west", x: westX - HALF, z: northZ, w: ROAD, d: spanZ, kind: "road" },
    { id: "road-east", x: eastX - HALF, z: northZ, w: ROAD, d: spanZ, kind: "road" },
    { id: "walk-north", x: westX, z: northZ - HALF - 1.5, w: spanX, d: 1.4, kind: "walk" },
    { id: "walk-south", x: westX, z: southZ + HALF + 0.1, w: spanX, d: 1.4, kind: "walk" },
    { id: "walk-west", x: westX - HALF - 1.5, z: northZ, w: 1.4, d: spanZ, kind: "walk" },
    { id: "walk-east", x: eastX + HALF + 0.1, z: northZ, w: 1.4, d: spanZ, kind: "walk" },
  ];

  const northIds: CityLocationId[] = ["social-club", "research-lab", "library", "learning-center"];
  const northColors = [
    { wall: "#6b4c7a", roof: "#3d2a48", accent: "#f2c14e" },
    { wall: "#2f6283", roof: "#1d3c50", accent: "#8ec4ea" },
    { wall: "#8d5524", roof: "#4e3418", accent: "#f7f1e4" },
    { wall: "#2f6d4f", roof: "#1c3f2e", accent: "#f2c14e" },
  ];
  const northSlot = spanX / northIds.length;
  const northD = 9;
  const northW = Math.min(12, northSlot - 3);
  const northPlots = northIds.map((id, index) => {
    const color = northColors[index] ?? northColors[0];
    const w = northW;
    const x = westX + northSlot * index + (northSlot - w) / 2;
    const z = northZ - HALF - GAP - northD;
    return plot(id, x, z, w, northD, 0, { x: x + w / 2, z: z + northD + 0.9 }, 2, color.wall, color.roof, color.accent);
  });

  const southIds: CityLocationId[] = ["music-studio", "bank", "furniture-shop"];
  const southColors = [
    { wall: "#b4532f", roof: "#6a3018", accent: "#f2c14e" },
    { wall: "#243044", roof: "#c6a15a", accent: "#f7f1e4" },
    { wall: "#9a6514", roof: "#5c3c0c", accent: "#e7ffc4" },
  ];
  const southSlot = spanX / southIds.length;
  const southD = 9;
  const southW = Math.min(13, southSlot - 3.2);
  const southPlots = southIds.map((id, index) => {
    const color = southColors[index] ?? southColors[0];
    const w = southW;
    const x = westX + southSlot * index + (southSlot - w) / 2;
    const z = southZ + HALF + GAP;
    return plot(id, x, z, w, southD, Math.PI, { x: x + w / 2, z: z - 0.9 }, id === "bank" ? 2 : 1, color.wall, color.roof, color.accent);
  });

  const scale = HOME_TIER_SCALE[tier];
  const homeW = 8.4 * scale;
  const homeD = 7.6 * scale;
  const shopW = 8.2;
  const shopD = 7.2;
  const westInner = westX - HALF - GAP;
  const homeX = westInner - homeW;
  const homeZ = northZ + 4;
  const shopX = westInner - shopW;
  const shopZ = southZ - shopD - 4;
  const westPlots = [
    plot("home", homeX, homeZ, homeW, homeD, Math.PI / 2, { x: homeX + homeW + 0.9, z: homeZ + homeD / 2 }, HOME_TIER_FLOORS[tier], "#c68642", "#6b3a28", "#f7f1e4"),
    plot("clothing-shop", shopX, shopZ, shopW, shopD, Math.PI / 2, { x: shopX + shopW + 0.9, z: shopZ + shopD / 2 }, 1, "#d4567a", "#6a243c", "#f7f1e4"),
  ];

  const eastIds: { id: CityLocationId; wall: string; roof: string; accent: string; floors: number }[] = [
    { id: "computer-lab", wall: "#355e52", roof: "#1c3330", accent: "#9dff6a", floors: 2 },
    { id: "call-center", wall: "#2c3f55", roof: "#182433", accent: "#f2c14e", floors: 2 },
    { id: "art-studio", wall: "#8a4b3c", roof: "#4a241c", accent: "#f2b4c4", floors: 1 },
  ];
  const eastSlot = spanZ / eastIds.length;
  const eastW = 9;
  const eastD = Math.min(10, eastSlot - 3);
  const eastX0 = eastX + HALF + GAP;
  const eastPlots = eastIds.map((item, index) => {
    const d = eastD;
    const z = northZ + eastSlot * index + (eastSlot - d) / 2;
    return plot(item.id, eastX0, z, eastW, d, -Math.PI / 2, { x: eastX0 - 0.9, z: z + d / 2 }, item.floors, item.wall, item.roof, item.accent);
  });

  const hqW = 16;
  const hqD = 6.6;
  const hqX = width / 2 - hqW / 2;
  const hqZ = depth + 21.6;
  const officePlot = plot(
    "office",
    hqX,
    hqZ,
    hqW,
    hqD,
    0,
    { x: hqX + hqW / 2, z: hqZ + hqD + 0.9 },
    1,
    "#c4846a",
    "#4e463f",
    "#1f3b2d",
  );

  const plots = [...northPlots, ...eastPlots, ...southPlots, ...westPlots, officePlot];
  let minX = Math.min(westX - HALF - 8, ...plots.map((item) => item.x));
  let maxX = Math.max(eastX + HALF + 8, ...plots.map((item) => item.x + item.w));
  let minZ = Math.min(northZ - HALF - 8, ...plots.map((item) => item.z));
  let maxZ = Math.max(southZ + HALF + 8, ...plots.map((item) => item.z + item.d));
  const pad = 16;
  minX -= pad;
  maxX += pad;
  minZ -= pad;
  maxZ += pad;
  const bounds: TargetBounds = {
    kind: "city",
    minX,
    maxX,
    minY: 0.4,
    maxY: 3.2,
    minZ,
    maxZ,
  };
  return {
    plots,
    streets,
    bounds,
    ground: { x: minX, z: minZ, w: maxX - minX, d: maxZ - minZ },
  };
}

export type PlacedLocation = CityLocationDef & {
  entrance: { x: number; z: number };
  plot: Plot;
  shop: ReturnType<typeof shopItemsFor>;
};

export function placedLocations(layout: { width: number; depth: number }, tier: HomeTier = "studio"): PlacedLocation[] {
  const district = buildCityDistrict(layout, tier);
  return CITY_LOCATIONS.map((location) => {
    const spot = district.plots.find((item) => item.id === location.id);
    if (!spot) throw new Error(`No plot for ${location.id}`);
    return {
      ...location,
      entrance: spot.entrance,
      plot: spot,
      shop: shopItemsFor(location.id),
    };
  });
}

export function locationById(id: string) {
  return CITY_LOCATIONS.find((item) => item.id === id) ?? null;
}

export function assertKnownLocation(id: string): CityLocationId | null {
  return (CITY_LOCATION_IDS as readonly string[]).includes(id) ? id as CityLocationId : null;
}
