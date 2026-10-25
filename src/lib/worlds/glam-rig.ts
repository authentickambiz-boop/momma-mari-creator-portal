/**
 * Locked glam Office You. One skinned outfit and one skinned body so the
 * shoulders, elbows, hips, and knees stay connected. Hair is tapered S-curve
 * locks on a scalp cap. Other looks stay on the humanoid rig.
 */

import * as THREE from "three";

export const GLAM_HEIGHT = 1.74;

export const GLAM_POSES = ["idle", "walk", "wave", "sit"] as const;
export type GlamPose = (typeof GLAM_POSES)[number];

const SKIN = "#f3c4a4";
const HAIR = "#7a3496";
const HAIR_MID = "#8d48aa";
const HAIR_DEEP = "#4e206c";
const HAIR_LIGHT = "#c9a0d8";
const TOP = "#e4548c";
const TOP_SHADE = "#c43774";
const SKIRT = "#3c7f98";
const SKIRT_SHADE = "#2c6278";
const BOOT = "#e23878";
const LIP = "#e7a0aa";
const BROW = "#2a2226";
const LINER = "#140e16";
const JEWEL = "#f4f1ec";

export type GlamParts = {
  hips: THREE.Object3D;
  thighL: THREE.Object3D;
  thighR: THREE.Object3D;
  shinL: THREE.Object3D;
  shinR: THREE.Object3D;
  bootL: THREE.Object3D;
  bootR: THREE.Object3D;
  chest: THREE.Object3D;
  head: THREE.Object3D;
  hair: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  foreL: THREE.Object3D;
  foreR: THREE.Object3D;
  skirt: THREE.Object3D;
};

const HIP_Y = 1.04;
const THIGH = 0.46;
const SHIN = 0.44;
const UPPER = 0.26;
const FORE = 0.24;

const BONE = {
  chest: 0,
  armL: 1,
  foreL: 2,
  armR: 3,
  foreR: 4,
  thighL: 5,
  shinL: 6,
  thighR: 7,
  shinR: 8,
} as const;

type Surface = {
  positions: number[];
  indices: number[];
  skinIndex: number[];
  skinWeight: number[];
};

function material(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.58, metalness: 0.02, ...extra });
}

function gloss(color: string, extra: THREE.MeshPhysicalMaterialParameters = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.32,
    metalness: 0.08,
    clearcoat: 0.4,
    clearcoatRoughness: 0.35,
    ...extra,
  });
}

function emptySurface(): Surface {
  return { positions: [], indices: [], skinIndex: [], skinWeight: [] };
}

function weight(surface: Surface, boneA: number, boneB: number, wB: number) {
  const wA = 1 - wB;
  surface.skinIndex.push(boneA, boneB, 0, 0);
  surface.skinWeight.push(wA, wB, 0, 0);
}

function pushLathe(
  surface: Surface,
  points: [number, number][],
  bone: number,
  segments = 28,
  zScale = 1,
) {
  const rows = points.length;
  const base = surface.positions.length / 3;
  for (let i = 0; i < rows; i += 1) {
    const [radius, y] = points[i];
    for (let j = 0; j < segments; j += 1) {
      const angle = (j / segments) * Math.PI * 2;
      surface.positions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius * zScale);
      weight(surface, bone, bone, 0);
    }
  }
  for (let i = 0; i < rows - 1; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      const j2 = (j + 1) % segments;
      const a = base + i * segments + j;
      const b = base + i * segments + j2;
      const c = base + (i + 1) * segments + j;
      const d = base + (i + 1) * segments + j2;
      surface.indices.push(a, c, b, b, c, d);
    }
  }
}

function pushTube(
  surface: Surface,
  origin: THREE.Vector3,
  end: THREE.Vector3,
  radii: number[],
  boneA: number,
  boneB: number,
  blend0: number,
  blend1: number,
  radial = 16,
) {
  const axis = end.clone().sub(origin);
  const length = Math.max(axis.length(), 0.001);
  axis.multiplyScalar(1 / length);
  const helper = Math.abs(axis.y) > 0.85 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(axis, helper).normalize();
  const bin = new THREE.Vector3().crossVectors(axis, side).normalize();
  const rows = radii.length;
  const base = surface.positions.length / 3;
  for (let i = 0; i < rows; i += 1) {
    const t = i / (rows - 1);
    const dist = t * length;
    let wB = 0;
    if (dist >= blend1) wB = 1;
    else if (dist > blend0) wB = (dist - blend0) / (blend1 - blend0);
    wB = wB * wB * (3 - 2 * wB);
    const center = origin.clone().addScaledVector(axis, dist);
    for (let j = 0; j < radial; j += 1) {
      const angle = (j / radial) * Math.PI * 2;
      const offset = side.clone().multiplyScalar(Math.cos(angle) * radii[i]).addScaledVector(bin, Math.sin(angle) * radii[i]);
      surface.positions.push(center.x + offset.x, center.y + offset.y, center.z + offset.z);
      weight(surface, boneA, boneB, wB);
    }
  }
  for (let i = 0; i < rows - 1; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const j2 = (j + 1) % radial;
      const a = base + i * radial + j;
      const b = base + i * radial + j2;
      const c = base + (i + 1) * radial + j;
      const d = base + (i + 1) * radial + j2;
      surface.indices.push(a, c, b, b, c, d);
    }
  }
  const cap = (row: number, inward: number) => {
    const centerIndex = surface.positions.length / 3;
    const yRow = row / (rows - 1);
    const center = origin.clone().addScaledVector(axis, yRow * length);
    surface.positions.push(center.x, center.y, center.z);
    const dist = yRow * length;
    let wB = 0;
    if (dist >= blend1) wB = 1;
    else if (dist > blend0) wB = (dist - blend0) / (blend1 - blend0);
    weight(surface, boneA, boneB, wB * wB * (3 - 2 * wB));
    for (let j = 0; j < radial; j += 1) {
      const j2 = (j + 1) % radial;
      const a = base + row * radial + j;
      const b = base + row * radial + j2;
      if (inward > 0) surface.indices.push(centerIndex, a, b);
      else surface.indices.push(centerIndex, b, a);
    }
  };
  cap(0, -1);
  cap(rows - 1, 1);
}

function surfaceGeometry(surface: Surface) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(surface.positions, 3));
  geometry.setIndex(surface.indices);
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(surface.skinIndex, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(surface.skinWeight, 4));
  geometry.computeVertexNormals();
  return geometry;
}

function hipPoint(bone: THREE.Object3D, hips: THREE.Object3D, local = new THREE.Vector3()) {
  const point = local.clone();
  bone.localToWorld(point);
  hips.worldToLocal(point);
  return point;
}

function taperedLock(points: [number, number, number][], radius0: number, radius1: number, surface: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const steps = 26;
  const radial = 8;
  const frames = curve.computeFrenetFrames(steps, false);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const root = new THREE.Color(HAIR_DEEP);
  const mid = new THREE.Color(HAIR);
  const tip = new THREE.Color(HAIR_LIGHT);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const radius = THREE.MathUtils.lerp(radius0, radius1, t) * (1 - t * t * 0.45);
    const center = curve.getPoint(t);
    const tone = root.clone().lerp(mid, Math.min(1, t * 1.4)).lerp(tip, Math.max(0, t - 0.55) * 1.6);
    for (let j = 0; j < radial; j += 1) {
      const angle = (j / radial) * Math.PI * 2;
      const offset = frames.normals[i].clone().multiplyScalar(Math.cos(angle) * radius)
        .addScaledVector(frames.binormals[i], Math.sin(angle) * radius);
      positions.push(center.x + offset.x, center.y + offset.y, center.z + offset.z);
      const highlight = j === 1 || j === 2 ? 0.35 : 0;
      colors.push(
        Math.min(1, tone.r + highlight),
        Math.min(1, tone.g + highlight * 0.7),
        Math.min(1, tone.b + highlight),
      );
    }
  }
  for (let i = 0; i < steps; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const j2 = (j + 1) % radial;
      const a = i * radial + j;
      const b = i * radial + j2;
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + j2;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.castShadow = true;
  return mesh;
}

function irisTexture() {
  const size = 96;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = ((x + 0.5) / size) * 2 - 1;
      const v = ((y + 0.5) / size) * 2 - 1;
      const dist = Math.hypot(u, v);
      const index = (y * size + x) * 4;
      if (dist > 1) continue;
      const fiber = 0.88 + 0.12 * Math.sin(Math.atan2(v, u) * 5);
      let red = 92;
      let green = 28;
      let blue = 78;
      if (dist < 0.18) {
        red = 12;
        green = 6;
        blue = 16;
      } else if (dist < 0.42) {
        red = 150 * fiber;
        green = 42;
        blue = 112;
      } else if (dist < 0.72) {
        red = 108 * fiber;
        green = 30;
        blue = 84;
      } else {
        red = 28;
        green = 10;
        blue = 32;
      }
      if (Math.hypot(u - 0.28, v - 0.22) < 0.08) {
        red = 255;
        green = 248;
        blue = 255;
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
  const geometry = new THREE.SphereGeometry(1, 48, 36);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const skin = new THREE.Color(SKIN);
  const blush = new THREE.Color("#e7a090");
  const contour = new THREE.Color("#d09a7c");
  for (let i = 0; i < position.count; i += 1) {
    let x = position.getX(i);
    let y = position.getY(i);
    let z = position.getZ(i);
    x *= 0.72;
    y *= 1.08;
    z *= 0.88;
    if (y < 0) {
      const taper = THREE.MathUtils.clamp(-y / 1.08, 0, 1);
      y = -Math.pow(taper, 1.28) * 0.62;
      x *= 1 - taper * 0.22;
    }
    const cheek = Math.exp(-((y - 0.05) ** 2) / 0.05) * Math.exp(-((Math.abs(x) - 0.38) ** 2) / 0.04);
    if (z > -0.05) {
      x += Math.sign(x || 1) * cheek * 0.08;
      z += cheek * 0.03;
    }
    if (Math.abs(x) < 0.08 && y > -0.05 && y < 0.22 && z > 0.2) z += 0.04;
    position.setXYZ(i, x, y, z);
    const tone = skin.clone();
    if (cheek > 0.35 && z > 0) tone.lerp(blush, 0.4);
    if (y < -0.3) tone.lerp(contour, 0.25);
    colors[i * 3] = tone.r;
    colors[i * 3 + 1] = tone.g;
    colors[i * 3 + 2] = tone.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.scale(0.086, 0.086, 0.086);
  return geometry;
}

function eye(side: number, irisMap: THREE.Texture, skinMat: THREE.Material, linerMat: THREE.Material, browMat: THREE.Material) {
  const root = new THREE.Group();
  root.name = side < 0 ? "eyeL" : "eyeR";
  root.position.set(side * 0.024, 0.01, 0.058);
  root.rotation.z = side * -0.08;

  const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.011, 20, 14), material("#fffaf8", { roughness: 0.28 }));
  sclera.scale.set(1.55, 0.52, 0.32);
  root.add(sclera);

  const iris = new THREE.Mesh(
    new THREE.CircleGeometry(0.0082, 28),
    gloss("#ffffff", { map: irisMap, roughness: 0.18, clearcoat: 0.55, clearcoatRoughness: 0.2 }),
  );
  iris.name = "iris";
  iris.position.z = 0.0038;
  root.add(iris);

  const catchlight = new THREE.Mesh(new THREE.CircleGeometry(0.0012, 8), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
  catchlight.position.set(-0.002, 0.0016, 0.0046);
  root.add(catchlight);

  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0112, 16, 10), skinMat);
  lid.scale.set(1.6, 0.2, 0.26);
  lid.position.set(0, 0.0054, 0.001);
  root.add(lid);

  const liner = new THREE.Mesh(new THREE.TorusGeometry(0.0092, 0.00045, 4, 12, Math.PI * 0.72), linerMat);
  liner.rotation.set(1.35, 0, side * 0.12);
  liner.position.set(0, 0.0036, 0.004);
  root.add(liner);
  for (let i = 0; i < 5; i += 1) {
    const lash = new THREE.Mesh(new THREE.BoxGeometry(0.0006, 0.0045, 0.0006), linerMat);
    lash.position.set(-0.006 + i * 0.003, 0.0068, 0.0042);
    lash.rotation.z = side * -0.2 + (i - 2) * 0.18;
    root.add(lash);
  }

  const brow = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0007, 4, 10, Math.PI * 0.48), browMat);
  brow.rotation.set(1.2, 0, side * -0.55);
  brow.position.set(side * 0.002, 0.012, 0.003);
  root.add(brow);
  return root;
}

function lipMesh(lipMat: THREE.Material) {
  const upper = new THREE.Shape();
  upper.moveTo(-0.014, 0);
  upper.quadraticCurveTo(-0.007, 0.006, 0, 0.0022);
  upper.quadraticCurveTo(0.007, 0.006, 0.014, 0);
  upper.quadraticCurveTo(0, -0.002, -0.014, 0);
  const lower = new THREE.Shape();
  lower.moveTo(-0.015, 0);
  lower.quadraticCurveTo(0, -0.008, 0.015, 0);
  lower.quadraticCurveTo(0, 0.002, -0.015, 0);
  const group = new THREE.Group();
  group.name = "lips";
  const extrude = { depth: 0.003, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1 };
  const topLip = new THREE.Mesh(new THREE.ExtrudeGeometry(upper, extrude), lipMat);
  topLip.position.set(0, -0.012, 0.052);
  const bottomLip = new THREE.Mesh(new THREE.ExtrudeGeometry(lower, extrude), lipMat);
  bottomLip.position.set(0, -0.018, 0.05);
  group.add(topLip, bottomLip);
  return group;
}

function boot(name: string, surface: THREE.Material, laceMat: THREE.Material, shade: THREE.Material) {
  const joint = new THREE.Group();
  joint.name = name;
  const shaft = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.03, 0.0),
    new THREE.Vector2(0.036, 0.03),
    new THREE.Vector2(0.034, 0.062),
  ], 18), surface);
  shaft.castShadow = true;
  joint.add(shaft);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.004, 8, 16), shade);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = 0.06;
  joint.add(cuff);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.034, 0.09), surface);
  foot.position.set(0, -0.006, 0.028);
  foot.castShadow = true;
  joint.add(foot);
  const toe = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), surface);
  toe.scale.set(0.9, 0.55, 1.7);
  toe.position.set(0, -0.01, 0.086);
  toe.castShadow = true;
  joint.add(toe);
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.012, 0.125), shade);
  sole.position.set(0, -0.026, 0.03);
  joint.add(sole);
  const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.006, 0.072, 8), surface);
  heel.position.set(0, -0.06, -0.016);
  heel.castShadow = true;
  joint.add(heel);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.006, 0.028), shade);
  tip.position.set(0, -0.096, -0.016);
  joint.add(tip);
  for (let i = 0; i < 4; i += 1) {
    const y = 0.02 - i * 0.014;
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.0022, 0.0022), laceMat);
    left.rotation.z = 0.7;
    left.position.set(0, y, 0.04);
    left.name = "lace";
    const right = left.clone();
    right.rotation.z = -0.7;
    right.position.z = 0.041;
    right.name = "lace";
    joint.add(left, right);
  }
  return joint;
}

function fashionHand(skinMat: THREE.Material) {
  const root = new THREE.Group();
  root.name = "hand";
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 10), skinMat);
  palm.scale.set(0.95, 1.15, 0.42);
  palm.position.y = -0.01;
  palm.castShadow = true;
  root.add(palm);
  for (let i = 0; i < 4; i += 1) {
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.0034, 0.022, 3, 6), skinMat);
    finger.position.set(-0.01 + i * 0.0066, -0.038, 0.002);
    finger.rotation.z = (i - 1.5) * 0.06;
    root.add(finger);
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.004, 0.014, 3, 6), skinMat);
  thumb.rotation.z = 0.9;
  thumb.position.set(0.016, -0.016, 0.004);
  root.add(thumb);
  return root;
}

function bindSkinned(mesh: THREE.SkinnedMesh, skeleton: THREE.Skeleton, hips: THREE.Object3D) {
  hips.add(mesh);
  mesh.bind(skeleton);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
}

/** Build the locked glam figure. Feet rest near y=0. She faces +Z. */
export function createGlamRig() {
  const skin = material(SKIN, { roughness: 0.62 });
  const skinFace = material("#ffffff", { roughness: 0.55, vertexColors: true });
  const top = material(TOP, { roughness: 0.52 });
  const topShade = material(TOP_SHADE, { roughness: 0.55 });
  const skirtMat = material(SKIRT, { roughness: 0.52 });
  const skirtShade = material(SKIRT_SHADE, { roughness: 0.58 });
  const bootMat = gloss(BOOT, { roughness: 0.28, metalness: 0.12, clearcoat: 0.62, clearcoatRoughness: 0.28, emissive: "#6a1840", emissiveIntensity: 0.12 });
  const bootShade = material("#c42d68", { roughness: 0.4 });
  const lace = material("#f6e4ea", { roughness: 0.35 });
  const jewel = gloss(JEWEL, { roughness: 0.12, metalness: 0.45, clearcoat: 0.7, clearcoatRoughness: 0.18, emissive: "#f7f4ef", emissiveIntensity: 0.2 });
  const linerMat = material(LINER, { roughness: 0.4 });
  const browMat = material(BROW, { roughness: 0.5 });
  const lipMat = gloss(LIP, { roughness: 0.2, clearcoat: 0.75, clearcoatRoughness: 0.16 });
  const hairMat = material("#ffffff", { roughness: 0.42, vertexColors: true });
  const scalpMat = material(HAIR, { roughness: 0.4 });
  const irisMap = irisTexture();

  const rig = new THREE.Group();
  rig.name = "glam-rig";

  const hips = new THREE.Group();
  hips.name = "hips";
  hips.position.y = HIP_Y;
  rig.add(hips);

  const chest = new THREE.Bone();
  chest.name = "chest";
  chest.position.y = 0.16;
  hips.add(chest);

  const head = new THREE.Bone();
  head.name = "head";
  head.position.y = 0.3;
  chest.add(head);

  const hair = new THREE.Group();
  hair.name = "hair";
  head.add(hair);

  const armL = new THREE.Bone();
  const armR = new THREE.Bone();
  armL.name = "armL";
  armR.name = "armR";
  armL.position.set(0.1, 0.14, 0);
  armR.position.set(-0.1, 0.14, 0);
  armL.rotation.z = 0.42;
  armR.rotation.z = -0.42;
  chest.add(armL, armR);

  const foreL = new THREE.Bone();
  const foreR = new THREE.Bone();
  foreL.name = "foreL";
  foreR.name = "foreR";
  foreL.position.y = -UPPER;
  foreR.position.y = -UPPER;
  armL.add(foreL);
  armR.add(foreR);

  const thighL = new THREE.Bone();
  const thighR = new THREE.Bone();
  thighL.name = "thighL";
  thighR.name = "thighR";
  thighL.position.set(0.07, -0.02, 0);
  thighR.position.set(-0.07, -0.02, 0);
  hips.add(thighL, thighR);

  const shinL = new THREE.Bone();
  const shinR = new THREE.Bone();
  shinL.name = "shinL";
  shinR.name = "shinR";
  shinL.position.y = -THIGH;
  shinR.position.y = -THIGH;
  thighL.add(shinL);
  thighR.add(shinR);

  const bootL = new THREE.Bone();
  const bootR = new THREE.Bone();
  bootL.name = "bootL";
  bootR.name = "bootR";
  bootL.position.y = -SHIN;
  bootR.position.y = -SHIN;
  shinL.add(bootL);
  shinR.add(bootR);

  const bones = [chest, armL, foreL, armR, foreR, thighL, shinL, thighR, shinR];
  const skeleton = new THREE.Skeleton(bones);
  rig.updateMatrixWorld(true);

  const outfit = emptySurface();
  pushLathe(outfit, [
    [0.112, -0.02],
    [0.078, 0.06],
    [0.086, 0.12],
    [0.098, 0.18],
    [0.096, 0.24],
    [0.07, 0.3],
    [0.046, 0.34],
  ], BONE.chest, 32, 0.74);

  const sleeve = (arm: THREE.Object3D, fore: THREE.Object3D, armId: number, foreId: number) => {
    const shoulder = hipPoint(arm, hips);
    const wrist = hipPoint(fore, hips, new THREE.Vector3(0, -FORE, 0));
    const radii = [0.048, 0.044, 0.04, 0.036, 0.034, 0.032, 0.03, 0.028, 0.026, 0.024];
    pushTube(outfit, shoulder, wrist, radii, armId, foreId, UPPER * 0.72, UPPER * 1.05);
  };
  sleeve(armL, foreL, BONE.armL, BONE.foreL);
  sleeve(armR, foreR, BONE.armR, BONE.foreR);

  const legs = emptySurface();
  pushLathe(legs, [
    [0.1, -0.06],
    [0.09, 0.0],
    [0.07, 0.06],
  ], BONE.chest, 24, 0.85);
  const limb = (thigh: THREE.Object3D, shin: THREE.Object3D, thighId: number, shinId: number) => {
    const hip = hipPoint(thigh, hips);
    const ankle = hipPoint(shin, hips, new THREE.Vector3(0, -SHIN, 0));
    const radii = [0.058, 0.054, 0.05, 0.046, 0.042, 0.04, 0.038, 0.034, 0.03, 0.026];
    pushTube(legs, hip, ankle, radii, thighId, shinId, THIGH * 0.78, THIGH * 1.08);
  };
  limb(thighL, shinL, BONE.thighL, BONE.shinL);
  limb(thighR, shinR, BONE.thighR, BONE.shinR);

  const outfitMesh = new THREE.SkinnedMesh(surfaceGeometry(outfit), top);
  outfitMesh.name = "top";
  const legMesh = new THREE.SkinnedMesh(surfaceGeometry(legs), skin);
  legMesh.name = "legs";
  bindSkinned(outfitMesh, skeleton, hips);
  bindSkinned(legMesh, skeleton, hips);

  const skirt = new THREE.Group();
  skirt.name = "skirt";
  const skirtMesh = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.108, -0.22),
    new THREE.Vector2(0.118, -0.12),
    new THREE.Vector2(0.128, -0.02),
    new THREE.Vector2(0.122, 0.08),
    new THREE.Vector2(0.108, 0.14),
  ], 32), skirtMat);
  skirtMesh.position.y = -0.08;
  skirtMesh.castShadow = true;
  skirtMesh.receiveShadow = true;
  skirt.add(skirtMesh);
  const waistband = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.008, 8, 24), skirtShade);
  waistband.rotation.x = Math.PI / 2;
  waistband.position.y = 0.05;
  skirt.add(waistband);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.006, 8, 24), skirtShade);
  hem.rotation.x = Math.PI / 2;
  hem.position.y = -0.3;
  skirt.add(hem);
  const skirtSeam = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.28, 0.004), skirtShade);
  skirtSeam.position.set(0.09, -0.12, 0.07);
  skirt.add(skirtSeam);
  hips.add(skirt);

  for (const side of [-1, 1]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.16, 0.004), topShade);
    seam.position.set(side * 0.07, 0.08, 0.055);
    seam.rotation.z = side * -0.22;
    chest.add(seam);
  }
  const neckline = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.004, 6, 20), topShade);
  neckline.rotation.x = Math.PI / 2.2;
  neckline.position.set(0, 0.175, 0.01);
  chest.add(neckline);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.08, 16), skin);
  neck.position.y = -0.02;
  neck.castShadow = true;
  head.add(neck);

  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0016, 6, 24), jewel);
  chain.rotation.x = Math.PI / 2.4;
  chain.position.set(0, 0.02, 0.03);
  head.add(chain);
  const pendant = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 10), jewel);
  pendant.name = "pendant";
  pendant.scale.set(0.5, 1.2, 0.32);
  pendant.position.set(0, -0.02, 0.055);
  head.add(pendant);

  const skull = new THREE.Mesh(fashionSkull(), skinFace);
  skull.name = "face";
  skull.castShadow = true;
  head.add(skull);
  head.add(eye(-1, irisMap, skin, linerMat, browMat), eye(1, irisMap, skin, linerMat, browMat));
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.004, 10, 8), skin);
  nose.name = "nose";
  nose.scale.set(0.7, 0.85, 0.7);
  nose.position.set(0, -0.002, 0.062);
  head.add(nose);
  head.add(lipMesh(lipMat));
  for (const side of [-1, 1]) {
    const blush = new THREE.Mesh(
      new THREE.CircleGeometry(0.012, 14),
      new THREE.MeshBasicMaterial({ color: "#e7a090", transparent: true, opacity: 0.35, depthWrite: false }),
    );
    blush.position.set(side * 0.032, -0.01, 0.058);
    head.add(blush);
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 10, 8), jewel);
    drop.name = "earring";
    drop.scale.set(0.4, 1.6, 0.28);
    drop.position.set(side * 0.055, -0.01, 0.0);
    head.add(drop);
  }

  const scalp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 16), scalpMat);
  scalp.scale.set(1.15, 0.52, 0.95);
  scalp.position.set(0, 0.04, -0.02);
  scalp.castShadow = true;
  hair.add(scalp);
  for (let i = 0; i < 14; i += 1) {
    const angle = Math.PI * 0.62 + (i / 13) * Math.PI * 0.76;
    const x = Math.sin(angle) * 0.055;
    const z = Math.cos(angle) * 0.045;
    const phase = i * 0.85;
    const sway = Math.sin(phase);
    hair.add(taperedLock([
      [x, 0.045, z - 0.01],
      [x * 1.45 + sway * 0.02, -0.04, z - 0.03],
      [x * 1.9 + Math.sin(phase + 1.2) * 0.04, -0.18, z - 0.02],
      [x * 1.35 + sway * 0.03, -0.34, z - 0.04],
      [x * 1.7, -0.5, z - 0.03],
    ], i % 3 === 0 ? 0.03 : 0.024, 0.008, hairMat));
  }
  for (const side of [-1, 1]) {
    hair.add(taperedLock([
      [side * 0.04, 0.05, 0.0],
      [side * 0.07, 0.01, 0.005],
      [side * 0.1, -0.14, -0.02],
      [side * 0.12, -0.36, -0.03],
    ], 0.02, 0.008, hairMat));
  }
  hair.add(taperedLock([
    [0.03, 0.055, 0.012],
    [0.0, 0.04, 0.02],
    [-0.028, 0.03, 0.012],
  ], 0.012, 0.005, hairMat));

  const handL = fashionHand(skin);
  const handR = fashionHand(skin);
  handL.position.y = -FORE;
  handR.position.y = -FORE;
  foreL.add(handL);
  foreR.add(handR);
  bootL.add(boot("bootL", bootMat, lace, bootShade));
  bootR.add(boot("bootR", bootMat, lace, bootShade));

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
export function poseGlamRig(rig: THREE.Object3D, mode: GlamPose | "apose", time: number) {
  const parts = glamParts(rig);
  if (mode === "apose") {
    parts.hips.position.y = HIP_Y;
    parts.hips.rotation.set(0, 0, 0);
    parts.chest.position.y = 0.16;
    parts.chest.rotation.set(0, 0, 0);
    parts.head.rotation.set(0, 0, 0);
    parts.hair.rotation.set(0, 0, 0);
    parts.skirt.rotation.set(0, 0, 0);
    parts.thighL.rotation.set(0, 0, 0);
    parts.thighR.rotation.set(0, 0, 0);
    parts.shinL.rotation.set(0, 0, 0);
    parts.shinR.rotation.set(0, 0, 0);
    parts.bootL.rotation.set(0, 0, 0);
    parts.bootR.rotation.set(0, 0, 0);
    parts.armL.rotation.set(0, 0, 1.12);
    parts.armR.rotation.set(0, 0, -1.12);
    parts.foreL.rotation.set(0, 0, 0);
    parts.foreR.rotation.set(0, 0, 0);
    return;
  }

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
  parts.head.rotation.y = walk * swing * -0.04 + wave * 0.12;
  parts.head.rotation.z = (1 - walk) * (1 - sit) * Math.sin(time * 0.8) * 0.03;
  parts.hair.rotation.x = breathe * 0.015 + walk * swing * 0.05;
  parts.hair.rotation.z = walk * swing * -0.03;
  parts.skirt.rotation.z = walk * swing * -0.05;
  parts.skirt.rotation.x = walk * 0.04 + sit * 0.28;

  const stride = 0.62;
  parts.thighL.rotation.set(0, 0, 0);
  parts.thighR.rotation.set(0, 0, 0);
  parts.shinL.rotation.set(0, 0, 0);
  parts.shinR.rotation.set(0, 0, 0);
  parts.thighL.rotation.x = THREE.MathUtils.lerp(0.08, -swing * stride, walk) * (1 - sit) + sit * -1.28;
  parts.thighR.rotation.x = THREE.MathUtils.lerp(-0.16, swing * stride, walk) * (1 - sit) + sit * -1.28;
  parts.thighL.rotation.z = (1 - walk) * (1 - sit) * 0.04 + sit * 0.08;
  parts.thighR.rotation.z = (1 - walk) * (1 - sit) * -0.2 + walk * 0.02 + sit * -0.08;
  parts.shinL.rotation.x = (1 - sit) * (walk * Math.max(0, swing) * 0.9 + (1 - walk) * 0.1) + sit * 1.35;
  parts.shinR.rotation.x = (1 - sit) * (walk * Math.max(0, -swing) * 0.9 + (1 - walk) * 0.5) + sit * 1.35;
  parts.bootL.rotation.set(0, 0, 0);
  parts.bootR.rotation.set(0, 0, 0);
  parts.bootL.rotation.x = -(parts.thighL.rotation.x + parts.shinL.rotation.x) * (sit ? 0.15 : 0.82);
  parts.bootR.rotation.x = -(parts.thighR.rotation.x + parts.shinR.rotation.x) * (sit ? 0.15 : 0.82);

  const idleArm = Math.max(1 - walk - sit - wave, 0);
  parts.armL.rotation.set(0, 0, 0.42);
  parts.armR.rotation.set(0, 0, -0.42);
  parts.foreL.rotation.set(0, 0, 0);
  parts.foreR.rotation.set(0, 0, 0);
  parts.armL.rotation.x = walk * swing * 0.55 + sit * -0.4 + wave * -1.6 + idleArm * 0.15;
  parts.armR.rotation.x = walk * -swing * 0.55 + sit * -0.45 + idleArm * 0.25;
  parts.armL.rotation.z = 0.42 + walk * 0.08 + sit * 0.1 + wave * 0.15 + idleArm * 0.08;
  parts.armR.rotation.z = -0.42 + walk * -0.05 + sit * -0.08 + idleArm * -0.25;
  parts.foreL.rotation.x = walk * 0.25 + sit * 0.7 + idleArm * 0.2;
  parts.foreR.rotation.x = walk * 0.25 + sit * 0.75 + idleArm * 1.15;
  parts.foreL.rotation.z = wave * 0.35;
  parts.foreR.rotation.z = idleArm * 0.35;
  if (wave) {
    parts.foreL.rotation.x = 0.4 + Math.sin(time * 9) * 0.35;
    parts.armL.rotation.z = 0.2;
  }
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
