/**
 * In-world Office You for the locked glam look only. Sculpted oval face,
 * smoky almond eyes, layered plum waves, a fitted pink top, a teal pencil
 * skirt, and pink lace-up boots. No headphones and no photo card on the face.
 * Roster bots stay on the MakeHuman rig. Clips are posed in poseGlamRig.
 */

import * as THREE from "three";

export const GLAM_HEIGHT = 1.74;

export const GLAM_POSES = ["idle", "walk", "wave", "sit"] as const;
export type GlamPose = (typeof GLAM_POSES)[number];

const SKIN = "#f3c4a4";
const HAIR = "#7a3496";
const HAIR_MID = "#8d48aa";
const HAIR_DEEP = "#4e206c";
const HAIR_LIGHT = "#c49ad4";
const TOP = "#e4548c";
const TOP_SHADE = "#c43774";
const SKIRT = "#3c7f98";
const SKIRT_SHADE = "#2f657c";
const BOOT = "#e23878";
const LIP = "#e7a0aa";
const BROW = "#2c2426";
const LINER = "#140e16";
const JEWEL = "#f4f1ec";

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

const HIP_Y = 1.04;
const THIGH = 0.47;
const SHIN = 0.43;

function material(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.02,
    ...extra,
  });
}

function gloss(color: string, extra: THREE.MeshPhysicalMaterialParameters = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.32,
    metalness: 0.08,
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
    ...extra,
  });
}

function latheLimb(name: string, radii: number[], length: number, surface: THREE.Material, capScale = 0.4) {
  const points = radii.map(
    (radius, index) => new THREE.Vector2(Math.max(0.008, radius), -length * (index / (radii.length - 1))),
  ).reverse();
  const joint = new THREE.Group();
  joint.name = name;
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(points, 28), surface);
  mesh.name = `${name}-mesh`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  joint.add(mesh);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(radii[0] * capScale, 16, 10), surface);
  cap.castShadow = true;
  joint.add(cap);
  const endRadius = radii[radii.length - 1];
  const endCap = new THREE.Mesh(new THREE.CircleGeometry(endRadius * 0.98, 18), surface);
  endCap.rotation.x = -Math.PI / 2;
  endCap.position.y = -length + 0.001;
  joint.add(endCap);
  return joint;
}

/** Hair card with a lighter center stripe so a wave reads as a lock, not a tube. */
function ribbon(
  points: [number, number, number][],
  width: number,
  base: string,
  highlight: string,
  surface: THREE.Material,
) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const steps = 32;
  const baseColor = new THREE.Color(base);
  const midColor = new THREE.Color(highlight);
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const widthDir = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    widthDir.set(0, 0, 1).cross(tangent);
    if (widthDir.lengthSq() < 1e-6) widthDir.set(1, 0, 0).cross(tangent);
    widthDir.normalize();
    const half = width * (0.45 + 0.55 * Math.sin(t * Math.PI));
    normal.copy(tangent).cross(widthDir).normalize();
    for (const side of [-1, 0, 1]) {
      positions.push(point.x + widthDir.x * half * side, point.y + widthDir.y * half * side, point.z + widthDir.z * half * side);
      normals.push(normal.x, normal.y, normal.z);
      const tone = side === 0 ? midColor : baseColor;
      colors.push(tone.r, tone.g, tone.b);
      uvs.push(side * 0.5 + 0.5, t);
    }
  }
  for (let i = 0; i < steps; i += 1) {
    const offset = i * 3;
    indices.push(offset, offset + 3, offset + 1, offset + 1, offset + 3, offset + 4);
    indices.push(offset + 1, offset + 4, offset + 2, offset + 2, offset + 4, offset + 5);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Back-only hair mass. The arc stays on -Z so it cannot become a wall over the face. */
function hairCape(surface: THREE.Material, scale = 1, zBias = 0) {
  const geometry = new THREE.CylinderGeometry(0.08 * scale, 0.125 * scale, 0.58, 30, 16, true, Math.PI * 0.58, Math.PI * 0.84);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const sway = Math.sin(y * 13 + x * 9) * 0.012 * scale;
    position.setXYZ(i, x + sway, y, Math.min(z, -0.02) + zBias);
  }
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.position.set(0, -0.2, -0.045);
  mesh.castShadow = true;
  return mesh;
}

function wave(
  x: number,
  z: number,
  xAmp: number,
  zAmp: number,
  y0: number,
  y1: number,
  phase: number,
  count = 7,
): [number, number, number][] {
  const points: [number, number, number][] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const sway = Math.sin(t * Math.PI * 2.15 + phase);
    points.push([
      x + sway * xAmp + t * x * 0.25,
      y0 + (y1 - y0) * t,
      z + Math.cos(t * Math.PI * 1.7 + phase) * zAmp,
    ]);
  }
  return points;
}

/** Painted iris. Stays on the eye mesh so the close-up is not a flat face card. */
function irisTexture() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = ((x + 0.5) / size) * 2 - 1;
      const v = ((y + 0.5) / size) * 2 - 1;
      const dist = Math.hypot(u, v);
      const index = (y * size + x) * 4;
      if (dist > 1) continue;
      const angle = Math.atan2(v, u);
      const fiber = 0.9 + 0.1 * Math.sin(angle * 4);
      let red = 86;
      let green = 34;
      let blue = 72;
      if (dist < 0.2) {
        red = 10;
        green = 6;
        blue = 14;
      } else if (dist < 0.38) {
        red = 118 * fiber;
        green = 36;
        blue = 86;
      } else if (dist < 0.58) {
        red = 156 * fiber;
        green = 52;
        blue = 104;
      } else if (dist < 0.8) {
        red = 96;
        green = 34;
        blue = 70;
      } else {
        red = 24;
        green = 10;
        blue = 28;
      }
      if (Math.hypot(u - 0.24, v - 0.22) < 0.07) {
        red = 255;
        green = 250;
        blue = 255;
      }
      if (Math.hypot(u + 0.18, v + 0.14) < 0.03) {
        red = 214;
        green = 196;
        blue = 214;
      }
      data[index] = red;
      data[index + 1] = green;
      data[index + 2] = blue;
      data[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function fashionSkull() {
  const geometry = new THREE.SphereGeometry(1, 64, 48);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const skin = new THREE.Color(SKIN);
  const blush = new THREE.Color("#e8a08a");
  const contour = new THREE.Color("#d09a7c");
  const shade = new THREE.Color("#c9957e");
  for (let i = 0; i < position.count; i += 1) {
    let x = position.getX(i);
    let y = position.getY(i);
    let z = position.getZ(i);
    x *= 0.76;
    y *= 1.06;
    z *= 0.9;
    if (y < 0) {
      const taper = THREE.MathUtils.clamp(-y / 1.06, 0, 1);
      y = -Math.pow(taper, 1.35) * 0.55;
      x *= 1 - taper * 0.16;
    }
    const cheek = Math.exp(-((y - 0.08) ** 2) / 0.04) * Math.exp(-((Math.abs(x) - 0.4) ** 2) / 0.035);
    if (z > -0.05) {
      x += Math.sign(x || 1) * cheek * 0.1;
      z += cheek * 0.045;
    }
    const hollow = Math.exp(-((y + 0.1) ** 2) / 0.028) * Math.exp(-((Math.abs(x) - 0.32) ** 2) / 0.02);
    if (z > 0) z -= hollow * 0.04;
    if (y > 0.32 && y < 0.55 && z > 0.05) z += 0.03;
    for (const side of [-1, 1]) {
      const dx = x - side * 0.28;
      const dy = y - 0.12;
      const socket = dx * dx * 2.1 + dy * dy * 1.5;
      if (socket < 0.04 && z > 0) z -= (0.04 - socket) * 0.22;
    }
    if (Math.abs(x) < 0.07 && y > -0.02 && y < 0.18 && z > 0.12) z += 0.035;
    position.setXYZ(i, x, y, z);
    const tone = skin.clone();
    if (cheek > 0.25 && z > 0) tone.lerp(blush, 0.55);
    if (hollow > 0.2) tone.lerp(contour, 0.45);
    if (y < -0.35) tone.lerp(shade, 0.28);
    if (y > 0.15 && y < 0.4 && Math.abs(x) > 0.28 && z > 0) tone.lerp(contour, 0.2);
    colors[i * 3] = tone.r;
    colors[i * 3 + 1] = tone.g;
    colors[i * 3 + 2] = tone.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.scale(0.074, 0.074, 0.074);
  return geometry;
}

function eye(side: number, irisMap: THREE.Texture, skinMat: THREE.Material, linerMat: THREE.Material, browMat: THREE.Material) {
  const root = new THREE.Group();
  root.name = side < 0 ? "eyeL" : "eyeR";
  root.position.set(side * 0.022, 0.008, 0.074);
  root.rotation.z = side * -0.12;

  const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.012, 24, 16), material("#fffaf8", { roughness: 0.24 }));
  sclera.scale.set(1.7, 0.62, 0.32);
  root.add(sclera);

  const irisMat = gloss("#ffffff", { map: irisMap, roughness: 0.2, metalness: 0.02, clearcoat: 0.45, clearcoatRoughness: 0.22 });
  const iris = new THREE.Mesh(new THREE.CircleGeometry(0.0092, 36), irisMat);
  iris.name = "iris";
  iris.position.z = 0.0046;
  iris.scale.y = 0.92;
  root.add(iris);

  const catchlight = new THREE.Mesh(new THREE.CircleGeometry(0.0013, 8), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
  catchlight.position.set(-0.0022, 0.0018, 0.0054);
  root.add(catchlight);

  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.012, 18, 12), skinMat);
  lid.scale.set(1.72, 0.22, 0.28);
  lid.position.set(0, 0.0062, 0.001);
  root.add(lid);

  const liner = new THREE.Mesh(new THREE.TorusGeometry(0.0105, 0.00045, 4, 12, Math.PI * 0.7), linerMat);
  liner.rotation.set(1.35, 0, side * 0.15);
  liner.position.set(0.001, 0.0042, 0.0048);
  root.add(liner);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.0008, 0.0008), linerMat);
  wing.rotation.z = side * -0.35;
  wing.position.set(side * 0.012, 0.0032, 0.005);
  root.add(wing);

  const brow = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.00055, 4, 10, Math.PI * 0.55), browMat);
  brow.rotation.set(1.15, 0, side * -0.35);
  brow.position.set(side * 0.002, 0.011, 0.004);
  root.add(brow);
  return root;
}

function lipMesh(lipMat: THREE.Material) {
  const upper = new THREE.Shape();
  upper.moveTo(-0.02, 0);
  upper.quadraticCurveTo(-0.01, 0.01, 0, 0.0035);
  upper.quadraticCurveTo(0.01, 0.01, 0.02, 0);
  upper.quadraticCurveTo(0, -0.003, -0.02, 0);
  const lower = new THREE.Shape();
  lower.moveTo(-0.022, 0);
  lower.quadraticCurveTo(0, -0.014, 0.022, 0);
  lower.quadraticCurveTo(0, 0.004, -0.022, 0);
  const group = new THREE.Group();
  group.name = "lips";
  const extrude = { depth: 0.005, bevelEnabled: true, bevelThickness: 0.0016, bevelSize: 0.0016, bevelSegments: 2 };
  const topLip = new THREE.Mesh(new THREE.ExtrudeGeometry(upper, extrude), lipMat);
  topLip.position.set(0, -0.016, 0.05);
  const bottomLip = new THREE.Mesh(new THREE.ExtrudeGeometry(lower, extrude), lipMat);
  bottomLip.position.set(0, -0.024, 0.049);
  group.add(topLip, bottomLip);
  return group;
}

function boot(name: string, surface: THREE.Material, laceMat: THREE.Material, shade: THREE.Material) {
  const joint = new THREE.Group();
  joint.name = name;
  const shaft = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.032, 0.0),
    new THREE.Vector2(0.036, 0.03),
    new THREE.Vector2(0.034, 0.055),
  ], 20), surface);
  shaft.castShadow = true;
  joint.add(shaft);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.0035, 8, 18), shade);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = 0.052;
  joint.add(cuff);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.028, 0.1), surface);
  foot.position.set(0, -0.012, 0.032);
  foot.castShadow = true;
  joint.add(foot);
  const toe = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.055, 12), surface);
  toe.rotation.x = Math.PI / 2;
  toe.position.set(0, -0.016, 0.1);
  toe.castShadow = true;
  joint.add(toe);
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.007, 0.13), shade);
  sole.position.set(0, -0.03, 0.035);
  joint.add(sole);
  const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.003, 0.085, 8), surface);
  heel.position.set(0, -0.07, -0.018);
  heel.castShadow = true;
  joint.add(heel);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.004, 0.024), shade);
  tip.position.set(0, -0.11, -0.018);
  joint.add(tip);
  for (let i = 0; i < 4; i += 1) {
    const y = 0.02 - i * 0.014;
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.0024, 0.0022), laceMat);
    left.rotation.z = 0.65;
    left.position.set(0, y, 0.038);
    left.name = "lace";
    const right = left.clone();
    right.rotation.z = -0.65;
    right.position.z = 0.039;
    right.name = "lace";
    joint.add(left, right);
  }
  return joint;
}

function fashionHand(skinMat: THREE.Material) {
  const root = new THREE.Group();
  root.name = "hand";
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 10), skinMat);
  palm.scale.set(0.85, 1.25, 0.48);
  palm.position.y = -0.012;
  palm.castShadow = true;
  root.add(palm);
  for (let i = 0; i < 4; i += 1) {
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.0032, 0.02, 3, 6), skinMat);
    finger.position.set(-0.009 + i * 0.006, -0.04, 0.002);
    finger.rotation.x = 0.15;
    root.add(finger);
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0038, 0.014, 3, 6), skinMat);
  thumb.rotation.z = 0.85;
  thumb.position.set(0.014, -0.016, 0.006);
  root.add(thumb);
  return root;
}

/** Build the locked glam figure. Feet rest near y=0. She faces +Z. */
export function createGlamRig() {
  const skin = material(SKIN, { roughness: 0.62 });
  const skinFace = material("#ffffff", { roughness: 0.58, vertexColors: true });
  const top = material(TOP, { roughness: 0.5 });
  const topShade = material(TOP_SHADE, { roughness: 0.55 });
  const skirtMat = material(SKIRT, { roughness: 0.55 });
  const skirtShade = material(SKIRT_SHADE, { roughness: 0.6 });
  const bootMat = gloss(BOOT, {
    roughness: 0.28,
    metalness: 0.12,
    clearcoat: 0.62,
    clearcoatRoughness: 0.28,
    emissive: "#6a1840",
    emissiveIntensity: 0.18,
  });
  const bootShade = material("#c42d68", { roughness: 0.4 });
  const lace = material("#f6e4ea", { roughness: 0.35 });
  const jewel = gloss(JEWEL, {
    roughness: 0.15,
    metalness: 0.35,
    clearcoat: 0.7,
    clearcoatRoughness: 0.2,
    emissive: "#f7f4ef",
    emissiveIntensity: 0.35,
  });
  const linerMat = material(LINER, { roughness: 0.4 });
  const browMat = material(BROW, { roughness: 0.55 });
  const lipMat = gloss(LIP, { roughness: 0.22, metalness: 0.04, clearcoat: 0.7, clearcoatRoughness: 0.18 });
  const hairMat = material(HAIR, { roughness: 0.4, metalness: 0.06 });
  const hairCard = material("#ffffff", {
    roughness: 0.4,
    metalness: 0.06,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  const irisMap = irisTexture();

  const rig = new THREE.Group();
  rig.name = "glam-rig";

  const hips = new THREE.Group();
  hips.name = "hips";
  hips.position.y = HIP_Y;
  rig.add(hips);

  const skirt = new THREE.Group();
  skirt.name = "skirt";
  const skirtMesh = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.118, -0.2),
    new THREE.Vector2(0.116, -0.1),
    new THREE.Vector2(0.112, 0),
    new THREE.Vector2(0.108, 0.1),
    new THREE.Vector2(0.102, 0.2),
  ], 32), skirtMat);
  skirtMesh.position.y = -0.12;
  skirtMesh.castShadow = true;
  skirtMesh.receiveShadow = true;
  skirt.add(skirtMesh);
  const waistband = new THREE.Mesh(new THREE.CylinderGeometry(0.104, 0.108, 0.03, 24), skirtShade);
  waistband.position.y = 0.06;
  skirt.add(waistband);
  const skirtSeam = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.3, 0.005), skirtShade);
  skirtSeam.position.set(0.08, -0.16, 0.07);
  skirt.add(skirtSeam);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.004, 6, 28), skirtShade);
  hem.rotation.x = Math.PI / 2;
  hem.position.y = -0.32;
  skirt.add(hem);
  hips.add(skirt);

  const thighL = latheLimb("thighL", [0.048, 0.046, 0.04, 0.032], THIGH, skin, 0.22);
  const thighR = latheLimb("thighR", [0.048, 0.046, 0.04, 0.032], THIGH, skin, 0.22);
  thighL.position.x = 0.05;
  thighR.position.x = -0.05;
  hips.add(thighL, thighR);

  const shinL = latheLimb("shinL", [0.034, 0.038, 0.03, 0.022], SHIN, skin, 1.05);
  const shinR = latheLimb("shinR", [0.034, 0.038, 0.03, 0.022], SHIN, skin, 1.05);
  shinL.position.y = -THIGH;
  shinR.position.y = -THIGH;
  thighL.add(shinL);
  thighR.add(shinR);

  const bootL = boot("bootL", bootMat, lace, bootShade);
  const bootR = boot("bootR", bootMat, lace, bootShade);
  bootL.position.y = -SHIN;
  bootR.position.y = -SHIN;
  shinL.add(bootL);
  shinR.add(bootR);

  const chest = new THREE.Group();
  chest.name = "chest";
  chest.position.y = 0.16;
  hips.add(chest);

  const torso = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.1, -0.22),
    new THREE.Vector2(0.078, -0.08),
    new THREE.Vector2(0.072, -0.02),
    new THREE.Vector2(0.084, 0.03),
    new THREE.Vector2(0.1, 0.08),
    new THREE.Vector2(0.096, 0.12),
    new THREE.Vector2(0.092, 0.155),
    new THREE.Vector2(0.104, 0.19),
  ], 40), top);
  torso.name = "top";
  torso.scale.z = 0.76;
  torso.position.y = 0.02;
  torso.castShadow = true;
  torso.receiveShadow = true;
  chest.add(torso);
  for (const side of [-1, 1]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.0045, 0.17, 0.004), topShade);
    seam.position.set(side * 0.078, 0.09, 0.05);
    seam.rotation.z = side * -0.18;
    chest.add(seam);
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.046, 18, 12), top);
    shoulder.scale.set(1, 0.85, 0.8);
    shoulder.position.set(side * 0.112, 0.17, 0);
    shoulder.castShadow = true;
    chest.add(shoulder);
  }
  const neckline = new THREE.Mesh(new THREE.SphereGeometry(0.05, 18, 12), skin);
  neckline.scale.set(1.35, 0.42, 0.55);
  neckline.position.set(0, 0.195, 0.03);
  chest.add(neckline);
  const frontSeam = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.15, 0.004), topShade);
  frontSeam.position.set(0, 0.08, 0.084);
  chest.add(frontSeam);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.038, 0.08, 16), skin);
  neck.position.y = 0.21;
  neck.castShadow = true;
  chest.add(neck);

  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.0018, 6, 24), jewel);
  chain.rotation.x = Math.PI / 2.35;
  chain.position.set(0, 0.185, 0.04);
  chest.add(chain);
  const pendant = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 10), jewel);
  pendant.name = "pendant";
  pendant.scale.set(0.55, 1.15, 0.35);
  pendant.position.set(0, 0.155, 0.072);
  chest.add(pendant);

  const head = new THREE.Group();
  head.name = "head";
  head.position.y = 0.3;
  chest.add(head);

  const skull = new THREE.Mesh(fashionSkull(), skinFace);
  skull.name = "face";
  skull.castShadow = true;
  head.add(skull);
  head.add(eye(-1, irisMap, skin, linerMat, browMat), eye(1, irisMap, skin, linerMat, browMat));

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 12, 8), skin);
  nose.name = "nose";
  nose.scale.set(0.55, 0.7, 0.6);
  nose.position.set(0, -0.002, 0.058);
  head.add(nose);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.014, 0.003), skin);
  bridge.position.set(0, 0.008, 0.055);
  head.add(bridge);
  head.add(lipMesh(lipMat));
  for (const side of [-1, 1]) {
    const blush = new THREE.Mesh(
      new THREE.CircleGeometry(0.014, 16),
      new THREE.MeshBasicMaterial({ color: "#e7a090", transparent: true, opacity: 0.38, depthWrite: false }),
    );
    blush.position.set(side * 0.034, -0.012, 0.062);
    head.add(blush);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.0032, 0.0006, 4, 8), jewel);
    hook.position.set(side * 0.05, 0.002, -0.01);
    head.add(hook);
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.005, 12, 8), jewel);
    drop.name = "earring";
    drop.scale.set(0.42, 1.55, 0.28);
    drop.position.set(side * 0.052, -0.008, -0.004);
    head.add(drop);
  }

  const hair = new THREE.Group();
  hair.name = "hair";
  head.add(hair);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.055, 28, 18), hairMat);
  crown.scale.set(1.2, 0.55, 0.85);
  crown.position.set(0, 0.046, -0.042);
  crown.castShadow = true;
  hair.add(crown);
  hair.add(hairCape(hairMat));
  hair.add(hairCape(material(HAIR_MID, { roughness: 0.45 }), 1.05, -0.02));

  const backTones = [HAIR_DEEP, HAIR, HAIR_MID, HAIR, HAIR_DEEP, HAIR_MID, HAIR, HAIR_DEEP, HAIR, HAIR_MID];
  backTones.forEach((tone, index) => {
    const side = (index - 4.5) / 4.5;
    const depth = index % 2 === 0 ? -0.07 : -0.1;
    hair.add(ribbon(
      wave(side * 0.09, depth, 0.032, 0.012, 0.05, -0.52, index * 0.85),
      0.062,
      tone,
      HAIR_LIGHT,
      hairCard,
    ));
  });
  for (const side of [-1, 1]) {
    hair.add(ribbon([
      [side * 0.055, 0.04, -0.01],
      [side * 0.09, -0.02, -0.02],
      [side * 0.12, -0.22, -0.04],
      [side * 0.1, -0.42, -0.05],
    ], 0.034, HAIR_MID, HAIR_LIGHT, hairCard));
    hair.add(ribbon(
      wave(side * 0.13, -0.05, 0.02, 0.01, 0.02, -0.48, side * 1.1),
      0.04,
      side < 0 ? HAIR : HAIR_DEEP,
      HAIR_LIGHT,
      hairCard,
    ));
  }
  hair.add(ribbon([
    [0.02, 0.05, 0.0],
    [-0.01, 0.038, 0.012],
    [-0.028, 0.028, 0.008],
  ], 0.012, HAIR_DEEP, HAIR_MID, hairCard));
  hair.add(ribbon([
    [-0.02, 0.048, -0.02],
    [0.015, 0.072, -0.03],
    [0.035, 0.046, -0.045],
  ], 0.046, HAIR, HAIR_LIGHT, hairCard));
  hair.add(ribbon([
    [0.015, 0.055, -0.03],
    [-0.02, 0.07, -0.04],
    [-0.04, 0.042, -0.05],
  ], 0.04, HAIR_MID, HAIR_LIGHT, hairCard));

  const armL = latheLimb("armL", [0.038, 0.032, 0.028], 0.28, top);
  const armR = latheLimb("armR", [0.038, 0.032, 0.028], 0.28, top);
  armL.position.set(0.138, 0.15, 0);
  armR.position.set(-0.138, 0.15, 0);
  chest.add(armL, armR);
  const foreL = latheLimb("foreL", [0.028, 0.026, 0.022], 0.25, top);
  const foreR = latheLimb("foreR", [0.028, 0.026, 0.022], 0.25, top);
  foreL.position.y = -0.26;
  foreR.position.y = -0.26;
  armL.add(foreL);
  armR.add(foreR);
  const handL = fashionHand(skin);
  const handR = fashionHand(skin);
  handL.position.y = -0.24;
  handR.position.y = -0.24;
  foreL.add(handL);
  foreR.add(handR);

  const fill = new THREE.PointLight("#fff2ea", 0.42, 2.6, 2);
  fill.position.set(0.1, 1.35, 0.75);
  const rim = new THREE.PointLight("#f6e8ff", 0.5, 2.4, 2);
  rim.position.set(-0.15, 1.5, -0.55);
  rig.add(fill, rim);

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
  parts.armR.rotation.x = walk * -swing * 0.45 + sit * -0.4 + Math.max(idleArm, 0) * -0.1;
  parts.armL.rotation.z = walk * 0.12 + sit * 0.18 + wave * 0.25 + Math.max(idleArm, 0) * 0.12;
  parts.armR.rotation.z = walk * -0.12 + sit * -0.2 + Math.max(idleArm, 0) * -0.75;
  parts.foreL.rotation.x = wave * (0.35 + Math.sin(time * 9) * 0.35) + sit * 0.8 + Math.max(idleArm, 0) * 0.12;
  parts.foreR.rotation.x = sit * 0.85 + Math.max(idleArm, 0) * 0.8 + walk * 0.15;
  parts.foreL.rotation.z = wave * 0.2;
  parts.foreR.rotation.z = Math.max(idleArm, 0) * 1.9;
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
    const textured = item as THREE.MeshStandardMaterial;
    textured.map?.dispose();
    item.dispose();
  });
}
