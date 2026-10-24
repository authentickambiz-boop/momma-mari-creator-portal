/** Floor grid and overlap rules for owner decorate mode. Practice only. */

import type { HomeTier } from "../economy";
import { interiorAisle, interiorLayout, type InteriorBox } from "./interiors";
import type { BuildingModel } from "./locations";

export const DECOR_CELL = 0.5;
export const DECOR_CAP = 24;

export const HOUSING_MODELS = ["studio", "apartment", "houses", "loft", "mansion"] as const;
export type HousingModel = (typeof HOUSING_MODELS)[number];

export const DECOR_SKUS = ["sofa", "chair", "table", "plant", "lamp", "art", "rug", "kitchen"] as const;
export type DecorSku = (typeof DECOR_SKUS)[number];

export type DecorTurns = 0 | 1 | 2 | 3;

export type DecorItem = {
  sku: DecorSku;
  label: string;
  /** Mesh family. Art stands on an easel when a player places it. */
  prop: "sofa" | "chair" | "coffee" | "plant" | "floorlamp" | "art" | "rug" | "kitchen";
  cellsX: number;
  cellsZ: number;
  color: string;
  baseW: number;
  baseD: number;
};

export const DECOR_CATALOG: readonly DecorItem[] = [
  { sku: "sofa", label: "Sofa", prop: "sofa", cellsX: 2, cellsZ: 1, color: "#6b4c7a", baseW: 1.14, baseD: 0.62 },
  { sku: "chair", label: "Chair", prop: "chair", cellsX: 1, cellsZ: 1, color: "#6b4a32", baseW: 0.42, baseD: 0.46 },
  { sku: "table", label: "Table", prop: "coffee", cellsX: 2, cellsZ: 1, color: "#c4a574", baseW: 0.8, baseD: 0.42 },
  { sku: "plant", label: "Plant", prop: "plant", cellsX: 1, cellsZ: 1, color: "#2f6d4f", baseW: 0.36, baseD: 0.36 },
  { sku: "lamp", label: "Lamp", prop: "floorlamp", cellsX: 1, cellsZ: 1, color: "#f6e2a8", baseW: 0.32, baseD: 0.32 },
  { sku: "art", label: "Art", prop: "art", cellsX: 1, cellsZ: 1, color: "#e07a5f", baseW: 0.42, baseD: 0.2 },
  { sku: "rug", label: "Rug", prop: "rug", cellsX: 2, cellsZ: 2, color: "#8d5524", baseW: 1, baseD: 1 },
  { sku: "kitchen", label: "Kitchen bit", prop: "kitchen", cellsX: 2, cellsZ: 1, color: "#efe6d6", baseW: 1.15, baseD: 0.48 },
];

export type DecorPlacement = {
  id: string;
  model: HousingModel;
  sku: DecorSku;
  gx: number;
  gz: number;
  turns: DecorTurns;
};

export type DecorGrid = {
  cell: number;
  cols: number;
  rows: number;
  originX: number;
  originZ: number;
};

export type DecorCell = { gx: number; gz: number };

export type DecorMode = {
  gridOn: boolean;
  sku: DecorSku;
  turns: DecorTurns;
  hover: DecorCell | null;
  blocked: { gx: number; gz: number; turns: DecorTurns; sku: DecorSku } | null;
  onHover: (cell: DecorCell | null) => void;
  onCell: (cell: DecorCell) => void;
};

export function housingModelForTier(tier: HomeTier): HousingModel {
  if (tier === "house") return "houses";
  if (tier === "creator-loft") return "loft";
  return tier;
}

export function isHousingModel(model: BuildingModel): model is HousingModel {
  return (HOUSING_MODELS as readonly string[]).includes(model);
}

export function decorItem(sku: DecorSku) {
  return DECOR_CATALOG.find((item) => item.sku === sku) ?? DECOR_CATALOG[0];
}

export function decorGrid(w: number, d: number): DecorGrid {
  const cols = Math.max(1, Math.floor(w / DECOR_CELL));
  const rows = Math.max(1, Math.floor(d / DECOR_CELL));
  return {
    cell: DECOR_CELL,
    cols,
    rows,
    originX: -(cols * DECOR_CELL) / 2,
    originZ: -(rows * DECOR_CELL) / 2,
  };
}

export function cellKey(gx: number, gz: number) {
  return `${gx},${gz}`;
}

export function footprint(item: DecorItem, turns: DecorTurns) {
  const swap = turns % 2 === 1;
  return { dx: swap ? item.cellsZ : item.cellsX, dz: swap ? item.cellsX : item.cellsZ };
}

export function cellsFor(item: DecorItem, gx: number, gz: number, turns: DecorTurns): DecorCell[] {
  const { dx, dz } = footprint(item, turns);
  const cells: DecorCell[] = [];
  for (let x = 0; x < dx; x += 1) {
    for (let z = 0; z < dz; z += 1) cells.push({ gx: gx + x, gz: gz + z });
  }
  return cells;
}

export function snapCell(grid: DecorGrid, x: number, z: number): DecorCell {
  const gx = Math.floor((x - grid.originX) / grid.cell);
  const gz = Math.floor((z - grid.originZ) / grid.cell);
  return {
    gx: Math.max(0, Math.min(grid.cols - 1, gx)),
    gz: Math.max(0, Math.min(grid.rows - 1, gz)),
  };
}

export function cellCenter(grid: DecorGrid, gx: number, gz: number) {
  return {
    x: grid.originX + (gx + 0.5) * grid.cell,
    z: grid.originZ + (gz + 0.5) * grid.cell,
  };
}

export function placementCenter(grid: DecorGrid, item: DecorItem, gx: number, gz: number, turns: DecorTurns) {
  const { dx, dz } = footprint(item, turns);
  return {
    x: grid.originX + gx * grid.cell + (dx * grid.cell) / 2,
    z: grid.originZ + gz * grid.cell + (dz * grid.cell) / 2,
    w: dx * grid.cell,
    d: dz * grid.cell,
  };
}

function cellHitsRect(grid: DecorGrid, gx: number, gz: number, rect: { x: number; z: number; w: number; d: number }) {
  const center = cellCenter(grid, gx, gz);
  return center.x >= rect.x && center.x <= rect.x + rect.w && center.z >= rect.z && center.z <= rect.z + rect.d;
}

/** Cells whose centers sit on the aisle from the door to the objective. */
export function reservedWalkCells(grid: DecorGrid, w: number, d: number) {
  const aisle = interiorAisle(Math.max(2.1, w), Math.max(2.2, d));
  const reserved = new Set<string>();
  for (let gz = 0; gz < grid.rows; gz += 1) {
    for (let gx = 0; gx < grid.cols; gx += 1) {
      if (cellHitsRect(grid, gx, gz, aisle)) reserved.add(cellKey(gx, gz));
    }
  }
  return reserved;
}

/** Cells already taken by built-in furniture. Wall art and rugs do not take a cell. */
export function furnitureCells(grid: DecorGrid, pieces: readonly InteriorBox[]) {
  const taken = new Set<string>();
  for (const piece of pieces) {
    if (piece.marker || piece.glass || piece.zone === "decor" || piece.zone === "path") continue;
    const rect = { x: piece.x - piece.w / 2, z: piece.z - piece.d / 2, w: piece.w, d: piece.d };
    for (let gz = 0; gz < grid.rows; gz += 1) {
      for (let gx = 0; gx < grid.cols; gx += 1) {
        if (cellHitsRect(grid, gx, gz, rect)) taken.add(cellKey(gx, gz));
      }
    }
  }
  return taken;
}

export function placementCells(grid: DecorGrid, placements: readonly DecorPlacement[], model: HousingModel, ignoreId?: string) {
  const taken = new Set<string>();
  for (const placement of placements) {
    if (placement.model !== model || placement.id === ignoreId) continue;
    const item = decorItem(placement.sku);
    for (const cell of cellsFor(item, placement.gx, placement.gz, placement.turns)) {
      if (cell.gx >= 0 && cell.gz >= 0 && cell.gx < grid.cols && cell.gz < grid.rows) taken.add(cellKey(cell.gx, cell.gz));
    }
  }
  return taken;
}

export function evaluatePlacement(
  room: { model: HousingModel; w: number; d: number },
  placements: readonly DecorPlacement[],
  input: { sku: DecorSku; gx: number; gz: number; turns: DecorTurns },
  ignoreId?: string,
): { ok: true } | { ok: false; reason: string } {
  const grid = decorGrid(room.w, room.d);
  const item = decorItem(input.sku);
  const cells = cellsFor(item, input.gx, input.gz, input.turns);
  if (cells.some((cell) => cell.gx < 0 || cell.gz < 0 || cell.gx >= grid.cols || cell.gz >= grid.rows)) {
    return { ok: false, reason: "That sits outside the room." };
  }
  const walk = reservedWalkCells(grid, room.w, room.d);
  if (cells.some((cell) => walk.has(cellKey(cell.gx, cell.gz)))) {
    return { ok: false, reason: "That blocks the walk to the marker." };
  }
  const pieces = interiorLayout(room.model, room.w, room.d);
  const taken = furnitureCells(grid, pieces);
  for (const key of placementCells(grid, placements, room.model, ignoreId)) taken.add(key);
  if (cells.some((cell) => taken.has(cellKey(cell.gx, cell.gz)))) {
    return { ok: false, reason: "That overlaps furniture already here." };
  }
  return { ok: true };
}

/** First free anchor, scanning from the door so a new prop lands in view. */
export function firstOpenCell(
  room: { model: HousingModel; w: number; d: number },
  placements: readonly DecorPlacement[],
  sku: DecorSku,
  turns: DecorTurns,
  ignoreId?: string,
): DecorCell | null {
  const grid = decorGrid(room.w, room.d);
  for (let gz = grid.rows - 1; gz >= 0; gz -= 1) {
    for (let gx = 0; gx < grid.cols; gx += 1) {
      if (evaluatePlacement(room, placements, { sku, gx, gz, turns }, ignoreId).ok) return { gx, gz };
    }
  }
  return null;
}

export function isDecorPlacement(value: unknown): value is DecorPlacement {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DecorPlacement>;
  return typeof item.id === "string"
    && !!item.model
    && (HOUSING_MODELS as readonly string[]).includes(item.model)
    && !!item.sku
    && (DECOR_SKUS as readonly string[]).includes(item.sku)
    && Number.isInteger(item.gx)
    && Number.isInteger(item.gz)
    && (item.turns === 0 || item.turns === 1 || item.turns === 2 || item.turns === 3);
}
