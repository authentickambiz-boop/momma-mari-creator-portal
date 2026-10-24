/**
 * Data for every Worlds City location. Positions are a ring around the office
 * footprint so the live floor plan stays the center of the map.
 */

import {
  APARTMENT_MAX_FLOORS,
  HOME_TIER_FLOORS,
  LOT_PRICE_CENTS,
  apartmentFloors,
  shopItemsFor,
  type HomeTier,
} from "../economy";
import { enterRulesFor, type AccessRole, type EnterRule } from "./access";
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
  | "studio"
  | "apartment"
  | "houses"
  | "loft"
  | "mansion"
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
  /** Roles that are not permanently locked out. Skill and ownership still apply. */
  allowedRoles: readonly AccessRole[];
  enterRules: readonly EnterRule[];
};

const CITY_LOCATION_BASE: readonly Omit<CityLocationDef, "allowedRoles" | "enterRules">[] = [
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
    summary: "Your place in the city. Studio row, the apartment complex, house lane, loft block, and mansion grounds each have their own district. Plot size grows with the tier. An apartment is a 1 bed, 1 bath in the shared complex, with no private yard. Momma Mari owns the property.",
    interiorProps: ["Bed", "Desk", "Sofa", "Table", "Backdrop", "Gallery wall"],
  },
  {
    id: "social-club",
    name: "Social club",
    buildingModel: "club",
    interior: "panel",
    taskTypes: ["hello", "like", "comment", "follow", "story-post", "story-reply"],
    skills: ["hospitality"],
    realWorldCategory: "managed creator socials",
    summary: "Practice likes, comments, follows, and story posts or replies for managed creators. Each visit is opt-in and capped per day. Live platform actions stay off. Practice mode scores the draft.",
    interiorProps: ["Booth", "Bar", "Stage", "Coat rack"],
  },
  {
    id: "research-lab",
    name: "Research lab",
    buildingModel: "lab",
    interior: "panel",
    taskTypes: ["brand-scan", "audience", "competitor", "quotes"],
    skills: ["research"],
    realWorldCategory: "brand and market research",
    summary: "Brand and market research. Sample scans, audience questions, competitor notes, and invented quotes. The paid versions unlock after the learning center lesson.",
    interiorProps: ["Bench", "Samples", "Brief board", "Microscope"],
  },
  {
    id: "library",
    name: "Library",
    buildingModel: "library",
    interior: "walk-in",
    taskTypes: ["summary", "test", "read", "story", "rate"],
    skills: ["writing"],
    realWorldCategory: "content summaries",
    summary: "Tests, a reading shelf with hidden tips, short stories, ratings, and content summaries. The room is walk-in. This is the city library, separate from the office library room.",
    interiorProps: ["Stacks", "Reading table", "Card catalog", "Lamp"],
  },
  {
    id: "computer-lab",
    name: "Computer lab",
    buildingModel: "computers",
    interior: "panel",
    taskTypes: ["data-entry", "qa-check", "clip-tags", "sheet-cleanup"],
    skills: ["data"],
    realWorldCategory: "data entry and QA",
    summary: "Data entry, QA, clip tags, and sample sheet cleanup. Lessons come first, then the paid checks.",
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
    interior: "walk-in",
    taskTypes: ["call-script", "dm-review", "email-draft", "script-ideas", "situation-drill"],
    skills: ["outreach"],
    realWorldCategory: "outreach call scripts and reviewed DMs",
    summary: "Call scripts, script ideas, situation drills, reviewed DMs, and outreach email drafts. The room is walk-in. Email stays a draft until Kamron says otherwise. Nothing is auto-sent.",
    interiorProps: ["Headset booth", "Script board", "DM queue", "Coffee"],
  },
  {
    id: "art-studio",
    name: "Art studio",
    buildingModel: "art",
    interior: "walk-in",
    taskTypes: ["thumbnail", "caption", "cover-crop"],
    skills: ["design"],
    realWorldCategory: "thumbnails and graphics",
    summary: "Thumbnails, caption cards, and cover crops. The room is walk-in. Describe the frame. Nothing is uploaded.",
    interiorProps: ["Easel", "Drawing table", "Thumbnail wall", "Paint"],
  },
  {
    id: "music-studio",
    name: "Music studio",
    buildingModel: "music",
    interior: "panel",
    taskTypes: ["audio-snippet", "hook", "bed"],
    skills: ["audio"],
    realWorldCategory: "audio snippets",
    summary: "Audio snippets, hook lines, and bed music notes. Describe the cue. No file is recorded or sent.",
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

export const CITY_LOCATIONS: readonly CityLocationDef[] = CITY_LOCATION_BASE.map((def) => {
  const enterRules = enterRulesFor(def.id);
  const allowedRoles = enterRules.filter((rule) => rule.mode !== "locked").map((rule) => rule.role);
  return { ...def, enterRules, allowedRoles };
});

export type YardKind = "none" | "stoop" | "small" | "studio" | "grounds";

export type Plot = {
  id: string;
  locationId: CityLocationId;
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
  /** Set on a housing district. The home you own is the only one that opens. */
  propertyTier?: HomeTier;
  yard?: YardKind;
  /** Overview label, drawn in world space above the district. */
  district?: string;
  model?: BuildingModel;
};

export type Street = {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  kind: "road" | "walk";
};

/** An empty footprint waiting for a build. Apartments are not lots. */
export type CityLot = {
  id: string;
  number: string;
  tier: Exclude<HomeTier, "apartment">;
  districtId: string;
  x: number;
  z: number;
  w: number;
  d: number;
  yaw: number;
  priceCents: number;
};

export type CityDistrict = {
  plots: Plot[];
  lots: CityLot[];
  streets: Street[];
  bounds: TargetBounds;
  ground: { x: number; z: number; w: number; d: number };
};

const ROAD = 6.4;
const GAP = 1.6;
const HALF = ROAD / 2;

function addRoad(streets: Street[], id: string, x: number, z: number, w: number, d: number) {
  streets.push({ id, x, z, w, d, kind: "road" });
  const alongX = w >= d;
  const span = 1.2;
  if (alongX) {
    streets.push({ id: `${id}-walk-a`, x, z: z - span, w, d: span, kind: "walk" });
    streets.push({ id: `${id}-walk-b`, x, z: z + d, w, d: span, kind: "walk" });
  } else {
    streets.push({ id: `${id}-walk-a`, x: x - span, z, w: span, d, kind: "walk" });
    streets.push({ id: `${id}-walk-b`, x: x + w, z, w: span, d, kind: "walk" });
  }
}

function emptyLot(
  id: string,
  number: string,
  tier: CityLot["tier"],
  districtId: string,
  x: number,
  z: number,
  w: number,
  d: number,
  yaw: number,
): CityLot {
  return { id, number, tier, districtId, x, z, w, d, yaw, priceCents: LOT_PRICE_CENTS[tier] };
}

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
  return { id, locationId: id, x, z, w, d, yaw, entrance, floors, wall, roof, accent };
}

function doorPoint(x: number, z: number, w: number, d: number, yaw: number) {
  const ox = Math.sin(yaw);
  const oz = Math.cos(yaw);
  return {
    x: x + w / 2 + ox * (d / 2 + 0.9),
    z: z + d / 2 + oz * (d / 2 + 0.9),
  };
}

function homeDistrict(
  id: string,
  tier: HomeTier,
  x: number,
  z: number,
  w: number,
  d: number,
  yaw: number,
  floors: number,
  wall: string,
  roof: string,
  accent: string,
  yard: YardKind,
  district: string,
  model: BuildingModel,
): Plot {
  return {
    id,
    locationId: "home",
    x,
    z,
    w,
    d,
    yaw,
    entrance: doorPoint(x, z, w, d, yaw),
    floors,
    wall,
    roof,
    accent,
    propertyTier: tier,
    yard,
    district,
    model,
  };
}

/**
 * Streets and buildings around the office. The office footprint is left empty
 * so the existing lawn, door, and parking lot stay put.
 */
export function buildCityDistrict(
  layout: { width: number; depth: number },
  tier: HomeTier = "studio",
  apartmentUnits = 0,
): CityDistrict {
  void tier;
  const width = layout.width;
  const depth = layout.depth;
  const westX = -22;
  const eastX = width + 22;
  const northZ = -20;
  const southZ = depth + 32;
  const spanX = eastX - westX;
  const spanZ = southZ - northZ;

  const northRoadX = -84.2;
  const ringWest = westX - HALF;
  const ringEast = eastX + HALF;
  const ringNorth = northZ - HALF;
  const ringSouth = southZ + HALF;
  const streets: Street[] = [
    { id: "road-north", x: northRoadX, z: ringNorth, w: ringEast - northRoadX, d: ROAD, kind: "road" },
    { id: "road-south", x: ringWest, z: southZ - HALF, w: ringEast - ringWest, d: ROAD, kind: "road" },
    { id: "road-west", x: ringWest, z: ringNorth, w: ROAD, d: ringSouth - ringNorth, kind: "road" },
    { id: "road-east", x: eastX - HALF, z: ringNorth, w: ROAD, d: ringSouth - ringNorth, kind: "road" },
    { id: "walk-north", x: northRoadX, z: ringNorth - 1.2, w: ringEast - northRoadX, d: 1.2, kind: "walk" },
    { id: "walk-south", x: ringWest, z: southZ + HALF, w: ringEast - ringWest, d: 1.2, kind: "walk" },
    { id: "walk-west", x: ringWest - 1.2, z: ringNorth, w: 1.2, d: ringSouth - ringNorth, kind: "walk" },
    { id: "walk-east", x: eastX + HALF, z: ringNorth, w: 1.2, d: ringSouth - ringNorth, kind: "walk" },
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

  const shopW = 8.2;
  const shopD = 7.2;
  const westInner = westX - HALF - GAP;
  const shopX = westInner - shopW;
  const shopZ = southZ - shopD - 4;
  const westPlots = [
    plot("clothing-shop", shopX, shopZ, shopW, shopD, Math.PI / 2, { x: shopX + shopW + 0.9, z: shopZ + shopD / 2 }, 1, "#d4567a", "#6a243c", "#f7f1e4"),
  ];

  const rowSouth = -58.3;
  const frontRoadZ = rowSouth + 2.3;
  const studioZ = rowSouth - 7.2;
  const apartmentZ = rowSouth - 12;
  const apartmentFloorCount = Math.min(APARTMENT_MAX_FLOORS, apartmentFloors(apartmentUnits));
  addRoad(streets, "road-studio-row", northRoadX, frontRoadZ, 12 - northRoadX, ROAD);
  addRoad(streets, "road-apartment", 8, frontRoadZ, 28, ROAD);
  addRoad(streets, "road-studio-link", northRoadX, frontRoadZ, ROAD, ringNorth + ROAD - frontRoadZ);
  addRoad(streets, "road-mansion", -41.8, -44, ROAD, 84);
  addRoad(streets, "road-house", 84.2, ringNorth, ROAD, 36 - ringNorth);
  addRoad(streets, "road-house-link", eastX + HALF - 1, ringNorth, 84.2 + ROAD - (eastX + HALF - 1), ROAD);
  addRoad(streets, "road-loft", -18, 71.4, 96, ROAD);
  addRoad(streets, "road-loft-link", eastX - HALF, southZ + HALF - 1, ROAD, 71.4 + ROAD - (southZ + HALF - 1));

  const neighborhoods = [
    homeDistrict("studio-row", "studio", -32, studioZ, 18, 7.2, 0, HOME_TIER_FLOORS.studio, "#c68642", "#6b3a28", "#f4efe4", "stoop", "STUDIO ROW", "studio"),
    homeDistrict("apartment-complex", "apartment", 8, apartmentZ, 20, 12, 0, apartmentFloorCount, "#b56a52", "#4e463f", "#f7f1e4", "none", "APARTMENT COMPLEX", "apartment"),
    homeDistrict("house-lane", "house", 93.2, -2, 28, 16, -Math.PI / 2, HOME_TIER_FLOORS.house, "#d7c4a3", "#6b3a28", "#2f6d4f", "small", "HOUSE LANE", "houses"),
    homeDistrict("loft-block", "creator-loft", 6, 80, 34, 16, Math.PI, HOME_TIER_FLOORS["creator-loft"], "#8a4b3c", "#243044", "#d5e7f0", "studio", "LOFT BLOCK", "loft"),
    homeDistrict("mansion-grounds", "mansion", -72, -12, 28, 26, Math.PI / 2, HOME_TIER_FLOORS.mansion, "#d9d3c8", "#4e463f", "#c6a15a", "grounds", "MANSION GROUNDS", "mansion"),
  ];

  const lots: CityLot[] = [
    emptyLot("lot-studio-1", "S-01", "studio", "studio-row", -46.5, studioZ, 6.6, 7.2, 0),
    emptyLot("lot-studio-2", "S-02", "studio", "studio-row", -11.6, studioZ, 6.6, 7.2, 0),
    emptyLot("lot-house-1", "H-01", "house", "house-lane", 95, -22.5, 13, 12, -Math.PI / 2),
    emptyLot("lot-house-2", "H-02", "house", "house-lane", 95, 20, 13, 12, -Math.PI / 2),
    emptyLot("lot-loft-1", "L-01", "creator-loft", "loft-block", -16, 80, 16, 16, Math.PI),
    emptyLot("lot-loft-2", "L-02", "creator-loft", "loft-block", 44, 80, 16, 16, Math.PI),
    emptyLot("lot-mansion-1", "M-01", "mansion", "mansion-grounds", -74, -44, 28, 18.5, Math.PI / 2),
    emptyLot("lot-mansion-2", "M-02", "mansion", "mansion-grounds", -74, 18, 28, 20, Math.PI / 2),
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

  const plots = [...northPlots, ...eastPlots, ...southPlots, ...westPlots, ...neighborhoods, officePlot];
  const boxes = [...plots, ...lots, ...streets];
  let minX = Math.min(...boxes.map((item) => item.x));
  let maxX = Math.max(...boxes.map((item) => item.x + item.w));
  let minZ = Math.min(...boxes.map((item) => item.z));
  let maxZ = Math.max(...boxes.map((item) => item.z + item.d));
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
    lots,
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

export function plotForLocation(plots: readonly Plot[], id: CityLocationId, tier: HomeTier = "studio") {
  if (id === "home") {
    return plots.find((item) => item.propertyTier === tier) ?? plots.find((item) => item.propertyTier === "studio") ?? null;
  }
  return plots.find((item) => item.locationId === id && !item.propertyTier) ?? null;
}

export function placedLocations(layout: { width: number; depth: number }, tier: HomeTier = "studio"): PlacedLocation[] {
  const district = buildCityDistrict(layout, tier);
  return CITY_LOCATIONS.map((location) => {
    const spot = plotForLocation(district.plots, location.id, tier);
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
