/**
 * Floor plan for the bot office. One wing per sidebar section, each with an
 * office and a connected manager room, plus HQ, conference, library, break
 * room, the vault, and the hallway that joins them. Edit OFFICE_SECTIONS to move bots.
 */

export type Vec = { x: number; z: number };

export type OfficeSection = {
  name: string;
  manager: string;
  members: string[];
};

export const HQ_BOT_ID = "kash";

export const OFFICE_SECTIONS: OfficeSection[] = [
  {
    name: "Personal",
    manager: "lifemgr",
    members: ["lifemgr", "life", "travel", "finance", "home", "health", "family"],
  },
  {
    name: "Business",
    manager: "bizmgr",
    members: ["bizmgr", "money", "growth", "intake", "outreach", "content", "dm", "ak"],
  },
  {
    name: "Creators",
    manager: "cremgr",
    members: ["cremgr", "mari", "ops"],
  },
];

export type RoomKind = "office" | "manager" | "hall" | "hq" | "conference" | "library" | "break" | "vault";

export type OfficeRoom = {
  id: string;
  label: string;
  kind: RoomKind;
  wing: string | null;
  x: number;
  z: number;
  w: number;
  d: number;
  tint: number;
};

export type OfficeDoor = {
  id: string;
  a: string;
  b: string;
  x: number;
  z: number;
  aPoint: Vec;
  bPoint: Vec;
  /** Wall runs along this axis. The opening is centered on x/z. */
  axis: "x" | "z";
  width: number;
};

export type WallSeg = {
  x: number;
  z: number;
  w: number;
  d: number;
  exterior: boolean;
  /** Vault shell. Taller than the half-height office walls. */
  full?: boolean;
};

export type WindowOpening = {
  x: number;
  z: number;
  width: number;
  axis: "x" | "z";
};

export type OfficeLayout = {
  rooms: OfficeRoom[];
  doors: OfficeDoor[];
  walls: WallSeg[];
  windows: WindowOpening[];
  homes: Record<string, Vec>;
  seats: Vec[];
  librarySpots: Vec[];
  breakSpots: Vec[];
  conferenceTable: { x: number; z: number; w: number; d: number } | null;
  width: number;
  depth: number;
};

const TOP_D = 11;
const HALL_D = 2.8;
const BOT_D = 8.4;
const MGR_W = 4.6;
const WALL_T = 0.18;
const DOOR_W = 1.4;
const WIN_W = 1.7;
const WIN_GAP = 4.4;

export function wingSlug(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function horizontalWall(z: number, x0: number, x1: number, gaps: { at: number; half: number }[], exterior: boolean): WallSeg[] {
  const sorted = gaps.filter((gap) => gap.at > x0 + 0.05 && gap.at < x1 - 0.05).sort((a, b) => a.at - b.at);
  const segs: WallSeg[] = [];
  let x = x0;
  for (const gap of sorted) {
    const gap0 = gap.at - gap.half;
    if (gap0 - x > 0.08) segs.push({ x, z: z - WALL_T / 2, w: gap0 - x, d: WALL_T, exterior });
    x = gap.at + gap.half;
  }
  if (x1 - x > 0.08) segs.push({ x, z: z - WALL_T / 2, w: x1 - x, d: WALL_T, exterior });
  return segs;
}

function verticalWall(x: number, z0: number, z1: number, gaps: { at: number; half: number }[], exterior: boolean): WallSeg[] {
  const sorted = gaps.filter((gap) => gap.at > z0 + 0.05 && gap.at < z1 - 0.05).sort((a, b) => a.at - b.at);
  const segs: WallSeg[] = [];
  let z = z0;
  for (const gap of sorted) {
    const gap0 = gap.at - gap.half;
    if (gap0 - z > 0.08) segs.push({ x: x - WALL_T / 2, z, w: WALL_T, d: gap0 - z, exterior });
    z = gap.at + gap.half;
  }
  if (z1 - z > 0.08) segs.push({ x: x - WALL_T / 2, z, w: WALL_T, d: z1 - z, exterior });
  return segs;
}

/** Split a wall where it crosses the vault so only that room gets the tall steel shell. */
function raiseVaultWalls(walls: WallSeg[], room: OfficeRoom): WallSeg[] {
  const next: WallSeg[] = [];
  for (const wall of walls) {
    const horizontal = wall.w >= wall.d;
    const midX = wall.x + wall.w / 2;
    const midZ = wall.z + wall.d / 2;
    const onNorth = Math.abs(midZ - room.z) < 0.45;
    const onSouth = Math.abs(midZ - (room.z + room.d)) < 0.45;
    const onWest = Math.abs(midX - room.x) < 0.45;
    const onEast = Math.abs(midX - (room.x + room.w)) < 0.45;
    if (horizontal && (onNorth || onSouth) && wall.x < room.x + room.w && wall.x + wall.w > room.x) {
      const cut0 = Math.max(wall.x, room.x);
      const cut1 = Math.min(wall.x + wall.w, room.x + room.w);
      if (cut0 - wall.x > 0.05) next.push({ ...wall, w: cut0 - wall.x });
      if (cut1 - cut0 > 0.05) next.push({ ...wall, x: cut0, w: cut1 - cut0, full: true });
      if (wall.x + wall.w - cut1 > 0.05) next.push({ ...wall, x: cut1, w: wall.x + wall.w - cut1 });
      continue;
    }
    if (!horizontal && (onWest || onEast) && wall.z < room.z + room.d && wall.z + wall.d > room.z) {
      const cut0 = Math.max(wall.z, room.z);
      const cut1 = Math.min(wall.z + wall.d, room.z + room.d);
      if (cut0 - wall.z > 0.05) next.push({ ...wall, d: cut0 - wall.z });
      if (cut1 - cut0 > 0.05) next.push({ ...wall, z: cut0, d: cut1 - cut0, full: true });
      if (wall.z + wall.d - cut1 > 0.05) next.push({ ...wall, z: cut1, d: wall.z + wall.d - cut1 });
      continue;
    }
    next.push(wall);
  }
  return next;
}

/** Opening in the vault's outside wall so the round door can show the room. */
function cutVaultMouth(walls: WallSeg[], room: OfficeRoom, half: number): WallSeg[] {
  const mouth = room.x + room.w / 2;
  const next: WallSeg[] = [];
  for (const wall of walls) {
    const midZ = wall.z + wall.d / 2;
    const onSouth = wall.exterior && Math.abs(midZ - (room.z + room.d)) < 0.45 && wall.w >= wall.d;
    if (!onSouth || wall.x + wall.w <= mouth - half || wall.x >= mouth + half) {
      next.push(wall);
      continue;
    }
    const gap0 = mouth - half;
    const gap1 = mouth + half;
    if (gap0 - wall.x > 0.05) next.push({ ...wall, w: gap0 - wall.x });
    if (wall.x + wall.w - gap1 > 0.05) next.push({ ...wall, x: gap1, w: wall.x + wall.w - gap1 });
  }
  return next;
}

function windowCenters(start: number, end: number) {
  const centers: number[] = [];
  for (let at = start + 1.8; at < end - 1.8; at += WIN_GAP) centers.push(at);
  return centers;
}

export function buildOfficeLayout(options?: {
  sections?: OfficeSection[];
  hqBotId?: string;
  extraBotIds?: string[];
}): OfficeLayout {
  const sections = options?.sections ?? OFFICE_SECTIONS;
  const hqBotId = options?.hqBotId ?? HQ_BOT_ID;
  const rooms: OfficeRoom[] = [];
  const doors: OfficeDoor[] = [];
  const homes: Record<string, Vec> = {};
  const interiorV: { x: number; z0: number; z1: number; gap?: number }[] = [];
  const hallGapsTop: number[] = [];

  let cursor = 0;
  sections.forEach((section, index) => {
    const staff = section.members.filter((id) => id !== section.manager);
    const cols = Math.max(2, Math.ceil(staff.length / 2));
    const margin = 1.2;
    const officeW = Math.max(6.6, cols * 2.7 + margin * 2);
    const wing = wingSlug(section.name);
    const officeId = `office:${wing}`;
    const managerId = `manager:${wing}`;
    rooms.push({
      id: officeId,
      label: `${section.name.toUpperCase()} OFFICE`,
      kind: "office",
      wing: section.name,
      x: cursor,
      z: 0,
      w: officeW,
      d: TOP_D,
      tint: index,
    });
    rooms.push({
      id: managerId,
      label: `${section.name.toUpperCase()} MANAGER`,
      kind: "manager",
      wing: section.name,
      x: cursor + officeW,
      z: 0,
      w: MGR_W,
      d: TOP_D,
      tint: index,
    });
    staff.forEach((id, staffIndex) => {
      const col = Math.floor(staffIndex / 2);
      const row = staffIndex % 2;
      homes[id] = {
        x: cursor + margin + ((col + 0.5) * (officeW - margin * 2)) / cols,
        z: 2.15 + row * 4.35,
      };
    });
    homes[section.manager] = { x: cursor + officeW + MGR_W / 2, z: TOP_D * 0.46 };
    const doorX = cursor + officeW / 2;
    hallGapsTop.push(doorX);
    doors.push({
      id: `${officeId}->hall`,
      a: officeId,
      b: "hall",
      x: doorX,
      z: TOP_D,
      aPoint: { x: doorX, z: TOP_D - 0.75 },
      bPoint: { x: doorX, z: TOP_D + HALL_D / 2 },
      axis: "x",
      width: DOOR_W,
    });
    const linkZ = TOP_D * 0.68;
    doors.push({
      id: `${officeId}->${managerId}`,
      a: officeId,
      b: managerId,
      x: cursor + officeW,
      z: linkZ,
      aPoint: { x: cursor + officeW - 0.75, z: linkZ },
      bPoint: { x: cursor + officeW + 0.75, z: linkZ },
      axis: "z",
      width: DOOR_W,
    });
    interiorV.push({ x: cursor + officeW, z0: 0, z1: TOP_D, gap: linkZ });
    cursor += officeW + MGR_W;
    if (index < sections.length - 1) interiorV.push({ x: cursor, z0: 0, z1: TOP_D });
  });

  const width = cursor;
  const depth = TOP_D + HALL_D + BOT_D;
  const hallZ0 = TOP_D;
  const hallZ1 = TOP_D + HALL_D;
  const botZ = hallZ1;
  rooms.push({
    id: "hall",
    label: "HALLWAY",
    kind: "hall",
    wing: null,
    x: 0,
    z: hallZ0,
    w: width,
    d: HALL_D,
    tint: -1,
  });

  const hqW = 6.4;
  const vaultW = 6.2;
  const confW = Math.max(10, width * 0.28);
  const libW = Math.max(6.4, width * 0.16);
  const breakW = Math.max(5.2, width - hqW - confW - libW - vaultW);
  const used = hqW + confW + libW + breakW + vaultW;
  const scale = width / used;
  const spans = [hqW, confW, libW, breakW, vaultW].map((span) => span * scale);
  const bottom: { id: string; label: string; kind: RoomKind }[] = [
    { id: "hq", label: "MANAGERS / HQ", kind: "hq" },
    { id: "conference", label: "CONFERENCE", kind: "conference" },
    { id: "library", label: "LIBRARY", kind: "library" },
    { id: "break", label: "BREAK ROOM", kind: "break" },
    { id: "vault", label: "BANK", kind: "vault" },
  ];
  let bottomX = 0;
  const hallGapsBot: number[] = [];
  bottom.forEach((room, index) => {
    const w = spans[index] ?? 0;
    rooms.push({
      id: room.id,
      label: room.label,
      kind: room.kind,
      wing: null,
      x: bottomX,
      z: botZ,
      w,
      d: BOT_D,
      tint: -1,
    });
    const doorX = bottomX + w / 2;
    hallGapsBot.push(doorX);
    doors.push({
      id: `hall->${room.id}`,
      a: "hall",
      b: room.id,
      x: doorX,
      z: hallZ1,
      aPoint: { x: doorX, z: hallZ0 + HALL_D / 2 },
      bPoint: { x: doorX, z: hallZ1 + 0.75 },
      axis: "x",
      width: DOOR_W,
    });
    if (index > 0) {
      const gap = index === 1 ? botZ + BOT_D * 0.55 : undefined;
      interiorV.push({ x: bottomX, z0: botZ, z1: depth, gap });
      if (gap !== undefined) {
        doors.push({
          id: "hq->conference",
          a: "hq",
          b: "conference",
          x: bottomX,
          z: gap,
          aPoint: { x: bottomX - 0.75, z: gap },
          bPoint: { x: bottomX + 0.75, z: gap },
          axis: "z",
          width: DOOR_W,
        });
      }
    }
    bottomX += w;
  });

  homes[hqBotId] = { x: (spans[0] ?? hqW) * 0.42, z: botZ + BOT_D * 0.58 };
  const placed = new Set(Object.keys(homes));
  const hqRoom = rooms.find((room) => room.id === "hq");
  (options?.extraBotIds ?? []).forEach((id, index) => {
    if (placed.has(id) || !hqRoom) return;
    const col = index % 3;
    const row = Math.floor(index / 3);
    homes[id] = { x: hqRoom.x + 1.1 + col * 1.5, z: hqRoom.z + 1.4 + row * 1.6 };
    placed.add(id);
  });

  const windows: WindowOpening[] = [];
  const vaultRoom = rooms.find((room) => room.id === "vault");
  const outsideVault = (x: number, z: number) => !vaultRoom || x < vaultRoom.x - 0.2 || x > vaultRoom.x + vaultRoom.w + 0.2 || z < vaultRoom.z - 0.2 || z > vaultRoom.z + vaultRoom.d + 0.2;
  const northWins = windowCenters(0, width).filter((x) => outsideVault(x, 0));
  const southWins = windowCenters(0, width).filter((x) => outsideVault(x, depth));
  const westWins = windowCenters(0, depth).filter((z) => outsideVault(0, z));
  const eastWins = windowCenters(0, depth).filter((z) => outsideVault(width, z));
  northWins.forEach((x) => windows.push({ x, z: 0, width: WIN_W, axis: "x" }));
  southWins.forEach((x) => windows.push({ x, z: depth, width: WIN_W, axis: "x" }));
  westWins.forEach((z) => windows.push({ x: 0, z, width: WIN_W, axis: "z" }));
  eastWins.forEach((z) => windows.push({ x: width, z, width: WIN_W, axis: "z" }));

  let walls: WallSeg[] = [
    ...horizontalWall(0, 0, width, northWins.map((at) => ({ at, half: WIN_W / 2 })), true),
    ...horizontalWall(depth, 0, width, southWins.map((at) => ({ at, half: WIN_W / 2 })), true),
    ...verticalWall(0, 0, depth, westWins.map((at) => ({ at, half: WIN_W / 2 })), true),
    ...verticalWall(width, 0, depth, eastWins.map((at) => ({ at, half: WIN_W / 2 })), true),
    ...horizontalWall(hallZ0, 0, width, hallGapsTop.map((at) => ({ at, half: DOOR_W / 2 })), false),
    ...horizontalWall(hallZ1, 0, width, hallGapsBot.map((at) => ({ at, half: DOOR_W / 2 })), false),
  ];
  interiorV.forEach((wall) => {
    if (wall.x <= 0.01 || wall.x >= width - 0.01) return;
    const gaps = wall.gap === undefined ? [] : [{ at: wall.gap, half: DOOR_W / 2 }];
    walls.push(...verticalWall(wall.x, wall.z0, wall.z1, gaps, false));
  });
  if (vaultRoom) {
    walls = raiseVaultWalls(walls, vaultRoom);
    walls = cutVaultMouth(walls, vaultRoom, 0.78);
  }

  const conference = rooms.find((room) => room.id === "conference");
  const library = rooms.find((room) => room.id === "library");
  const brk = rooms.find((room) => room.id === "break");
  const seats: Vec[] = [];
  let conferenceTable: OfficeLayout["conferenceTable"] = null;
  if (conference) {
    const tableW = Math.max(4.5, conference.w - 2.8);
    const tableD = 2.15;
    const cx = conference.x + conference.w / 2;
    const cz = conference.z + conference.d * 0.52;
    conferenceTable = { x: cx, z: cz, w: tableW, d: tableD };
    const along = Math.max(4, Math.floor(tableW / 1.15));
    for (let i = 0; i < along; i += 1) {
      const x = cx - tableW / 2 + ((i + 0.5) * tableW) / along;
      seats.push({ x, z: cz - tableD / 2 - 0.55 });
      seats.push({ x, z: cz + tableD / 2 + 0.55 });
    }
    seats.push({ x: cx - tableW / 2 - 0.7, z: cz - 0.45 });
    seats.push({ x: cx - tableW / 2 - 0.7, z: cz + 0.45 });
    seats.push({ x: cx + tableW / 2 + 0.7, z: cz - 0.45 });
    seats.push({ x: cx + tableW / 2 + 0.7, z: cz + 0.45 });
  }
  const librarySpots: Vec[] = [];
  if (library) {
    for (let i = 0; i < 4; i += 1) {
      librarySpots.push({ x: library.x + 1.6 + i * 1.35, z: library.z + library.d * 0.48 });
    }
  }
  const breakSpots: Vec[] = [];
  if (brk) {
    for (let i = 0; i < 6; i += 1) {
      breakSpots.push({
        x: brk.x + 1.5 + (i % 3) * ((brk.w - 3) / 3),
        z: brk.z + 1.8 + Math.floor(i / 3) * 2.4,
      });
    }
  }

  return { rooms, doors, walls, windows, homes, seats, librarySpots, breakSpots, conferenceTable, width, depth };
}

export function roomAt(layout: OfficeLayout, point: Vec): OfficeRoom {
  const hall = layout.rooms.find((room) => room.id === "hall");
  if (hall && point.z >= hall.z && point.z < hall.z + hall.d && point.x >= hall.x && point.x < hall.x + hall.w) return hall;
  return layout.rooms.find((room) => (
    room.id !== "hall"
    && point.x >= room.x
    && point.x < room.x + room.w
    && point.z >= room.z
    && point.z < room.z + room.d
  )) ?? hall ?? layout.rooms[0];
}

export function route(layout: OfficeLayout, from: Vec, to: Vec): Vec[] {
  const start = roomAt(layout, from).id;
  const goal = roomAt(layout, to).id;
  if (start === goal) return [to];
  const prev = new Map<string, { via: string; door: OfficeDoor } | null>();
  prev.set(start, null);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift();
    if (!current || current === goal) break;
    for (const door of layout.doors) {
      const next = door.a === current ? door.b : door.b === current ? door.a : "";
      if (next && !prev.has(next)) {
        prev.set(next, { via: current, door });
        queue.push(next);
      }
    }
  }
  if (!prev.has(goal)) return [to];
  const points: Vec[] = [];
  let cursor = goal;
  while (prev.get(cursor)) {
    const step = prev.get(cursor);
    if (!step) break;
    const inCurrent = step.door.a === cursor ? step.door.aPoint : step.door.bPoint;
    const inPrev = step.door.a === cursor ? step.door.bPoint : step.door.aPoint;
    points.unshift(inPrev, inCurrent);
    cursor = step.via;
  }
  points.push(to);
  return points;
}

export function connectedRoomIds(layout: OfficeLayout) {
  const ids = new Set(layout.rooms.map((room) => room.id));
  const seen = new Set<string>(["hall"]);
  const queue = ["hall"];
  while (queue.length) {
    const current = queue.shift();
    if (!current) break;
    for (const door of layout.doors) {
      const next = door.a === current ? door.b : door.b === current ? door.a : "";
      if (next && ids.has(next) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}
