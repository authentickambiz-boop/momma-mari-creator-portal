import { OWNER_ACTOR_ID, route, roomAt, type OfficeLayout, type Vec } from "./office-layout";

/** Yaw 0 faces +Z, toward the default camera south of the building. */
export const SEAT_YAW = 0;

/** +1 puts the desk and monitor on the +Z side of the chair. */
export const DESK_SIDE = 1;

/** Chair, desk, and monitor positions for a home at (x, z). */
export function deskFacing(x: number, z: number) {
  const side = DESK_SIDE;
  const deskZ = z + 0.82 * side;
  return {
    seat: { x, z },
    chairBack: { x, z: z - 0.2 * side },
    desk: { x, z: deskZ },
    monitor: { x, z: deskZ + 0.22 * side },
    screen: { x, z: deskZ + 0.195 * side },
    keyboard: { x: x - 0.05, z: deskZ - 0.12 * side },
    mug: { x: x + 0.42, z: deskZ - 0.08 * side },
    screenYaw: side > 0 ? Math.PI : 0,
  };
}

export type SimPlan = "home" | "away" | "meet";

export type SimBot = {
  id: string;
  x: number;
  z: number;
  yaw: number;
  path: Vec[];
  plan: SimPlan;
  wait: number;
  act: string;
  arrive: string;
  phase: number;
  /** Last room id pushed by the office snapshot. Empty until the first placement. */
  assignedRoom: string;
};

export type SimState = {
  bots: Record<string, SimBot>;
  tripTimer: number;
  meetingKey: string;
  uiVersion: number;
};

export type SimContext = {
  meeting: string[];
  statuses: Record<string, string>;
  names?: Record<string, string>;
  rng: () => number;
};

const SPEED = 2.35;

export function createSimState(layout: OfficeLayout, botIds: string[]): SimState {
  const bots: Record<string, SimBot> = {};
  for (const id of botIds) {
    const home = layout.homes[id] ?? { x: 1, z: 1 };
    bots[id] = {
      id,
      x: home.x,
      z: home.z,
      yaw: SEAT_YAW,
      path: [],
      plan: "home",
      wait: 0,
      act: "",
      arrive: "",
      phase: 0,
      assignedRoom: "",
    };
  }
  return { bots, tripTimer: 3.2, meetingKey: "", uiVersion: 0 };
}

export function isSeated(bot: SimBot, home: Vec | undefined) {
  if (!home || bot.path.length || bot.plan !== "home") return false;
  return Math.hypot(bot.x - home.x, bot.z - home.z) < 0.2;
}

function lerpAngle(current: number, target: number, dt: number) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * Math.min(1, dt * 8);
}

function send(bot: SimBot, layout: OfficeLayout, to: Vec, plan: SimPlan, act: string, arrive: string, wait = 0) {
  bot.path = route(layout, { x: bot.x, z: bot.z }, to);
  bot.plan = plan;
  bot.act = act;
  bot.arrive = arrive;
  bot.wait = wait;
}

function spotIndex(id: string, length: number) {
  const hash = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return length === 0 ? 0 : Math.abs(hash) % length;
}

/** A standing point inside a layout room. Home desks win when the room is that bot's office. */
export function spotForRoom(layout: OfficeLayout, roomId: string, botId: string): Vec | null {
  const room = layout.rooms.find((item) => item.id === roomId);
  if (!room) return null;
  const home = layout.homes[botId];
  if (home && roomAt(layout, home).id === roomId) return { x: home.x, z: home.z };
  const spots = roomId === "break" ? layout.breakSpots : roomId === "library" ? layout.librarySpots : roomId === "conference" ? layout.seats : [];
  const spot = spots[spotIndex(botId, spots.length)];
  if (spot) return { x: spot.x, z: spot.z };
  return { x: room.x + room.w / 2, z: room.z + Math.min(room.d * 0.45, room.d - 0.8) };
}

function stationFor(layout: OfficeLayout, bot: SimBot) {
  if (bot.assignedRoom) return spotForRoom(layout, bot.assignedRoom, bot.id);
  return layout.homes[bot.id] ?? null;
}

/** Drop bots onto the rooms in a snapshot. Used on first load so they do not all walk in from the desks. */
export function placeBotsInRooms(state: SimState, layout: OfficeLayout, rooms: Record<string, string>) {
  for (const bot of Object.values(state.bots)) {
    const roomId = rooms[bot.id];
    if (!roomId) continue;
    const dest = spotForRoom(layout, roomId, bot.id);
    if (!dest) continue;
    bot.x = dest.x;
    bot.z = dest.z;
    bot.path = [];
    bot.plan = "home";
    bot.act = "";
    bot.arrive = "";
    bot.wait = 0;
    bot.assignedRoom = roomId;
  }
}

/** Walk bots whose snapshot room changed. Bots already assigned to that room keep their local trips. */
export function assignBotRooms(state: SimState, layout: OfficeLayout, rooms: Record<string, string>) {
  for (const bot of Object.values(state.bots)) {
    const roomId = rooms[bot.id];
    if (!roomId || bot.assignedRoom === roomId) continue;
    const dest = spotForRoom(layout, roomId, bot.id);
    if (!dest) continue;
    const home = layout.homes[bot.id];
    const homeRoom = home ? roomAt(layout, home).id : "";
    const label = layout.rooms.find((room) => room.id === roomId)?.label.toLowerCase() ?? roomId;
    const goingHome = roomId === homeRoom;
    send(bot, layout, dest, goingHome ? "home" : "away", `Walking to ${label}`, goingHome ? "" : `In ${label}`, goingHome ? 0 : 1e9);
    bot.assignedRoom = roomId;
  }
}

export function stepOfficeSim(state: SimState, layout: OfficeLayout, dt: number, ctx: SimContext) {
  const step = Math.max(0, Math.min(dt, 0.08));
  const meetingKey = ctx.meeting.join("|");
  if (meetingKey !== state.meetingKey) {
    state.meetingKey = meetingKey;
    const ids = Object.keys(state.bots);
    ids.forEach((id, index) => {
      const bot = state.bots[id];
      if (!bot || id === OWNER_ACTOR_ID) return;
      if (ctx.meeting.includes(id)) {
        const seat = layout.seats[index % Math.max(1, layout.seats.length)] ?? layout.seats[0];
        if (seat) send(bot, layout, seat, "meet", "Walking to the conference room", "In the meeting");
      } else if (bot.plan !== "home") {
        const dest = stationFor(layout, bot);
        if (dest) send(bot, layout, dest, "home", "Walking back to desk", "");
      }
    });
  }

  for (const bot of Object.values(state.bots)) {
    if (bot.path.length) {
      const goal = bot.path[0];
      const dx = goal.x - bot.x;
      const dz = goal.z - bot.z;
      const dist = Math.hypot(dx, dz);
      const travel = SPEED * step;
      if (dist <= travel || dist === 0) {
        bot.x = goal.x;
        bot.z = goal.z;
        bot.path.shift();
        if (!bot.path.length) bot.act = bot.arrive;
      } else {
        bot.x += (dx / dist) * travel;
        bot.z += (dz / dist) * travel;
        bot.phase += step * 8;
        bot.yaw = lerpAngle(bot.yaw, Math.atan2(dx, dz), step);
      }
    } else if (bot.plan === "away") {
      bot.wait -= step;
      if (bot.wait <= 0) {
        const dest = stationFor(layout, bot);
        if (dest) send(bot, layout, dest, "home", "Walking back to desk", "");
      }
    } else {
      const home = layout.homes[bot.id];
      if (home && isSeated(bot, home)) bot.yaw = lerpAngle(bot.yaw, SEAT_YAW, step);
    }
  }

  if (!ctx.meeting.length) {
    state.tripTimer -= step;
    if (state.tripTimer <= 0) {
      state.tripTimer = 3.4 + ctx.rng() * 1.6;
      const free = Object.values(state.bots).filter((bot) => bot.id !== OWNER_ACTOR_ID && bot.plan === "home" && !bot.path.length && !ctx.meeting.includes(bot.id));
      if (free.length) {
        const bot = free[Math.floor(ctx.rng() * free.length)] ?? free[0];
        const roll = ctx.rng();
        const working = ctx.statuses[bot.id] === "working";
        if (working && roll < 0.45 && layout.librarySpots.length) {
          const spot = layout.librarySpots[Math.floor(ctx.rng() * layout.librarySpots.length)] ?? layout.librarySpots[0];
          send(bot, layout, spot, "away", "Walking to the research library", "Researching in the library", 8 + ctx.rng() * 8);
        } else if (working && roll < 0.8) {
          const others = Object.values(state.bots).filter((other) => other.id !== bot.id && other.id !== OWNER_ACTOR_ID);
          const other = others[Math.floor(ctx.rng() * others.length)];
          const desk = other ? layout.homes[other.id] : undefined;
          if (other && desk) {
            const name = ctx.names?.[other.id] ?? other.id;
            send(bot, layout, { x: desk.x, z: desk.z + 0.85 }, "away", `Walking to ${name}`, `Handoff at ${name}'s desk`, 6 + ctx.rng() * 6);
          }
        } else if (layout.breakSpots.length) {
          const spot = layout.breakSpots[Math.floor(ctx.rng() * layout.breakSpots.length)] ?? layout.breakSpots[0];
          send(bot, layout, spot, "away", "Walking to the break room", "On a break", 8 + ctx.rng() * 8);
        }
      }
    }
  }
}

export function simActivity(bot: SimBot, layout: OfficeLayout) {
  const room = roomAt(layout, { x: bot.x, z: bot.z });
  return { act: bot.act || "At desk", room: room.label };
}

export type OfficeSimStore = {
  state: SimState;
  subscribe: (listener: () => void) => () => void;
  getVersion: () => number;
  step: (dt: number, ctx: { meeting: string[]; statuses: Record<string, string>; names?: Record<string, string>; rng?: () => number }) => void;
};

export function createOfficeSimStore(layout: OfficeLayout, botIds: string[]): OfficeSimStore {
  const state = createSimState(layout, botIds);
  const listeners = new Set<() => void>();
  let accum = 0;
  return {
    state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getVersion: () => state.uiVersion,
    step(dt, ctx) {
      stepOfficeSim(state, layout, dt, {
        meeting: ctx.meeting,
        statuses: ctx.statuses,
        names: ctx.names,
        rng: ctx.rng ?? Math.random,
      });
      accum += dt;
      if (accum >= 0.25) {
        accum = 0;
        state.uiVersion += 1;
        for (const listener of listeners) listener();
      }
    },
  };
}
