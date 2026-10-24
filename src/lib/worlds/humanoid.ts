/**
 * Rigged humanoid for Worlds. The mesh, skeleton, and clips are original
 * geometry dedicated to the public domain. See humanoid-license.md.
 * Saved looks stay on character version 1; item ids map onto these parts.
 */

import * as THREE from "three";
import type { BodyShape, BodySize, CharacterConfig } from "./character";

export const HUMANOID_HEIGHT = 1.7;
export const HEAD_HEIGHT = 0.23;
export const SPRING_DISTANCE = 14;

/** Name of a softer face mesh inside humanoid.glb. The creator wears it when the file includes that node. */
export const SOFT_FACE_NODE = "softFace";

export const HUMANOID_EMOTES = ["idle", "walk", "sit", "wave", "cheer", "dance", "think"] as const;
export type HumanoidEmote = (typeof HUMANOID_EMOTES)[number];

export const HUMANOID_CLIPS = ["idle", "walk", "sitDown", "sitIdle", "standUp", "wave", "cheer", "dance", "think"] as const;

const BONE_NAMES = [
  "hips", "spine", "chest", "neck", "head",
  "shoulderL", "upperArmL", "lowerArmL", "handL",
  "shoulderR", "upperArmR", "lowerArmR", "handR",
  "upperLegL", "lowerLegL", "footL",
  "upperLegR", "lowerLegR", "footR",
  "hairA", "hairB", "hairC",
  "coatHemL", "coatHemR", "coatHemBack",
  "skirtHemL", "skirtHemR", "skirtHemBack",
  "fur",
] as const;

export type HumanoidBone = (typeof BONE_NAMES)[number];

const PARENT: Record<HumanoidBone, HumanoidBone | null> = {
  hips: null,
  spine: "hips",
  chest: "spine",
  neck: "chest",
  head: "neck",
  shoulderL: "chest",
  upperArmL: "shoulderL",
  lowerArmL: "upperArmL",
  handL: "lowerArmL",
  shoulderR: "chest",
  upperArmR: "shoulderR",
  lowerArmR: "upperArmR",
  handR: "lowerArmR",
  upperLegL: "hips",
  lowerLegL: "upperLegL",
  footL: "lowerLegL",
  upperLegR: "hips",
  lowerLegR: "upperLegR",
  footR: "lowerLegR",
  hairA: "head",
  hairB: "hairA",
  hairC: "hairB",
  coatHemL: "chest",
  coatHemR: "chest",
  coatHemBack: "chest",
  skirtHemL: "hips",
  skirtHemR: "hips",
  skirtHemBack: "hips",
  fur: "chest",
};

/** Local bind translation. Rotations are identity in the bind pose. */
const LOCAL: Record<HumanoidBone, [number, number, number]> = {
  hips: [0, 0.96, 0],
  spine: [0, 0.12, 0],
  chest: [0, 0.18, 0],
  neck: [0, 0.18, 0],
  head: [0, 0.12, 0.01],
  shoulderL: [-0.1, 0.12, 0],
  upperArmL: [-0.12, -0.02, 0],
  lowerArmL: [0, -0.26, 0],
  handL: [0, -0.24, 0],
  shoulderR: [0.1, 0.12, 0],
  upperArmR: [0.12, -0.02, 0],
  lowerArmR: [0, -0.26, 0],
  handR: [0, -0.24, 0],
  upperLegL: [-0.09, -0.04, 0],
  lowerLegL: [0, -0.42, 0],
  footL: [0, -0.4, 0.02],
  upperLegR: [0.09, -0.04, 0],
  lowerLegR: [0, -0.42, 0],
  footR: [0, -0.4, 0.02],
  hairA: [0, 0.1, -0.02],
  hairB: [0, -0.13, -0.04],
  hairC: [0, -0.13, -0.02],
  coatHemL: [-0.16, -0.36, 0.05],
  coatHemR: [0.16, -0.36, 0.05],
  coatHemBack: [0, -0.38, -0.1],
  skirtHemL: [-0.16, -0.32, 0.08],
  skirtHemR: [0.16, -0.32, 0.08],
  skirtHemBack: [0, -0.3, -0.12],
  fur: [0, 0.16, 0.07],
};

type Euler = [number, number, number];
type Pose = Partial<Record<HumanoidBone, { position?: [number, number, number]; rotation?: Euler }>>;

/** Seated pose shared by the sit clips and the foot-clearance check. */
export const SIT_POSE: Pose = {
  hips: { position: [0, 0.68, 0.02], rotation: [0.06, 0, 0] },
  spine: { rotation: [0.1, 0, 0] },
  chest: { rotation: [-0.04, 0, 0] },
  upperLegL: { rotation: [-1.2, 0.05, 0.06] },
  upperLegR: { rotation: [-1.2, -0.05, -0.06] },
  lowerLegL: { rotation: [1.28, 0, 0] },
  lowerLegR: { rotation: [1.28, 0, 0] },
  footL: { rotation: [-0.15, 0, 0] },
  footR: { rotation: [-0.15, 0, 0] },
  upperArmL: { rotation: [0.35, 0, 0.25] },
  upperArmR: { rotation: [0.35, 0, -0.25] },
  lowerArmL: { rotation: [0.5, 0, 0] },
  lowerArmR: { rotation: [0.5, 0, 0] },
};

const BONE_INDEX = Object.fromEntries(BONE_NAMES.map((name, index) => [name, index])) as Record<HumanoidBone, number>;

function sizeScale(size: BodySize) {
  if (size === "small") return 0.92;
  if (size === "large") return 1.08;
  return 1;
}

function morphInfluences(shape: BodyShape): [number, number] {
  const build = shape === "wide" ? 0.85 : shape === "round" ? 0.4 : 0;
  const height = shape === "tall" ? 0.75 : shape === "compact" ? -0.4 : 0;
  return [build, height];
}

export function coveredRegions(config: CharacterConfig) {
  const covered = new Set<string>();
  const top = config.slots.top.item;
  const bottom = config.slots.bottom.item;
  const extra = config.slots.accessory.item;
  if (top === "tee" || top === "hoodie" || top === "jacket" || top === "overalls") {
    covered.add("chest");
    covered.add("abdomen");
  }
  if (top === "vest") {
    covered.add("chest");
    covered.add("abdomen");
  }
  if (top === "tee" || top === "hoodie" || top === "jacket") {
    covered.add("upperArmL");
    covered.add("upperArmR");
  }
  if (top === "hoodie" || top === "jacket") {
    covered.add("lowerArmL");
    covered.add("lowerArmR");
  }
  if (top === "collar" || top === "hoodie" || extra === "scarf") covered.add("neck");
  if (bottom === "overalls") {
    covered.add("chest");
    covered.add("abdomen");
    covered.add("pelvis");
    covered.add("upperLegL");
    covered.add("upperLegR");
    covered.add("lowerLegL");
    covered.add("lowerLegR");
  }
  if (bottom === "pants") {
    covered.add("pelvis");
    covered.add("upperLegL");
    covered.add("upperLegR");
    covered.add("lowerLegL");
    covered.add("lowerLegR");
  }
  if (bottom === "shorts" || bottom === "skirt") {
    covered.add("pelvis");
    covered.add("upperLegL");
    covered.add("upperLegR");
  }
  if (config.slots.shoes.item !== "none") {
    covered.add("footL");
    covered.add("footR");
  }
  return covered;
}

export function springBoneNames(config: CharacterConfig): HumanoidBone[] {
  const names: HumanoidBone[] = [];
  const hair = config.slots.hair.item;
  if (hair === "bun") names.push("hairA");
  if (hair === "bob" || hair === "long" || hair === "waves" || hair === "spikes") names.push("hairA", "hairB", "hairC");
  const top = config.slots.top.item;
  if (top === "jacket" || top === "hoodie") names.push("coatHemL", "coatHemR", "coatHemBack");
  if (top === "jacket") names.push("fur");
  if (config.slots.bottom.item === "skirt") names.push("skirtHemL", "skirtHemR", "skirtHemBack");
  return names;
}

export type HumanoidPart = {
  id: string;
  slot: string;
  color: string;
  bones: HumanoidBone[];
  covers: string[];
};

/** Same item ids as a saved look, described as skinned garments. */
export function humanoidPlan(config: CharacterConfig) {
  const parts: HumanoidPart[] = [];
  const push = (id: string, slot: string, color: string, bones: HumanoidBone[], covers: string[]) => {
    if (id === "none") return;
    parts.push({ id, slot, color, bones, covers });
  };
  const hair = config.slots.hair.item;
  if (hair !== "none") push(hair, "hair", config.slots.hair.color, springBoneNames(config).filter((bone) => bone.startsWith("hair")), []);
  if (config.slots.headwear.item !== "none") {
    push(config.slots.headwear.item, "headwear", config.slots.headwear.color, ["head"], []);
  }
  const top = config.slots.top.item;
  if (top !== "none") {
    push(top, "top", config.slots.top.color, top === "jacket" ? ["chest", "coatHemL", "coatHemR", "coatHemBack", "fur"] : ["chest", "upperArmL"], ["chest"]);
  }
  const bottom = config.slots.bottom.item;
  if (bottom !== "none") {
    push(bottom, "bottom", config.slots.bottom.color, bottom === "skirt" ? ["hips", "skirtHemL", "skirtHemR", "skirtHemBack"] : ["upperLegL", "lowerLegL"], ["pelvis"]);
  }
  if (config.slots.shoes.item !== "none") push(config.slots.shoes.item, "shoes", config.slots.shoes.color, ["footL", "footR"], ["footL"]);
  if (config.slots.accessory.item !== "none") push(config.slots.accessory.item, "accessory", config.slots.accessory.color, ["head", "chest"], []);
  return {
    scale: sizeScale(config.body.size),
    height: HUMANOID_HEIGHT,
    headHeight: HEAD_HEIGHT,
    parts,
    covered: [...coveredRegions(config)],
    springs: springBoneNames(config),
    clips: [...HUMANOID_CLIPS],
    morphs: morphInfluences(config.body.shape),
  };
}

/** True when the glTF chunk names the soft-face node. Binary chunks can contain that string beside the JSON. */
export function glbHasSoftFace(bytes: Uint8Array) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes).includes(SOFT_FACE_NODE);
}

/** Saved version-1 looks already use these item ids, so the humanoid wears them as-is. */
export function migrateLook(config: CharacterConfig): CharacterConfig {
  return {
    version: 1,
    body: { ...config.body },
    face: { ...config.face },
    slots: {
      hair: { ...config.slots.hair },
      headwear: { ...config.slots.headwear },
      top: { ...config.slots.top },
      bottom: { ...config.slots.bottom },
      shoes: { ...config.slots.shoes },
      accessory: { ...config.slots.accessory },
    },
    palette: { ...config.palette },
    nameTag: { ...config.nameTag },
  };
}

type World = { position: THREE.Vector3; quaternion: THREE.Quaternion };

function quatOf(rotation: Euler) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2]));
}

export function boneWorld(name: HumanoidBone, pose: Pose = {}, cache = new Map<HumanoidBone, World>()): World {
  const hit = cache.get(name);
  if (hit) return hit;
  const parent = PARENT[name];
  const local = pose[name]?.position ?? LOCAL[name];
  const rotation = quatOf(pose[name]?.rotation ?? [0, 0, 0]);
  let world: World;
  if (!parent) {
    world = { position: new THREE.Vector3(local[0], local[1], local[2]), quaternion: rotation };
  } else {
    const above = boneWorld(parent, pose, cache);
    world = {
      position: above.position.clone().add(new THREE.Vector3(local[0], local[1], local[2]).applyQuaternion(above.quaternion)),
      quaternion: above.quaternion.clone().multiply(rotation),
    };
  }
  cache.set(name, world);
  return world;
}

export function ankleHeight(pose: Pose = {}) {
  return Math.min(boneWorld("footL", pose).position.y, boneWorld("footR", pose).position.y);
}

function track(bone: HumanoidBone, times: number[], rotations: Euler[]) {
  const values: number[] = [];
  for (const rotation of rotations) {
    const q = quatOf(rotation);
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values);
}

function positionTrack(bone: HumanoidBone, times: number[], positions: [number, number, number][]) {
  return new THREE.VectorKeyframeTrack(`${bone}.position`, times, positions.flat());
}

function hold(rotation: Euler, count: number): Euler[] {
  return Array.from({ length: count }, () => rotation);
}

const REST_HIPS: [number, number, number] = [...LOCAL.hips];
const SIT_HIPS: [number, number, number] = SIT_POSE.hips?.position ?? REST_HIPS;

function rot(pose: Pose, bone: HumanoidBone): Euler {
  return pose[bone]?.rotation ?? [0, 0, 0];
}

export function humanoidClips() {
  const idleTimes = [0, 1, 2];
  const idle = new THREE.AnimationClip("idle", 2, [
    positionTrack("hips", idleTimes, [REST_HIPS, REST_HIPS, REST_HIPS]),
    track("chest", idleTimes, [[0.03, 0, 0], [-0.02, 0, 0], [0.03, 0, 0]]),
    track("spine", idleTimes, [[0.01, 0, 0], [-0.01, 0, 0], [0.01, 0, 0]]),
    track("head", idleTimes, [[0.02, 0.03, 0], [-0.01, -0.03, 0], [0.02, 0.03, 0]]),
    track("upperArmL", idleTimes, [[0.08, 0, 0.08], [0.02, 0, 0.1], [0.08, 0, 0.08]]),
    track("upperArmR", idleTimes, [[0.08, 0, -0.08], [0.02, 0, -0.1], [0.08, 0, -0.08]]),
  ]);
  const walkTimes = [0, 0.2, 0.4, 0.6, 0.8];
  const walk = new THREE.AnimationClip("walk", 0.8, [
    positionTrack("hips", walkTimes, [REST_HIPS, [0, 0.98, 0], REST_HIPS, [0, 0.98, 0], REST_HIPS]),
    track("upperLegL", walkTimes, [[-0.55, 0, 0], [0, 0, 0], [0.5, 0, 0], [0, 0, 0], [-0.55, 0, 0]]),
    track("upperLegR", walkTimes, [[0.5, 0, 0], [0, 0, 0], [-0.55, 0, 0], [0, 0, 0], [0.5, 0, 0]]),
    track("lowerLegL", walkTimes, [[0.7, 0, 0], [0.25, 0, 0], [0.15, 0, 0], [0.35, 0, 0], [0.7, 0, 0]]),
    track("lowerLegR", walkTimes, [[0.15, 0, 0], [0.35, 0, 0], [0.7, 0, 0], [0.25, 0, 0], [0.15, 0, 0]]),
    track("upperArmL", walkTimes, [[0.45, 0, 0.08], [0, 0, 0.08], [-0.45, 0, 0.08], [0, 0, 0.08], [0.45, 0, 0.08]]),
    track("upperArmR", walkTimes, [[-0.45, 0, -0.08], [0, 0, -0.08], [0.45, 0, -0.08], [0, 0, -0.08], [-0.45, 0, -0.08]]),
    track("chest", walkTimes, [[0.04, -0.05, 0], [0.04, 0, 0], [0.04, 0.05, 0], [0.04, 0, 0], [0.04, -0.05, 0]]),
  ]);
  const sitTimes = [0, 0.45];
  const sitDown = new THREE.AnimationClip("sitDown", 0.45, [
    positionTrack("hips", sitTimes, [REST_HIPS, SIT_HIPS]),
    track("spine", sitTimes, [[0, 0, 0], rot(SIT_POSE, "spine")]),
    track("chest", sitTimes, [[0, 0, 0], rot(SIT_POSE, "chest")]),
    track("upperLegL", sitTimes, [[0, 0, 0], rot(SIT_POSE, "upperLegL")]),
    track("upperLegR", sitTimes, [[0, 0, 0], rot(SIT_POSE, "upperLegR")]),
    track("lowerLegL", sitTimes, [[0, 0, 0], rot(SIT_POSE, "lowerLegL")]),
    track("lowerLegR", sitTimes, [[0, 0, 0], rot(SIT_POSE, "lowerLegR")]),
    track("footL", sitTimes, [[0, 0, 0], rot(SIT_POSE, "footL")]),
    track("footR", sitTimes, [[0, 0, 0], rot(SIT_POSE, "footR")]),
    track("upperArmL", sitTimes, [[0.08, 0, 0.08], rot(SIT_POSE, "upperArmL")]),
    track("upperArmR", sitTimes, [[0.08, 0, -0.08], rot(SIT_POSE, "upperArmR")]),
    track("lowerArmL", sitTimes, [[0, 0, 0], rot(SIT_POSE, "lowerArmL")]),
    track("lowerArmR", sitTimes, [[0, 0, 0], rot(SIT_POSE, "lowerArmR")]),
  ]);
  const sitIdle = new THREE.AnimationClip("sitIdle", 2, [
    positionTrack("hips", idleTimes, [SIT_HIPS, SIT_HIPS, SIT_HIPS]),
    track("spine", idleTimes, hold(rot(SIT_POSE, "spine"), 3)),
    track("chest", idleTimes, [[-0.02, 0, 0], [0.02, 0, 0], [-0.02, 0, 0]]),
    track("upperLegL", idleTimes, hold(rot(SIT_POSE, "upperLegL"), 3)),
    track("upperLegR", idleTimes, hold(rot(SIT_POSE, "upperLegR"), 3)),
    track("lowerLegL", idleTimes, hold(rot(SIT_POSE, "lowerLegL"), 3)),
    track("lowerLegR", idleTimes, hold(rot(SIT_POSE, "lowerLegR"), 3)),
    track("footL", idleTimes, hold(rot(SIT_POSE, "footL"), 3)),
    track("footR", idleTimes, hold(rot(SIT_POSE, "footR"), 3)),
    track("upperArmL", idleTimes, hold(rot(SIT_POSE, "upperArmL"), 3)),
    track("upperArmR", idleTimes, hold(rot(SIT_POSE, "upperArmR"), 3)),
    track("head", idleTimes, [[0.04, 0.04, 0], [0.02, -0.04, 0], [0.04, 0.04, 0]]),
  ]);
  const standUp = new THREE.AnimationClip("standUp", 0.45, [
    positionTrack("hips", sitTimes, [SIT_HIPS, REST_HIPS]),
    track("spine", sitTimes, [rot(SIT_POSE, "spine"), [0, 0, 0]]),
    track("chest", sitTimes, [rot(SIT_POSE, "chest"), [0, 0, 0]]),
    track("upperLegL", sitTimes, [rot(SIT_POSE, "upperLegL"), [0, 0, 0]]),
    track("upperLegR", sitTimes, [rot(SIT_POSE, "upperLegR"), [0, 0, 0]]),
    track("lowerLegL", sitTimes, [rot(SIT_POSE, "lowerLegL"), [0, 0, 0]]),
    track("lowerLegR", sitTimes, [rot(SIT_POSE, "lowerLegR"), [0, 0, 0]]),
    track("footL", sitTimes, [rot(SIT_POSE, "footL"), [0, 0, 0]]),
    track("footR", sitTimes, [rot(SIT_POSE, "footR"), [0, 0, 0]]),
    track("upperArmL", sitTimes, [rot(SIT_POSE, "upperArmL"), [0.08, 0, 0.08]]),
    track("upperArmR", sitTimes, [rot(SIT_POSE, "upperArmR"), [0.08, 0, -0.08]]),
  ]);
  const waveTimes = [0, 0.25, 0.5, 0.75, 1];
  const wave = new THREE.AnimationClip("wave", 1, [
    positionTrack("hips", [0, 1], [REST_HIPS, REST_HIPS]),
    track("upperArmR", waveTimes, [[-2.4, 0, -0.2], [-2.5, 0, -0.35], [-2.35, 0, -0.1], [-2.5, 0, -0.35], [-2.4, 0, -0.2]]),
    track("lowerArmR", waveTimes, [[0.2, 0, 0], [0.45, 0, 0], [0.15, 0, 0], [0.45, 0, 0], [0.2, 0, 0]]),
    track("head", waveTimes, [[0, -0.1, 0], [0.05, -0.16, 0], [0, -0.1, 0], [0.05, -0.16, 0], [0, -0.1, 0]]),
  ]);
  const cheerTimes = [0, 0.3, 0.6, 0.9];
  const cheer = new THREE.AnimationClip("cheer", 0.9, [
    positionTrack("hips", cheerTimes, [REST_HIPS, [0, 1.02, 0], REST_HIPS, [0, 1.02, 0]]),
    track("upperArmL", cheerTimes, [[-2.5, 0, 0.35], [-2.7, 0, 0.2], [-2.5, 0, 0.35], [-2.7, 0, 0.2]]),
    track("upperArmR", cheerTimes, [[-2.5, 0, -0.35], [-2.7, 0, -0.2], [-2.5, 0, -0.35], [-2.7, 0, -0.2]]),
    track("chest", cheerTimes, [[-0.08, 0, 0], [0.04, 0, 0], [-0.08, 0, 0], [0.04, 0, 0]]),
  ]);
  const danceTimes = [0, 0.4, 0.8, 1.2, 1.6];
  const dance = new THREE.AnimationClip("dance", 1.6, [
    positionTrack("hips", danceTimes, [[0, 0.96, 0], [0.04, 0.98, 0], [0, 0.96, 0], [-0.04, 0.98, 0], [0, 0.96, 0]]),
    track("hips", danceTimes, [[0, 0.25, 0], [0, 0, 0.08], [0, -0.25, 0], [0, 0, -0.08], [0, 0.25, 0]]),
    track("upperArmL", danceTimes, [[-0.8, 0, 0.5], [-1.3, 0, 0.2], [-0.6, 0, 0.7], [-1.1, 0, 0.3], [-0.8, 0, 0.5]]),
    track("upperArmR", danceTimes, [[-1.2, 0, -0.3], [-0.6, 0, -0.6], [-1.3, 0, -0.2], [-0.7, 0, -0.5], [-1.2, 0, -0.3]]),
    track("upperLegL", danceTimes, [[-0.2, 0, 0], [0.15, 0, 0], [-0.2, 0, 0], [0.15, 0, 0], [-0.2, 0, 0]]),
    track("upperLegR", danceTimes, [[0.15, 0, 0], [-0.2, 0, 0], [0.15, 0, 0], [-0.2, 0, 0], [0.15, 0, 0]]),
  ]);
  const think = new THREE.AnimationClip("think", 2, [
    positionTrack("hips", idleTimes, [REST_HIPS, REST_HIPS, REST_HIPS]),
    track("upperArmR", idleTimes, [[-1.1, 0.2, -0.35], [-1.15, 0.15, -0.3], [-1.1, 0.2, -0.35]]),
    track("lowerArmR", idleTimes, [[1.7, 0, 0.2], [1.85, 0, 0.1], [1.7, 0, 0.2]]),
    track("head", idleTimes, [[0.18, -0.12, 0.08], [0.22, -0.08, 0.05], [0.18, -0.12, 0.08]]),
    track("spine", idleTimes, [[0.06, 0.05, 0], [0.08, 0.02, 0], [0.06, 0.05, 0]]),
  ]);
  for (const clip of [idle, walk, sitDown, sitIdle, standUp, wave, cheer, dance, think]) {
    clip.optimize();
  }
  return [idle, walk, sitDown, sitIdle, standUp, wave, cheer, dance, think];
}

type Bucket = {
  positions: number[];
  indices: number[];
  skinIndex: number[];
  skinWeight: number[];
};

function startBucket(): Bucket {
  return { positions: [], indices: [], skinIndex: [], skinWeight: [] };
}

function addVertex(bucket: Bucket, x: number, y: number, z: number, bone: HumanoidBone, parent: HumanoidBone, parentWeight: number) {
  bucket.positions.push(x, y, z);
  const self = 1 - parentWeight;
  bucket.skinIndex.push(BONE_INDEX[bone], BONE_INDEX[parent], 0, 0);
  bucket.skinWeight.push(self, parentWeight, 0, 0);
  return bucket.positions.length / 3 - 1;
}

function addSegment(
  bucket: Bucket,
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  bone: HumanoidBone,
  parent: HumanoidBone,
  rings = 4,
  segs = 14,
) {
  const dir = to.clone().sub(from);
  const length = dir.length() || 1;
  dir.multiplyScalar(1 / length);
  const helper = Math.abs(dir.y) > 0.85 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(dir, helper).normalize();
  const lift = new THREE.Vector3().crossVectors(side, dir).normalize();
  const base = bucket.positions.length / 3;
  for (let ring = 0; ring <= rings; ring += 1) {
    const t = ring / rings;
    const center = from.clone().lerp(to, t);
    const endBlend = t > 0.75 ? ((t - 0.75) / 0.25) * 0.7 : 0;
    const wide = radius * (1 - Math.abs(t - 0.5) * 0.08);
    for (let step = 0; step < segs; step += 1) {
      const angle = (step / segs) * Math.PI * 2;
      const offset = side.clone().multiplyScalar(Math.cos(angle) * wide).add(lift.clone().multiplyScalar(Math.sin(angle) * wide));
      addVertex(bucket, center.x + offset.x, center.y + offset.y, center.z + offset.z, parent, bone, endBlend);
    }
  }
  for (let ring = 0; ring < rings; ring += 1) {
    for (let step = 0; step < segs; step += 1) {
      const next = (step + 1) % segs;
      const a = base + ring * segs + step;
      const b = base + ring * segs + next;
      const c = base + (ring + 1) * segs + step;
      const d = base + (ring + 1) * segs + next;
      bucket.indices.push(a, c, b, b, c, d);
    }
  }
}

function addSphere(bucket: Bucket, center: THREE.Vector3, radius: number, bone: HumanoidBone, parent: HumanoidBone, width = 1, depth = 1, soft = false) {
  const segs = soft ? 22 : 14;
  const rings = soft ? 16 : 10;
  const base = bucket.positions.length / 3;
  for (let ring = 0; ring <= rings; ring += 1) {
    const v = (ring / rings) * Math.PI;
    const y = Math.cos(v);
    const band = Math.sin(v);
    const lower = v > Math.PI * 0.62;
    const chin = soft && lower ? 0.84 + 0.16 * (1 - (v - Math.PI * 0.62) / (Math.PI * 0.38)) : 1;
    const cheek = soft ? 1 + Math.sin(v) * 0.06 : 1;
    const face = soft ? Math.max(0, Math.sin(v) - 0.15) * 0.018 : 0;
    for (let step = 0; step < segs; step += 1) {
      const u = (step / segs) * Math.PI * 2;
      addVertex(
        bucket,
        center.x + Math.cos(u) * band * radius * width * cheek * chin,
        center.y + y * radius * (soft ? 1.06 : 1),
        center.z + Math.sin(u) * band * radius * depth * chin + face,
        bone,
        parent,
        0,
      );
    }
  }
  for (let ring = 0; ring < rings; ring += 1) {
    for (let step = 0; step < segs; step += 1) {
      const next = (step + 1) % segs;
      const a = base + ring * segs + step;
      const b = base + ring * segs + next;
      const c = base + (ring + 1) * segs + step;
      const d = base + (ring + 1) * segs + next;
      bucket.indices.push(a, c, b, b, c, d);
    }
  }
}

function geometryOf(bucket: Bucket) {
  const geometry = new THREE.BufferGeometry();
  const position = new Float32Array(bucket.positions);
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(bucket.skinIndex, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(bucket.skinWeight, 4));
  geometry.setIndex(bucket.indices);
  const build = new Float32Array(position.length);
  const height = new Float32Array(position.length);
  for (let i = 0; i < position.length; i += 3) {
    const x = position[i] ?? 0;
    const y = position[i + 1] ?? 0;
    const torso = y > 0.75 && y < 1.5 ? 1 : 0.35;
    build[i] = x * 0.18 * torso;
    height[i + 1] = (y - 0.9) * 0.12;
  }
  geometry.morphAttributes.position = [
    new THREE.Float32BufferAttribute(build, 3),
    new THREE.Float32BufferAttribute(height, 3),
  ];
  geometry.morphTargetsRelative = true;
  geometry.computeVertexNormals();
  return geometry;
}

let clothNormal: THREE.DataTexture | null = null;

function normalMap() {
  if (clothNormal) return clothNormal;
  const size = 8;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    const wobble = ((i * 17) % 28) - 14;
    data[i * 4] = 128 + wobble;
    data[i * 4 + 1] = 128 - wobble;
    data[i * 4 + 2] = 255;
    data[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  clothNormal = texture;
  return texture;
}

function material(color: string, kind: "skin" | "cloth" | "hair") {
  const map = kind === "cloth" ? normalMap() : null;
  return new THREE.MeshStandardMaterial({
    color,
    roughness: kind === "skin" ? 0.5 : kind === "hair" ? 0.42 : 0.78,
    metalness: 0,
    normalMap: map,
  });
}

function skinned(name: string, bucket: Bucket, skin: THREE.Material, influences: [number, number]) {
  const mesh = new THREE.SkinnedMesh(geometryOf(bucket), skin);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  mesh.morphTargetInfluences = [...influences];
  return mesh;
}

export type SpringBone = {
  bone: THREE.Bone;
  rest: THREE.Vector3;
  previous: THREE.Vector3;
};

export type HumanoidModel = {
  rig: THREE.Group;
  springs: SpringBone[];
  covered: Set<string>;
  dispose: () => void;
};

const _world = new THREE.Vector3();
const _pull = new THREE.Vector3();
const _delta = new THREE.Vector3();

export function stepSprings(springs: SpringBone[], dt: number, enabled: boolean) {
  const keep = Math.exp(-7 * Math.max(0, dt));
  for (const spring of springs) {
    const bone = spring.bone;
    const parent = bone.parent;
    if (!parent) continue;
    if (!enabled) {
      bone.position.copy(spring.rest);
      bone.updateWorldMatrix(true, false);
      spring.previous.setFromMatrixPosition(bone.matrixWorld);
      continue;
    }
    bone.updateWorldMatrix(true, false);
    _world.setFromMatrixPosition(bone.matrixWorld);
    const velocity = _pull.copy(_world).sub(spring.previous);
    spring.previous.copy(_world);
    parent.worldToLocal(_world.add(velocity.multiplyScalar(0.55)));
    bone.position.lerpVectors(spring.rest, _world, Math.min(0.45, keep));
    _delta.copy(bone.position).sub(spring.rest);
    if (_delta.length() > 0.08) bone.position.copy(spring.rest).add(_delta.setLength(0.08));
  }
}

function makeBones() {
  const bones = BONE_NAMES.map((name) => {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.set(LOCAL[name][0], LOCAL[name][1], LOCAL[name][2]);
    return bone;
  });
  BONE_NAMES.forEach((name, index) => {
    const parent = PARENT[name];
    if (parent) bones[BONE_INDEX[parent]]?.add(bones[index]!);
  });
  return bones;
}

function lipGeometry(mouth: string, expression: string) {
  if (mouth === "open" || expression === "surprised") return new THREE.SphereGeometry(0.014, 14, 12);
  if (mouth === "flat" || expression === "calm") return new THREE.SphereGeometry(0.02, 14, 10);
  const grin = mouth === "grin";
  return new THREE.TorusGeometry(grin ? 0.028 : 0.02, grin ? 0.006 : 0.005, 8, 18, grin ? Math.PI * 1.15 : Math.PI);
}

function faceOn(head: THREE.Bone, config: CharacterConfig) {
  const group = new THREE.Group();
  group.name = "face";
  const eyes = config.face.eyes;
  const wide = eyes === "wide" ? 1.25 : eyes === "sleepy" ? 0.45 : eyes === "star" ? 1.08 : 1;
  const radius = eyes === "dot" ? 0.012 : 0.016;
  const white = new THREE.MeshStandardMaterial({ color: "#f7f4ee", roughness: 0.32 });
  const dark = new THREE.MeshStandardMaterial({ color: "#1c211e", roughness: 0.4 });
  const mouthColor = new THREE.MeshStandardMaterial({ color: "#8a3b24", roughness: 0.45 });
  const eyeY = 0.02;
  const eyeZ = 0.108;
  for (const side of [-1, 1]) {
    const wink = config.face.expression === "wink" && side === 1;
    const surprise = config.face.expression === "surprised" ? 1.3 : 1;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), white);
    eye.scale.set(surprise * (eyes === "star" ? 1.05 : 1), (wink ? 0.16 : wide) * surprise, eyes === "star" ? 0.72 : 1);
    eye.position.set(side * 0.038, eyeY, eyeZ);
    eye.name = side < 0 ? "eye-l" : "eye-r";
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.55, 12, 10), dark);
    pupil.position.set(0, 0, radius * 0.72);
    if (config.face.expression === "focused") pupil.position.z += 0.004;
    const catchlight = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.18, 8, 6),
      new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.2 }),
    );
    catchlight.position.set(-radius * 0.28, radius * 0.28, radius * 0.85);
    eye.add(pupil, catchlight);
    group.add(eye);
  }
  const mouth = config.face.mouth;
  const calm = mouth === "flat" || config.face.expression === "calm";
  const lips = new THREE.Mesh(lipGeometry(mouth, config.face.expression), mouthColor);
  lips.name = "mouth";
  lips.position.set(0, calm ? -0.038 : -0.03, 0.112);
  if (!calm && mouth !== "open" && config.face.expression !== "surprised") lips.rotation.z = Math.PI;
  if (calm) lips.scale.set(1.15, 0.28, 0.55);
  group.add(lips);
  head.add(group);
}

function hairLengths(style: string) {
  if (style === "long" || style === "waves") return 3;
  if (style === "bob" || style === "spikes") return 2;
  if (style === "bun" || style === "cap") return 1;
  return 0;
}

export function createHumanoid(config: CharacterConfig): HumanoidModel {
  const covered = coveredRegions(config);
  const influences = morphInfluences(config.body.shape);
  const bind = new Map<HumanoidBone, World>();
  for (const name of BONE_NAMES) boneWorld(name, {}, bind);
  const at = (name: HumanoidBone) => bind.get(name)!.position;
  const rig = new THREE.Group();
  rig.name = "humanoid";
  const bones = makeBones();
  const skeleton = new THREE.Skeleton(bones);
  const skin = material(config.body.color, "skin");
  const body = startBucket();
  const segment = (
    bucket: Bucket,
    bone: HumanoidBone,
    parent: HumanoidBone,
    radius: number,
    rings = 3,
  ) => {
    addSegment(bucket, at(parent), at(bone), radius, bone, parent, rings);
  };
  if (!covered.has("abdomen")) segment(body, "spine", "hips", 0.13);
  if (!covered.has("chest")) segment(body, "chest", "spine", 0.15, 4);
  if (!covered.has("neck")) segment(body, "neck", "chest", 0.055, 2);
  if (!covered.has("pelvis")) addSphere(body, at("hips"), 0.13, "hips", "hips", 1.05, 0.85);
  if (!covered.has("upperArmL")) segment(body, "lowerArmL", "upperArmL", 0.045);
  if (!covered.has("lowerArmL")) segment(body, "handL", "lowerArmL", 0.038);
  if (!covered.has("upperArmR")) segment(body, "lowerArmR", "upperArmR", 0.045);
  if (!covered.has("lowerArmR")) segment(body, "handR", "lowerArmR", 0.038);
  addSphere(body, at("handL"), 0.034, "handL", "lowerArmL");
  addSphere(body, at("handR"), 0.034, "handR", "lowerArmR");
  if (!covered.has("upperLegL")) segment(body, "lowerLegL", "upperLegL", 0.062);
  if (!covered.has("lowerLegL")) segment(body, "footL", "lowerLegL", 0.048);
  if (!covered.has("upperLegR")) segment(body, "lowerLegR", "upperLegR", 0.062);
  if (!covered.has("lowerLegR")) segment(body, "footR", "lowerLegR", 0.048);
  if (!covered.has("footL")) addSegment(body, at("footL"), at("footL").clone().add(new THREE.Vector3(0, -0.06, 0.12)), 0.04, "footL", "footL", 2, 6);
  if (!covered.has("footR")) addSegment(body, at("footR"), at("footR").clone().add(new THREE.Vector3(0, -0.06, 0.12)), 0.04, "footR", "footR", 2, 6);
  addSphere(body, at("head"), 0.112, "head", "neck", 0.96, 1.04, true);
  const regions = ["head", "hands"];
  for (const region of ["chest", "abdomen", "neck", "pelvis", "upperArmL", "lowerArmL", "upperArmR", "lowerArmR", "upperLegL", "lowerLegL", "upperLegR", "lowerLegR", "footL", "footR"]) {
    if (!covered.has(region)) regions.push(region);
  }
  const bodyMesh = skinned("body", body, skin, influences);
  bodyMesh.userData.regions = regions;
  const meshes: THREE.SkinnedMesh[] = [bodyMesh];

  const cloth = (name: string, color: string, fill: (bucket: Bucket) => void, trim = false) => {
    const bucket = startBucket();
    fill(bucket);
    if (bucket.positions.length === 0) return;
    const mesh = skinned(name, bucket, material(color, "cloth"), influences);
    if (trim) mesh.userData.lod = "trim";
    meshes.push(mesh);
  };

  const top = config.slots.top.item;
  const topColor = config.slots.top.color;
  if (top === "tee" || top === "vest" || top === "hoodie" || top === "jacket" || top === "collar") {
    cloth(top, topColor, (bucket) => {
      const pad = 0.02;
      if (top !== "collar") {
        addSegment(bucket, at("hips"), at("spine"), 0.13 + pad, "spine", "hips", 3);
        addSegment(bucket, at("spine"), at("chest"), 0.155 + pad, "chest", "spine", 3);
      }
      if (top === "collar" || top === "hoodie" || top === "jacket") addSegment(bucket, at("chest"), at("neck"), 0.07, "neck", "chest", 2);
      if (top === "tee" || top === "hoodie" || top === "jacket") {
        addSegment(bucket, at("upperArmL"), at("lowerArmL"), 0.058, "lowerArmL", "upperArmL", 3);
        addSegment(bucket, at("upperArmR"), at("lowerArmR"), 0.058, "lowerArmR", "upperArmR", 3);
      }
      if (top === "hoodie" || top === "jacket") {
        addSegment(bucket, at("lowerArmL"), at("handL"), 0.05, "handL", "lowerArmL", 3);
        addSegment(bucket, at("lowerArmR"), at("handR"), 0.05, "lowerArmR", "lowerArmR", 3);
        addSegment(bucket, at("chest"), at("coatHemL"), 0.08, "coatHemL", "chest", 3, 6);
        addSegment(bucket, at("chest"), at("coatHemR"), 0.08, "coatHemR", "chest", 3, 6);
        addSegment(bucket, at("chest"), at("coatHemBack"), 0.09, "coatHemBack", "chest", 3, 6);
      }
      if (top === "jacket") addSphere(bucket, at("fur"), 0.055, "fur", "chest", 1.4, 0.7);
    });
  }

  const bottom = config.slots.bottom.item;
  const bottomColor = config.slots.bottom.color;
  if (bottom !== "none") {
    cloth(bottom, bottomColor, (bucket) => {
      if (bottom === "overalls") {
        addSegment(bucket, at("spine"), at("chest"), 0.16, "chest", "spine", 3);
      }
      if (bottom !== "skirt") {
        addSphere(bucket, at("hips"), 0.145, "hips", "hips", 1.08, 0.9);
      }
      if (bottom === "shorts" || bottom === "pants" || bottom === "overalls") {
        addSegment(bucket, at("upperLegL"), at("lowerLegL"), 0.078, "lowerLegL", "upperLegL", bottom === "shorts" ? 2 : 3);
        addSegment(bucket, at("upperLegR"), at("lowerLegR"), 0.078, "lowerLegR", "upperLegR", bottom === "shorts" ? 2 : 3);
      }
      if (bottom === "pants" || bottom === "overalls") {
        addSegment(bucket, at("lowerLegL"), at("footL"), 0.06, "footL", "lowerLegL", 3);
        addSegment(bucket, at("lowerLegR"), at("footR"), 0.06, "lowerLegR", "lowerLegR", 3);
      }
      if (bottom === "skirt") {
        addSegment(bucket, at("hips"), at("skirtHemL"), 0.09, "skirtHemL", "hips", 3, 6);
        addSegment(bucket, at("hips"), at("skirtHemR"), 0.09, "skirtHemR", "hips", 3, 6);
        addSegment(bucket, at("hips"), at("skirtHemBack"), 0.1, "skirtHemBack", "hips", 3, 6);
      }
    });
  }

  const shoes = config.slots.shoes.item;
  if (shoes !== "none") {
    cloth(shoes, config.slots.shoes.color, (bucket) => {
      const lift = shoes === "heels" ? 0.06 : shoes === "boots" ? 0.05 : 0.035;
      for (const foot of ["footL", "footR"] as const) {
        const ankle = at(foot);
        addSegment(bucket, ankle, ankle.clone().add(new THREE.Vector3(0, -0.02, 0.14)), shoes === "boots" ? 0.05 : 0.042, foot, foot, 2, 6);
        addSphere(bucket, ankle.clone().add(new THREE.Vector3(0, -lift, 0.04)), 0.04, foot, "hips");
      }
    });
  }

  const hair = config.slots.hair.item;
  const chains = hairLengths(hair);
  if (chains > 0) {
    cloth(hair === "cap" ? "cap" : hair, config.slots.hair.color, (bucket) => {
      addSphere(bucket, at("head").clone().add(new THREE.Vector3(0, 0.03, -0.02)), hair === "bun" ? 0.06 : 0.09, "hairA", "head", 1.05, 1.08);
      if (chains > 1) addSegment(bucket, at("hairA"), at("hairB"), hair === "spikes" ? 0.03 : 0.05, "hairB", "hairA", 3, 6);
      if (chains > 2) addSegment(bucket, at("hairB"), at("hairC"), 0.04, "hairC", "hairB", 3, 5);
    });
  }

  const hat = config.slots.headwear.item;
  if (hat !== "none") {
    cloth(hat, config.slots.headwear.color, (bucket) => {
      addSphere(bucket, at("head").clone().add(new THREE.Vector3(0, 0.08, 0)), hat === "bow" ? 0.04 : 0.12, "head", "neck", hat === "crown" ? 0.7 : 1.05, 1);
    });
  }

  const extra = config.slots.accessory.item;
  if (extra !== "none") {
    cloth(extra, config.slots.accessory.color, (bucket) => {
      if (extra === "glasses") {
        addSphere(bucket, at("head").clone().add(new THREE.Vector3(-0.035, 0.02, 0.1)), 0.02, "head", "neck", 1.3, 0.4);
        addSphere(bucket, at("head").clone().add(new THREE.Vector3(0.035, 0.02, 0.1)), 0.02, "head", "neck", 1.3, 0.4);
      } else if (extra === "scarf") {
        addSphere(bucket, at("neck"), 0.07, "neck", "chest", 1.1, 1.1);
      } else if (extra === "watch") {
        addSphere(bucket, at("handL"), 0.03, "handL", "lowerArmL");
      } else {
        addSphere(bucket, at("chest").clone().add(new THREE.Vector3(0.08, -0.04, 0.12)), 0.04, "chest", "spine");
      }
    }, true);
  }

  bodyMesh.add(bones[0]!);
  for (const mesh of meshes) {
    rig.add(mesh);
    mesh.bind(skeleton);
  }
  faceOn(bones[BONE_INDEX.head]!, config);
  rig.scale.setScalar(sizeScale(config.body.size));

  const active = new Set(springBoneNames(config));
  const springs: SpringBone[] = [];
  for (const name of BONE_NAMES) {
    if (!active.has(name)) continue;
    const bone = bones[BONE_INDEX[name]];
    if (!bone) continue;
    springs.push({ bone, rest: bone.position.clone(), previous: bone.getWorldPosition(new THREE.Vector3()) });
  }

  return {
    rig,
    springs,
    covered,
    dispose() {
      rig.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) mat?.dispose();
      });
    },
  };
}
