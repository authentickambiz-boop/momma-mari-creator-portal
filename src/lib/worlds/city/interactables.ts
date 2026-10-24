/**
 * One registry for office taps and city buildings.
 * The office meshes still handle their own clicks. City buildings plug in here.
 */

import { boardStations, type OfficeKey } from "../office-state";
import type { OfficeLayout, OfficeSection } from "../office-layout";
import type { CityDistrict, CityLocationId } from "./locations";

export type InteractableKind = "bot" | "calendar" | "todos" | "box" | "conference" | "bank" | "building";

export type CityInteractable = {
  id: string;
  kind: InteractableKind;
  label: string;
  x: number;
  z: number;
  locationId?: CityLocationId;
  /** Where this tap already lives, when the city is reusing the office. */
  reuses?: "office-scene" | "vault-bank";
  office?: OfficeKey;
  panel?: "calendar" | "todos" | "notes";
  botId?: string;
};

export function officeInteractables(
  layout: OfficeLayout,
  sections: OfficeSection[],
  bots: readonly { id: string; name: string }[],
): CityInteractable[] {
  const list: CityInteractable[] = [];
  for (const station of boardStations(layout, sections)) {
    list.push({
      id: `calendar:${station.office}`,
      kind: "calendar",
      label: "Calendar",
      x: station.calendar.x,
      z: station.calendar.z,
      reuses: "office-scene",
      office: station.office,
      panel: "calendar",
    });
    list.push({
      id: `todos:${station.office}`,
      kind: "todos",
      label: "To-dos",
      x: station.whiteboard.x,
      z: station.whiteboard.z,
      reuses: "office-scene",
      office: station.office,
      panel: "todos",
    });
    list.push({
      id: `box:${station.office}`,
      kind: "box",
      label: "Box",
      x: station.inbox.x,
      z: station.inbox.z,
      reuses: "office-scene",
      office: station.office,
      panel: "notes",
    });
  }
  if (layout.conferenceTable) {
    list.push({
      id: "conference",
      kind: "conference",
      label: "Conference table",
      x: layout.conferenceTable.x,
      z: layout.conferenceTable.z,
      reuses: "office-scene",
    });
  }
  const vault = layout.rooms.find((room) => room.id === "vault");
  if (vault) {
    list.push({
      id: "bank",
      kind: "bank",
      label: "Bank",
      x: vault.x + vault.w / 2,
      z: vault.z + vault.d,
      reuses: "vault-bank",
      locationId: "bank",
    });
  }
  for (const bot of bots) {
    const home = layout.homes[bot.id];
    if (!home) continue;
    list.push({
      id: `bot:${bot.id}`,
      kind: "bot",
      label: bot.name,
      x: home.x,
      z: home.z,
      reuses: "office-scene",
      botId: bot.id,
    });
  }
  return list;
}

export function buildingInteractables(district: CityDistrict): CityInteractable[] {
  return district.plots.map((plot) => ({
    id: `building:${plot.id}`,
    kind: "building" as const,
    label: plot.id,
    x: plot.entrance.x,
    z: plot.entrance.z,
    locationId: plot.locationId,
    reuses: plot.locationId === "office" ? "office-scene" as const : plot.locationId === "bank" ? "vault-bank" as const : undefined,
  }));
}

export function worldInteractables(
  layout: OfficeLayout,
  sections: OfficeSection[],
  bots: readonly { id: string; name: string }[],
  district: CityDistrict | null,
) {
  const office = officeInteractables(layout, sections, bots);
  if (!district) return office;
  return [...office, ...buildingInteractables(district)];
}
