/**
 * In-world Office You. A rigged fashion figure in the locked glam colors:
 * plum waves, a narrow face, smoky almond eyes, a pink top, a teal pencil
 * skirt, and pink lace-up boots. No headphones. Roster bots stay on the
 * MakeHuman rig. This figure is the hero, and the clips are posed here.
 */

import * as THREE from "three";

export const GLAM_HEIGHT = 1.74;

export const GLAM_POSES = ["idle", "walk", "wave", "sit"] as const;
export type GlamPose = (typeof GLAM_POSES)[number];

const SKIN = "#f0c0a4";
const HAIR = "#7a3494";
const HAIR_DEEP = "#54206c";
const TOP = "#e4548c";
const SKIRT = "#3d7e96";
const BOOT = "#e23b78";
const LIP = "#e59aaa";
const IRIS = "#b07ac8";
const LINER = "#1c1224";
const BROW = "#3a2a28";
const JEWEL = "#f7f4ef";

export type GlamParts = {
  hips: THREE.Group;
  thighL: THREE.Group;
  thighR: THREE.Group;
  shinL: THREE.Group;
  shinR: THREE.Group;
  bootL: THREE.Group;
  bootR: THREE.Group;
  chest: THREE.Group;
  head: THREE.Group;
  hair: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  foreL: THREE.Group;
  foreR: THREE.Group;
  skirt: THREE.Group;
};

const HIP_Y = 0.98;

function material(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.58,
    metalness: 0.02,
    ...extra,
  });
}

const outlineMaterial = new THREE.MeshBasicMaterial({ color: "#241820", side: THREE.BackSide });

function shell(mesh: THREE.Mesh, scale = 1.06) {
  const wrap = new THREE.Mesh(mesh.geometry, outlineMaterial);
  wrap.name = "outline";
  wrap.scale.setScalar(scale);
  wrap.castShadow = false;
  wrap.raycast = () => {};
  mesh.add(wrap);
}

function limb(name: string, radius: number, length: number, surface: THREE.Material, outlined = true) {
  const joint = new THREE.Group();
  joint.name = name;
  const shaft = Math.max(0.02, length - radius * 2);
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, shaft, 4, 10), surface);
  mesh.name = `${name}-mesh`;
  mesh.position.y = -length / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (outlined) shell(mesh, 1.045);
  joint.add(mesh);
  return joint;
}

function strand(points: [number, number, number][], radius: number, surface: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, radius, 6, false), surface);
  mesh.castShadow = true;
  shell(mesh, 1.08);
  return mesh;
}

function eye(side: number, skin: THREE.Material) {
  const root = new THREE.Group();
  root.name = side < 0 ? "eyeL" : "eyeR";
  root.position.set(side * 0.038, 0.018, 0.078);

  const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.026, 14, 10), material("#fbf7f4", { roughness: 0.35 }));
  sclera.scale.set(1.45, 0.5, 0.42);
  root.add(sclera);

  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 8), material(IRIS, { roughness: 0.28 }));
  iris.position.set(0, -0.002, 0.014);
  iris.scale.set(1, 1.15, 0.65);
  root.add(iris);

  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), material("#140c12", { roughness: 0.2 }));
  pupil.position.set(0, -0.001, 0.024);
  root.add(pupil);

  const catchLight = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 6, 4), material("#ffffff", { roughness: 0.1 }));
  catchLight.position.set(side * 0.005, 0.006, 0.028);
  root.add(catchLight);

  const liner = new THREE.Mesh(
    new THREE.TorusGeometry(0.03, 0.007, 6, 18, Math.PI * 1.2),
    material(LINER, { roughness: 0.4 }),
  );
  liner.rotation.z = Math.PI * 0.9;
  liner.rotation.x = -0.4;
  liner.position.set(0, 0.004, 0.012);
  liner.scale.set(1.25, 0.62, 1);
  root.add(liner);

  const shadow = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), material("#4e3454", { roughness: 0.7 }));
  shadow.scale.set(1.35, 0.32, 0.4);
  shadow.position.set(0, 0.018, 0.008);
  root.add(shadow);

  const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.005, 0.04, 3, 6), material(BROW, { roughness: 0.55 }));
  brow.rotation.z = side * -0.45 + Math.PI / 2;
  brow.position.set(side * 0.004, 0.042, 0.012);
  root.add(brow);

  // Keep the socket from floating off the skull.
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), skin);
  lid.scale.set(1.4, 0.35, 0.4);
  lid.position.set(0, -0.02, 0.008);
  root.add(lid);
  return root;
}

function boot(name: string, surface: THREE.Material, lace: THREE.Material) {
  const joint = new THREE.Group();
  joint.name = name;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.042, 0.13, 12), surface);
  shaft.position.y = -0.02;
  shaft.castShadow = true;
  shell(shaft, 1.04);
  joint.add(shaft);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.05, 0.15), surface);
  foot.position.set(0, -0.09, 0.045);
  foot.castShadow = true;
  shell(foot, 1.04);
  joint.add(foot);
  const toe = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), surface);
  toe.scale.set(1.05, 0.7, 1.2);
  toe.position.set(0, -0.09, 0.11);
  toe.castShadow = true;
  joint.add(toe);
  const heel = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.12, 0.028), surface);
  heel.position.set(0, -0.155, -0.02);
  heel.castShadow = true;
  joint.add(heel);
  for (let i = 0; i < 3; i += 1) {
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.006, 0.008), lace);
    tie.name = "lace";
    tie.position.set(0, 0.02 - i * 0.028, 0.044);
    joint.add(tie);
  }
  return joint;
}

/** Build the locked glam figure. Feet rest on y=0. She faces +Z. */
export function createGlamRig() {
  const skin = material(SKIN, { roughness: 0.62 });
  const hairMat = material(HAIR, { roughness: 0.42 });
  const hairDeep = material(HAIR_DEEP, { roughness: 0.5 });
  const top = material(TOP, { roughness: 0.52 });
  const skirtMat = material(SKIRT, { roughness: 0.55 });
  const bootMat = material(BOOT, { roughness: 0.38, metalness: 0.04 });
  const lace = material(JEWEL, { roughness: 0.25, metalness: 0.35 });
  const lip = material(LIP, { roughness: 0.35 });
  const jewel = material(JEWEL, { roughness: 0.15, metalness: 0.65 });

  const rig = new THREE.Group();
  rig.name = "glam-rig";

  const hips = new THREE.Group();
  hips.name = "hips";
  hips.position.y = HIP_Y;
  rig.add(hips);

  const skirt = new THREE.Group();
  skirt.name = "skirt";
  const skirtMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.132, 0.3, 18), skirtMat);
  skirtMesh.position.y = -0.12;
  skirtMesh.castShadow = true;
  skirtMesh.receiveShadow = true;
  shell(skirtMesh, 1.03);
  skirt.add(skirtMesh);
  hips.add(skirt);

  const thighL = limb("thighL", 0.055, 0.4, skin);
  const thighR = limb("thighR", 0.055, 0.4, skin);
  thighL.position.x = 0.07;
  thighR.position.x = -0.07;
  hips.add(thighL, thighR);

  const shinL = limb("shinL", 0.042, 0.38, skin);
  const shinR = limb("shinR", 0.042, 0.38, skin);
  shinL.position.y = -0.4;
  shinR.position.y = -0.4;
  thighL.add(shinL);
  thighR.add(shinR);

  const bootL = boot("bootL", bootMat, lace);
  const bootR = boot("bootR", bootMat, lace);
  bootL.position.y = -0.38;
  bootR.position.y = -0.38;
  shinL.add(bootL);
  shinR.add(bootR);

  const chest = new THREE.Group();
  chest.name = "chest";
  chest.position.y = 0.16;
  hips.add(chest);

  const torso = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.072, -0.06),
    new THREE.Vector2(0.09, 0.0),
    new THREE.Vector2(0.118, 0.07),
    new THREE.Vector2(0.1, 0.14),
    new THREE.Vector2(0.125, 0.2),
  ], 18), top);
  torso.name = "top";
  torso.scale.z = 0.82;
  torso.position.y = 0.02;
  torso.castShadow = true;
  torso.receiveShadow = true;
  shell(torso, 1.04);
  chest.add(torso);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.046, 0.08, 10), skin);
  neck.position.y = 0.22;
  neck.castShadow = true;
  chest.add(neck);

  const pendant = new THREE.Mesh(new THREE.OctahedronGeometry(0.016, 0), jewel);
  pendant.name = "pendant";
  pendant.position.set(0, 0.16, 0.09);
  chest.add(pendant);
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.004, 6, 16), jewel);
  chain.rotation.x = Math.PI / 2;
  chain.position.y = 0.2;
  chest.add(chain);

  const head = new THREE.Group();
  head.name = "head";
  head.position.y = 0.36;
  chest.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.108, 24, 18), skin);
  skull.name = "face";
  skull.scale.set(0.76, 1.14, 0.88);
  skull.castShadow = true;
  head.add(skull);
  head.add(eye(-1, skin), eye(1, skin));

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), skin);
  nose.name = "nose";
  nose.scale.set(0.7, 1.15, 1.15);
  nose.position.set(0, -0.006, 0.092);
  head.add(nose);

  const upperLip = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 8), lip);
  upperLip.name = "lips";
  upperLip.scale.set(1.25, 0.38, 0.5);
  upperLip.position.set(0, -0.048, 0.086);
  head.add(upperLip);
  const lowerLip = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 8), lip);
  lowerLip.name = "lips";
  lowerLip.scale.set(1.1, 0.48, 0.48);
  lowerLip.position.set(0, -0.064, 0.082);
  head.add(lowerLip);

  for (const side of [-1, 1]) {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), jewel);
    drop.name = "earring";
    drop.scale.set(0.7, 1.25, 0.45);
    drop.position.set(side * 0.09, -0.02, 0.02);
    head.add(drop);
  }

  const hair = new THREE.Group();
  hair.name = "hair";
  head.add(hair);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.118, 20, 14), hairMat);
  cap.scale.set(0.98, 1.02, 1.08);
  cap.position.set(0, 0.03, -0.02);
  cap.castShadow = true;
  shell(cap, 1.04);
  hair.add(cap);
  const bang = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), hairDeep);
  bang.scale.set(1.7, 0.45, 0.7);
  bang.position.set(0.01, 0.05, 0.07);
  hair.add(bang);

  const locks: [number, number, number][][] = [
    [[0.02, 0.1, -0.02], [0.05, -0.2, -0.1], [0.0, -0.55, -0.14], [-0.02, -0.9, -0.08]],
    [[-0.06, 0.1, -0.04], [-0.1, -0.25, -0.12], [-0.06, -0.6, -0.16], [-0.02, -0.95, -0.1]],
    [[0.09, 0.08, -0.05], [0.14, -0.28, -0.12], [0.08, -0.62, -0.14], [0.04, -0.92, -0.06]],
    [[-0.12, 0.06, 0.02], [-0.17, -0.25, 0.05], [-0.14, -0.62, 0.02], [-0.1, -0.82, 0.0]],
    [[0.13, 0.07, 0.03], [0.18, -0.22, 0.06], [0.15, -0.58, 0.04], [0.12, -0.8, 0.02]],
  ];
  locks.forEach((points, index) => {
    hair.add(strand(points, index < 3 ? 0.034 : 0.026, index % 2 ? hairDeep : hairMat));
  });

  const armL = limb("armL", 0.04, 0.28, top);
  const armR = limb("armR", 0.04, 0.28, top);
  armL.position.set(0.15, 0.12, 0);
  armR.position.set(-0.15, 0.12, 0);
  chest.add(armL, armR);
  const foreL = limb("foreL", 0.034, 0.26, top);
  const foreR = limb("foreR", 0.034, 0.26, top);
  foreL.position.y = -0.28;
  foreR.position.y = -0.28;
  armL.add(foreL);
  armR.add(foreR);
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), skin);
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), skin);
  handL.scale.set(0.8, 1.05, 0.55);
  handR.scale.set(0.8, 1.05, 0.55);
  handL.position.y = -0.28;
  handR.position.y = -0.28;
  handL.castShadow = true;
  handR.castShadow = true;
  foreL.add(handL);
  foreR.add(handR);

  const parts: GlamParts = {
    hips, thighL, thighR, shinL, shinR, bootL, bootR, chest, head, hair, armL, armR, foreL, foreR, skirt,
  };
  rig.userData.parts = parts;
  poseGlamRig(rig, "idle", 0);
  return rig;
}

export function glamParts(rig: THREE.Object3D): GlamParts {
  return rig.userData.parts as GlamParts;
}

/** Absolute pose. Idle crosses one ankle and sets a hand on the hip. Walk swings opposite limbs. */
export function poseGlamRig(rig: THREE.Object3D, mode: GlamPose, time: number) {
  const parts = glamParts(rig);
  const walk = mode === "walk" ? 1 : 0;
  const wave = mode === "wave" ? 1 : 0;
  const sit = mode === "sit" ? 1 : 0;
  const cycle = time * 6.4;
  const swing = Math.sin(cycle);
  const breathe = Math.sin(time * 1.7);

  parts.hips.position.y = HIP_Y - sit * 0.42 + walk * Math.abs(swing) * 0.03;
  parts.hips.rotation.z = walk * swing * 0.05 + (1 - sit) * (1 - walk) * 0.03;
  parts.hips.rotation.y = walk * swing * 0.06;
  parts.chest.rotation.x = breathe * 0.02 + sit * 0.08;
  parts.chest.position.y = 0.16 + breathe * 0.004;
  parts.head.rotation.y = walk * swing * -0.04 + wave * 0.15;
  parts.head.rotation.z = (1 - walk) * (1 - sit) * Math.sin(time * 0.8) * 0.03;
  parts.hair.rotation.x = breathe * 0.02 + walk * swing * 0.07 + Math.sin(time * 1.3) * 0.02;
  parts.hair.rotation.z = walk * swing * -0.04;
  parts.skirt.rotation.z = walk * swing * -0.06;
  parts.skirt.rotation.x = walk * 0.04 + sit * 0.35;

  const stride = 0.62;
  parts.thighL.rotation.x = THREE.MathUtils.lerp(0.08, -swing * stride, walk) * (1 - sit) + sit * -1.28;
  parts.thighR.rotation.x = THREE.MathUtils.lerp(-0.18, swing * stride, walk) * (1 - sit) + sit * -1.28;
  parts.thighL.rotation.z = (1 - walk) * (1 - sit) * 0.04 + sit * 0.08;
  parts.thighR.rotation.z = (1 - walk) * (1 - sit) * -0.22 + walk * 0.02 + sit * -0.08;
  parts.shinL.rotation.x = (1 - sit) * (walk * Math.max(0, swing) * 0.95 + (1 - walk) * 0.12) + sit * 1.35;
  parts.shinR.rotation.x = (1 - sit) * (walk * Math.max(0, -swing) * 0.95 + (1 - walk) * 0.55) + sit * 1.35;
  parts.bootL.rotation.x = -(parts.thighL.rotation.x + parts.shinL.rotation.x) * (sit ? 0.15 : 0.82);
  parts.bootR.rotation.x = -(parts.thighR.rotation.x + parts.shinR.rotation.x) * (sit ? 0.15 : 0.82);

  const idleArm = 1 - walk - sit - wave;
  parts.armL.rotation.x = walk * swing * 0.45 + sit * -0.35 + wave * -2.35 + Math.max(idleArm, 0) * 0.08;
  parts.armR.rotation.x = walk * -swing * 0.45 + sit * -0.4 + Math.max(idleArm, 0) * -0.2;
  parts.armL.rotation.z = walk * 0.12 + sit * 0.18 + wave * 0.25 + Math.max(idleArm, 0) * 0.12;
  parts.armR.rotation.z = walk * -0.12 + sit * -0.2 + Math.max(idleArm, 0) * -0.45;
  parts.foreL.rotation.x = wave * (0.35 + Math.sin(time * 9) * 0.35) + sit * 0.8 + Math.max(idleArm, 0) * 0.12;
  parts.foreR.rotation.x = sit * 0.85 + Math.max(idleArm, 0) * 1 + walk * 0.15;
  parts.foreL.rotation.z = wave * 0.2;
  parts.foreR.rotation.z = Math.max(idleArm, 0) * 1.5;
}

/** Puts the locked glam face on the head and hides the stand-in features behind it. */
export function mountGlamFace(rig: THREE.Object3D, map: THREE.Texture) {
  const head = glamParts(rig).head;
  head.traverse((node) => {
    if (node.name === "eyeL" || node.name === "eyeR" || node.name === "nose" || node.name === "lips") node.visible = false;
  });
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.3),
    new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: true, toneMapped: false }),
  );
  plate.name = "face-plate";
  plate.position.set(0, -0.02, 0.092);
  head.add(plate);
  return plate;
}

export function disposeGlamRig(rig: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  rig.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const list = mesh.material;
    if (Array.isArray(list)) list.forEach((item) => materials.add(item));
    else if (list) materials.add(list);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((item) => {
    if (item === outlineMaterial) return;
    const textured = item as THREE.MeshStandardMaterial;
    textured.map?.dispose();
    item.dispose();
  });
}
