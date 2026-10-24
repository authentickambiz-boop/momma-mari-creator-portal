/**
 * Rigged humanoid for Worlds. The body, clothes, hair, and clips are packed into
 * public/worlds/humanoid.glb from CC0 MakeHuman assets, with Quaternius CC0
 * motion retargeted onto that skeleton. See humanoid-license.md.
 * Saved looks stay on character version 1; item ids map onto those parts.
 * Roster bots in the office still wear this mesh. The locked player is the
 * glam rig. This file is the hero only when NEXT_PUBLIC_WORLDS_HUMANOID=true.
 */

import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import type { BodyShape, BodySize, CharacterConfig } from "./character";
import asset from "./humanoid-asset.json";

export const HUMANOID_HEIGHT = 1.7;
export const HEAD_HEIGHT = 0.23;
export const SPRING_DISTANCE = 14;

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
  if (top === "tee" || top === "vest" || top === "collar" || top === "hoodie" || top === "jacket") {
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

/** Floor clearance of the foot bone. A seated pose reports the sit-down clip. */
export function ankleHeight(pose: Pose = {}) {
  return Object.keys(pose).length > 0 ? asset.sitFoot : asset.foot;
}

const GARMENT_NODES: Record<string, Record<string, readonly string[]>> = {
  hair: {
    none: [],
    cap: ["hair_buzzed"],
    bob: ["hair_parted"],
    spikes: ["hair_buzzed"],
    bun: ["hair_buns"],
    long: ["hair_long"],
    waves: ["hair_long"],
  },
  headwear: {
    none: [],
    cap: ["hat_hood"],
    beanie: ["hat_hood"],
    bow: ["hat_hood"],
    headphones: ["hat_hood"],
    crown: ["hat_hood"],
  },
  top: {
    none: [],
    tee: ["top_tunic"],
    vest: ["top_tunic"],
    collar: ["top_tunic"],
    hoodie: ["top_coat_0"],
    jacket: ["top_coat_0"],
    overalls: ["top_coat_0", "bottom_pants"],
  },
  bottom: {
    none: [],
    shorts: ["bottom_shorts"],
    pants: ["bottom_pants"],
    skirt: ["bottom_skirt"],
    overalls: ["bottom_pants"],
  },
  shoes: {
    none: [],
    sneakers: ["shoes_sneaker"],
    sandals: ["shoes_sneaker"],
    boots: ["shoes_boot"],
    heels: ["shoes_boot"],
  },
  accessory: {
    none: [],
    glasses: ["glasses"],
    scarf: [],
    bag: [],
    badge: [],
    watch: [],
  },
};

const OPTIONAL_NODES = [
  "hair_long", "hair_buns", "hair_buzzed", "hair_parted",
  "hat_hood",
  "top_tunic", "top_coat_0",
  "bottom_pants", "bottom_shorts", "bottom_skirt",
  "shoes_sneaker", "shoes_boot",
  "glasses", "base_briefs",
  "skin_torso", "skin_hips",
  "skin_arms_upper", "skin_arms_lower",
  "skin_legs_upper", "skin_legs_lower",
  "skin_feet",
];

const SKIN_MESHES = new Set([
  "softFace", "body", "skin_torso", "skin_hips",
  "skin_arms_upper", "skin_arms_lower",
  "skin_legs_upper", "skin_legs_lower", "skin_feet",
]);

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

let template: { scene: THREE.Object3D; animations: THREE.AnimationClip[] } | null = null;

/** Tests and the offline loader install the parsed artist GLB here. The office uses useGLTF. */
export function setHumanoidTemplate(scene: THREE.Object3D, animations: THREE.AnimationClip[]) {
  template = { scene, animations };
}

export function humanoidClips() {
  if (!template) throw new Error("Humanoid template is not loaded");
  const byName = new Map(template.animations.map((clip) => [clip.name, clip]));
  return HUMANOID_CLIPS.map((name) => {
    const clip = byName.get(name);
    if (!clip) throw new Error(`Missing humanoid clip ${name}`);
    return clip;
  });
}

function nodesNamed(root: THREE.Object3D, name: string) {
  const found: THREE.Object3D[] = [];
  root.traverse((node) => {
    if (node.name === name) found.push(node);
  });
  return found;
}

function garmentMesh(name: string) {
  return (
    name.startsWith("top_") ||
    name.startsWith("bottom_") ||
    name.startsWith("shoes_") ||
    name.startsWith("hat_") ||
    name === "jacket" ||
    name === "hoodie" ||
    name === "pants" ||
    name === "shorts" ||
    name === "skirt" ||
    name === "base_briefs"
  );
}

function tint(mesh: THREE.Mesh, color: string) {
  const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of list) {
    if (material && "color" in material && material.color instanceof THREE.Color) material.color.set(color);
  }
}

/** Knit stays solid at office and creator camera distances. */
function sealGarment(mesh: THREE.Mesh) {
  const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of list) {
    if (!material) continue;
    material.transparent = false;
    material.opacity = 1;
    material.depthWrite = true;
    material.alphaTest = 0;
    material.polygonOffset = true;
    material.polygonOffsetFactor = -4;
    material.polygonOffsetUnits = -4;
    material.needsUpdate = true;
  }
}

function showSet(config: CharacterConfig, covered: Set<string>) {
  const names = new Set<string>(["softFace", "body", "eyes", "brows", "teeth", "hair_lashes"]);
  for (const slot of ["hair", "headwear", "top", "bottom", "shoes", "accessory"] as const) {
    const item = config.slots[slot].item;
    for (const name of GARMENT_NODES[slot]?.[item] ?? []) names.add(name);
  }
  if (!covered.has("chest") && !covered.has("abdomen")) names.add("skin_torso");
  if (!covered.has("pelvis")) {
    names.add("skin_hips");
    names.add("base_briefs");
  }
  if (!covered.has("upperArmL")) names.add("skin_arms_upper");
  if (!covered.has("lowerArmL")) names.add("skin_arms_lower");
  if (!covered.has("upperLegL")) names.add("skin_legs_upper");
  if (!covered.has("lowerLegL")) names.add("skin_legs_lower");
  if (!covered.has("footL")) names.add("skin_feet");
  return names;
}

function nearestSkin(color: string) {
  const tones = (asset as { skins?: { name: string; color: string }[] }).skins ?? [];
  if (tones.length === 0) return null;
  const target = new THREE.Color(color);
  let best = tones[0]!;
  let score = Number.POSITIVE_INFINITY;
  for (const tone of tones) {
    const sample = new THREE.Color(tone.color);
    const distance = (target.r - sample.r) ** 2 + (target.g - sample.g) ** 2 + (target.b - sample.b) ** 2;
    if (distance < score) {
      score = distance;
      best = tone;
    }
  }
  return best;
}

function skinFactor(requested: string, baked: string) {
  const target = new THREE.Color(requested);
  const base = new THREE.Color(baked);
  const channel = (value: number, origin: number) => THREE.MathUtils.clamp(origin < 0.04 ? 1 : value / origin, 0.62, 1.4);
  return new THREE.Color(channel(target.r, base.r), channel(target.g, base.g), channel(target.b, base.b));
}

/** Clone the artist rig, keep the selected garments, and tint them with the saved colors. */
export function bindHumanoid(source: THREE.Object3D, config: CharacterConfig): HumanoidModel {
  const covered = coveredRegions(config);
  const rig = SkeletonUtils.clone(source) as THREE.Group;
  rig.name = "humanoid";
  const skinTone = nearestSkin(config.body.color);
  const skinMaps = new Map<string, THREE.Texture>();
  rig.traverse((node) => {
    if (!node.name.startsWith("skintex_")) return;
    const mesh = node as THREE.Mesh;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (material && "map" in material && material.map instanceof THREE.Texture) skinMaps.set(node.name, material.map);
  });
  const visible = showSet(config, covered);
  const drop = new Set<THREE.Object3D>();
  rig.traverse((node) => {
    if (node.name.startsWith("skintex_")) drop.add(node);
    if (OPTIONAL_NODES.includes(node.name) && !visible.has(node.name)) drop.add(node);
  });
  for (const node of drop) node.removeFromParent();

  const rename: Record<string, string> = {};
  if (config.slots.top.item === "jacket") rename.top_coat_0 = "jacket";
  if (config.slots.top.item === "hoodie") rename.top_coat_0 = "hoodie";
  if (config.slots.bottom.item === "pants" || config.slots.bottom.item === "overalls") rename.bottom_pants = "pants";
  if (config.slots.bottom.item === "shorts") rename.bottom_shorts = "shorts";
  if (config.slots.bottom.item === "skirt") rename.bottom_skirt = "skirt";
  for (const [from, to] of Object.entries(rename)) {
    for (const node of nodesNamed(rig, from)) node.name = to;
  }

  const meshes: THREE.SkinnedMesh[] = [];
  rig.traverse((node) => {
    const mesh = node as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    meshes.push(mesh);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const cloned = list.map((material) => material.clone());
    mesh.material = cloned.length === 1 ? cloned[0]! : cloned;
    if (garmentMesh(mesh.name)) sealGarment(mesh);
  });
  const skeleton = meshes[0]?.skeleton;
  if (skeleton) {
    rig.updateMatrixWorld(true);
    for (const mesh of meshes) mesh.bind(skeleton, mesh.bindMatrix);
  }

  const skinMap = skinTone ? skinMaps.get(skinTone.name) : undefined;
  const tone = skinTone && skinMap ? skinFactor(config.body.color, skinTone.color) : null;
  for (const mesh of meshes) {
    if (mesh.name === "eyes" || mesh.name === "teeth") continue;
    if (mesh.name === "brows" || mesh.name.startsWith("hair_")) tint(mesh, config.slots.hair.color);
    else if (mesh.name === "glasses") tint(mesh, config.slots.accessory.color);
    else if (SKIN_MESHES.has(mesh.name)) {
      if (skinMap && tone) {
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of list) {
          if (material && "map" in material) material.map = skinMap;
          if (material && "color" in material && material.color instanceof THREE.Color) material.color.copy(tone);
        }
      } else tint(mesh, config.body.color);
    }
    else if (mesh.name === "hat_hood" || mesh.name.startsWith("hat_")) tint(mesh, config.slots.headwear.color);
    else if (mesh.name.startsWith("top_") || mesh.name === "jacket" || mesh.name === "hoodie" || mesh.name === config.slots.top.item) tint(mesh, config.slots.top.color);
    else if (mesh.name.startsWith("bottom_") || mesh.name === "pants" || mesh.name === "shorts" || mesh.name === "skirt" || mesh.name === "base_briefs") tint(mesh, config.slots.bottom.color);
    else if (mesh.name.startsWith("shoes_")) tint(mesh, config.slots.shoes.color);
  }

  const regions = ["head", "hands"];
  for (const region of ["chest", "abdomen", "neck", "pelvis", "upperArmL", "lowerArmL", "upperArmR", "lowerArmR", "upperLegL", "lowerLegL", "upperLegR", "lowerLegR", "footL", "footR"]) {
    if (!covered.has(region)) regions.push(region);
  }
  const body = rig.getObjectByName("body");
  if (body) body.userData.regions = regions;

  const [build, height] = morphInfluences(config.body.shape);
  const fit = (HUMANOID_HEIGHT / asset.height) * sizeScale(config.body.size);
  rig.scale.set(fit * (1 + build * 0.08), fit * (1 + height * 0.06), fit * (1 + build * 0.08));
  rig.position.y = -asset.minY * rig.scale.y;
  rig.updateMatrixWorld(true);

  const active = new Set(springBoneNames(config));
  const springs: SpringBone[] = [];
  rig.traverse((node) => {
    if (!(node instanceof THREE.Bone) || !BONE_NAMES.includes(node.name as HumanoidBone) || !active.has(node.name as HumanoidBone)) return;
    springs.push({ bone: node, rest: node.position.clone(), previous: node.getWorldPosition(new THREE.Vector3()) });
  });

  return {
    rig,
    springs,
    covered,
    dispose() {
      rig.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of mats) material?.dispose();
      });
    },
  };
}

export function createHumanoid(config: CharacterConfig): HumanoidModel {
  if (!template) throw new Error("Humanoid template is not loaded");
  return bindHumanoid(template.scene, config);
}
