/**
 * Locked glam Office You.
 * Continuous skinned limbs, one pencil skirt, and the locked illustration
 * projected onto the head. Other looks stay on the humanoid rig.
 */

import * as THREE from "three";
import { GLAM_FACE_H, GLAM_FACE_RGBA, GLAM_FACE_W } from "./glam-face-bake";

export const GLAM_HEIGHT = 1.74;

export const GLAM_POSES = ["idle", "walk", "wave", "sit"] as const;
export type GlamPose = (typeof GLAM_POSES)[number];

const SKIN = "#f2c3a6";
const HAIR = "#6e3494";
const HAIR_DEEP = "#3c145c";
const HAIR_LIGHT = "#c9a6de";
const TOP = "#ee5a90";
const SKIRT = "#3e8eac";
const BOOT = "#e43778";
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
const HEAD_SCALE = 0.1;

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

/** Hero stance. Bind pose matches these limb angles so the idle silhouette stays smooth. */
const IDLE_ARM_L: [number, number, number] = [0.12, 0.04, 0.28];
const IDLE_FORE_L: [number, number, number] = [0.18, 0, 0.1];
const IDLE_ARM_R: [number, number, number] = [0.35, 0.76, -1.29];
const IDLE_FORE_R: [number, number, number] = [-0.38, -0.733, 1.8];
const IDLE_THIGH_L: [number, number, number] = [0.05, 0.02, 0.04];
const IDLE_THIGH_R: [number, number, number] = [-0.387, 0.05, 0.183];
const IDLE_SHIN_L = 0.02;
const IDLE_SHIN_R = 0.713;

type Surface = {
  positions: number[];
  indices: number[];
  skinIndex: number[];
  skinWeight: number[];
};

type RGB = [number, number, number];

function smoothstep(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function toon(color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.62,
    metalness: 0.0,
    ...extra,
  });
  return material;
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
  segments = 64,
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
      surface.indices.push(a, b, c, b, d, c);
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
  radial = 24,
  caps: "both" | "start" | "end" | "none" = "none",
) {
  const axis = end.clone().sub(origin);
  const length = Math.max(axis.length(), 0.001);
  axis.multiplyScalar(1 / length);
  const helper = Math.abs(axis.y) > 0.85 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(axis, helper).normalize();
  const bin = new THREE.Vector3().crossVectors(axis, side).normalize();
  const rows = radii.length;
  const base = surface.positions.length / 3;
  const blendAt = (dist: number) => {
    if (dist >= blend1) return 1;
    if (dist <= blend0) return 0;
    const t = (dist - blend0) / Math.max(0.0001, blend1 - blend0);
    return t * t * (3 - 2 * t);
  };
  for (let i = 0; i < rows; i += 1) {
    const t = rows === 1 ? 0 : i / (rows - 1);
    const dist = t * length;
    const center = origin.clone().addScaledVector(axis, dist);
    const radius = radii[Math.min(i, radii.length - 1)];
    for (let j = 0; j < radial; j += 1) {
      const angle = (j / radial) * Math.PI * 2;
      const offset = side
        .clone()
        .multiplyScalar(Math.cos(angle) * radius)
        .addScaledVector(bin, Math.sin(angle) * radius);
      surface.positions.push(center.x + offset.x, center.y + offset.y, center.z + offset.z);
      weight(surface, boneA, boneB, blendAt(dist));
    }
  }
  for (let i = 0; i < rows - 1; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const j2 = (j + 1) % radial;
      const a = base + i * radial + j;
      const b = base + i * radial + j2;
      const c = base + (i + 1) * radial + j;
      const d = base + (i + 1) * radial + j2;
      surface.indices.push(a, b, c, b, d, c);
    }
  }
  const cap = (row: number, inward: number) => {
    const centerIndex = surface.positions.length / 3;
    const yRow = rows === 1 ? 0 : row / (rows - 1);
    const center = origin.clone().addScaledVector(axis, yRow * length);
    surface.positions.push(center.x, center.y, center.z);
    weight(surface, boneA, boneB, blendAt(yRow * length));
    for (let j = 0; j < radial; j += 1) {
      const j2 = (j + 1) % radial;
      const a = base + row * radial + j;
      const b = base + row * radial + j2;
      if (inward > 0) surface.indices.push(centerIndex, a, b);
      else surface.indices.push(centerIndex, b, a);
    }
  };
  if (caps === "both" || caps === "start") cap(0, -1);
  if (caps === "both" || caps === "end") cap(rows - 1, 1);
}

/** One tube along a bent chain. No open ring at the joint, so knees and elbows stay closed. */
function pushChain(
  surface: Surface,
  knots: THREE.Vector3[],
  radiusAt: (t: number) => number,
  weightAt: (dist: number, total: number) => [number, number, number],
  radial = 24,
  samples = 36,
  caps: "both" | "start" | "end" | "none" = "none",
) {
  const curve = new THREE.CatmullRomCurve3(knots, false, "centripetal");
  const lengths = curve.getLengths(samples);
  const total = Math.max(lengths[samples] ?? lengths[lengths.length - 1] ?? 1, 0.001);
  const base = surface.positions.length / 3;
  const tangent = new THREE.Vector3();
  const bin = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const t0 = curve.getTangent(0).normalize();
  const helper = Math.abs(t0.y) > 0.85 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const normal = new THREE.Vector3().crossVectors(t0, helper).normalize();
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const center = curve.getPoint(t);
    tangent.copy(curve.getTangent(t)).normalize();
    normal.addScaledVector(tangent, -normal.dot(tangent));
    if (normal.lengthSq() < 1e-8) normal.crossVectors(tangent, helper);
    normal.normalize();
    bin.crossVectors(tangent, normal).normalize();
    const dist = lengths[i] ?? t * total;
    const radius = radiusAt(total < 1e-4 ? 0 : dist / total);
    const [boneA, boneB, wB] = weightAt(dist, total);
    for (let j = 0; j < radial; j += 1) {
      const angle = (j / radial) * Math.PI * 2;
      offset
        .copy(normal)
        .multiplyScalar(Math.cos(angle) * radius)
        .addScaledVector(bin, Math.sin(angle) * radius);
      surface.positions.push(center.x + offset.x, center.y + offset.y, center.z + offset.z);
      weight(surface, boneA, boneB, wB);
    }
  }
  for (let i = 0; i < samples; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const j2 = (j + 1) % radial;
      const a = base + i * radial + j;
      const b = base + i * radial + j2;
      const c = base + (i + 1) * radial + j;
      const d = base + (i + 1) * radial + j2;
      surface.indices.push(a, b, c, b, d, c);
    }
  }
  const cap = (row: number, inward: number) => {
    const centerIndex = surface.positions.length / 3;
    const t = row / samples;
    const center = curve.getPoint(t);
    surface.positions.push(center.x, center.y, center.z);
    const dist = lengths[row] ?? t * total;
    const [boneA, boneB, wB] = weightAt(dist, total);
    weight(surface, boneA, boneB, wB);
    for (let j = 0; j < radial; j += 1) {
      const j2 = (j + 1) % radial;
      const a = base + row * radial + j;
      const b = base + row * radial + j2;
      if (inward > 0) surface.indices.push(centerIndex, a, b);
      else surface.indices.push(centerIndex, b, a);
    }
  };
  if (caps === "both" || caps === "start") cap(0, -1);
  if (caps === "both" || caps === "end") cap(samples, 1);
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

function faceTexture() {
  const bin = atob(GLAM_FACE_RGBA.replace(/\s+/g, ""));
  const data = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) data[i] = bin.charCodeAt(i);
  const texture = new THREE.DataTexture(data, GLAM_FACE_W, GLAM_FACE_H);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = false;
  return texture;
}

function paintHair() {
  const w = 96;
  const h = 384;
  const data = new Uint8Array(w * h * 4);
  const mix = (a: RGB, b: RGB, t: number): RGB => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
  const deep: RGB = [52, 18, 82];
  const mid: RGB = [118, 58, 158];
  const light: RGB = [214, 176, 230];
  for (let y = 0; y < h; y += 1) {
    const v = y / (h - 1);
    const base = mix(deep, mid, Math.min(1, v * 1.15));
    const tip = mix(base, light, Math.max(0, (v - 0.55) * 1.5));
    for (let x = 0; x < w; x += 1) {
      const u = x / (w - 1);
      let rgb = tip;
      for (let k = 0; k < 2; k += 1) {
        const center = 0.5 + 0.27 * Math.sin(v * Math.PI * 1.65 + k * 2.2);
        const width = 0.12;
        const band = Math.max(0, 1 - Math.abs(u - center) / width);
        rgb = mix(rgb, k === 0 ? light : [240, 220, 248], band * band * 0.9);
      }
      const shade = 0.76 + 0.24 * Math.sin(Math.min(1, Math.max(0, u)) * Math.PI);
      const i = (y * w + x) * 4;
      data[i] = Math.min(255, rgb[0] * shade);
      data[i + 1] = Math.min(255, rgb[1] * shade);
      data[i + 2] = Math.min(255, rgb[2] * shade);
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, w, h);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

function fashionHead() {
  const geometry = new THREE.SphereGeometry(1, 80, 64);
  const position = geometry.attributes.position;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i += 1) {
    let x = position.getX(i);
    let y = position.getY(i);
    let z = position.getZ(i);
    x *= 0.8;
    y *= 1.04;
    z *= 0.82;
    if (y < 0) {
      const t = Math.min(1, -y / 1.02);
      const s = t * t * (3 - 2 * t);
      x *= 1 - s * 0.28;
      z *= 1 - s * 0.08;
    }
    if (z > 0.22) z = 0.22 + (z - 0.22) * 0.62;
    const nose = Math.exp(-(x * x) / 0.014) * Math.exp(-((y + 0.04) ** 2) / 0.045);
    if (z > 0.04) z += nose * 0.055;
    if (z > 0) {
      uv[i * 2] = THREE.MathUtils.clamp(0.5 + x / 1.5, 0, 1);
      uv[i * 2 + 1] = THREE.MathUtils.clamp(0.5 + y / 1.98, 0, 1);
    } else {
      uv[i * 2] = x < 0 ? 0.01 : 0.99;
      uv[i * 2 + 1] = THREE.MathUtils.clamp(0.5 + y / 1.98, 0.02, 0.98);
    }
    position.setXYZ(i, x, y, z);
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  geometry.scale(HEAD_SCALE, HEAD_SCALE, HEAD_SCALE);
  return geometry;
}

function hairLock(
  points: [number, number, number][],
  radius0: number,
  radius1: number,
  material: THREE.Material,
  phase = 0,
) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(...point)),
    false,
    "catmullrom",
    0.45,
  );
  const steps = 42;
  const radial = 18;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let normal = new THREE.Vector3(1, 0, 0);
  const tangent = new THREE.Vector3();
  const bin = new THREE.Vector3();
  const offset = new THREE.Vector3();
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const center = curve.getPoint(t);
    tangent.copy(curve.getTangent(t)).normalize();
    normal.addScaledVector(tangent, -normal.dot(tangent));
    if (normal.lengthSq() < 1e-6) normal.set(1, 0, 0);
    normal.normalize();
    bin.crossVectors(tangent, normal).normalize();
    const radius = THREE.MathUtils.lerp(radius0, radius1, smoothstep(t));
    for (let j = 0; j < radial; j += 1) {
      const angle = (j / radial) * Math.PI * 2 + Math.PI;
      offset
        .copy(normal)
        .multiplyScalar(Math.cos(angle) * radius)
        .addScaledVector(bin, Math.sin(angle) * radius * 0.86);
      positions.push(center.x + offset.x, center.y + offset.y, center.z + offset.z);
      uvs.push(j / radial, (t * 0.84 + phase) % 1);
    }
  }
  for (let i = 0; i < steps; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const j2 = (j + 1) % radial;
      const a = i * radial + j;
      const b = i * radial + j2;
      const c = a + radial;
      const d = b + radial;
      indices.push(a, b, c, b, d, c);
    }
  }
  const capRow = (row: number, sign: number) => {
    const centerIndex = positions.length / 3;
    const t = row / steps;
    const center = curve.getPoint(t);
    positions.push(center.x, center.y, center.z);
    uvs.push(0.5, (t * 0.84 + phase) % 1);
    for (let j = 0; j < radial; j += 1) {
      const j2 = (j + 1) % radial;
      const a = row * radial + j;
      const b = row * radial + j2;
      if (sign > 0) indices.push(centerIndex, b, a);
      else indices.push(centerIndex, a, b);
    }
  };
  capRow(0, -1);
  capRow(steps, 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "lock";
  mesh.castShadow = true;
  return mesh;
}

function addHair(hair: THREE.Object3D, hairMat: THREE.Material, hairSolid: THREE.Material) {
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 40, 28), hairSolid);
  cap.name = "scalp";
  cap.scale.set(1.18, 0.55, 0.78);
  cap.position.set(0, 0.058, -0.05);
  cap.castShadow = true;
  hair.add(cap);

  // Layered S-waves beside and behind the face. The painted portrait owns the front.
  const locks: [number, number, number][][] = [
    [[0.045, 0.1, -0.01], [0.12, 0.02, 0.0], [0.16, -0.14, 0.015], [0.075, -0.3, -0.01], [0.15, -0.46, 0.02], [0.07, -0.66, 0.0]],
    [[0.02, 0.1, -0.03], [0.08, -0.02, -0.015], [0.12, -0.18, -0.005], [0.04, -0.34, -0.02], [0.1, -0.5, 0.0], [0.035, -0.68, -0.01]],
    [[-0.04, 0.1, -0.01], [-0.125, 0.0, 0.0], [-0.165, -0.15, 0.01], [-0.07, -0.31, -0.015], [-0.15, -0.47, 0.015], [-0.06, -0.66, 0.0]],
    [[-0.015, 0.1, -0.035], [-0.085, -0.04, -0.03], [-0.125, -0.2, -0.045], [-0.04, -0.36, -0.02], [-0.11, -0.52, -0.01], [-0.04, -0.68, -0.02]],
    [[0.0, 0.11, -0.05], [0.055, -0.08, -0.085], [-0.05, -0.26, -0.075], [0.05, -0.44, -0.05], [-0.02, -0.64, -0.03]],
    [[0.03, 0.1, -0.055], [0.09, -0.12, -0.065], [0.02, -0.3, -0.08], [0.08, -0.48, -0.045], [0.02, -0.67, -0.03]],
  ];
  const radii: [number, number][] = [[0.034, 0.016], [0.03, 0.014], [0.034, 0.016], [0.028, 0.013], [0.032, 0.015], [0.026, 0.012]];
  locks.forEach((points, index) => {
    hair.add(hairLock(points, radii[index][0], radii[index][1], hairMat, index * 0.17));
  });
}

function boot(surface: THREE.Material, laceMat: THREE.Material, heelMat: THREE.Material) {
  const joint = new THREE.Group();
  joint.name = "boot";
  const shaft = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.036, -0.02),
    new THREE.Vector2(0.044, 0.01),
    new THREE.Vector2(0.04, 0.05),
    new THREE.Vector2(0.046, 0.09),
    new THREE.Vector2(0.048, 0.1),
  ], 28), surface);
  shaft.castShadow = true;
  joint.add(shaft);
  const foot = new THREE.Mesh(new THREE.SphereGeometry(0.028, 24, 16), surface);
  foot.scale.set(0.7, 0.42, 1.85);
  foot.position.set(0, -0.012, 0.05);
  foot.castShadow = true;
  joint.add(foot);
  const sole = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), surface);
  sole.scale.set(0.85, 0.22, 2.3);
  sole.position.set(0, -0.028, 0.04);
  joint.add(sole);
  const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.0035, 0.09, 12), surface);
  heel.position.set(0, -0.07, -0.01);
  heel.castShadow = true;
  joint.add(heel);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), heelMat);
  tip.scale.set(0.8, 0.45, 1.1);
  tip.position.set(0, -0.112, -0.01);
  joint.add(tip);
  for (let i = 0; i < 4; i += 1) {
    const y = 0.03 - i * 0.016;
    const left = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.028, 6), laceMat);
    left.rotation.z = 0.7;
    left.position.set(-0.004, y, 0.042);
    const right = left.clone();
    right.rotation.z = -0.7;
    right.position.x = 0.004;
    joint.add(left, right);
  }
  return joint;
}

function fashionHand(skinMat: THREE.Material) {
  const root = new THREE.Group();
  root.name = "hand";
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), skinMat);
  palm.scale.set(1.05, 1.25, 0.46);
  palm.position.y = -0.01;
  palm.castShadow = true;
  root.add(palm);
  for (let i = 0; i < 4; i += 1) {
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.0038, 0.03, 4, 8), skinMat);
    finger.position.set(-0.011 + i * 0.0074, -0.046, 0.004);
    finger.rotation.z = (i - 1.5) * 0.08;
    root.add(finger);
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0044, 0.016, 4, 8), skinMat);
  thumb.rotation.z = 0.9;
  thumb.position.set(0.018, -0.016, 0.006);
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

function handOf(fore: THREE.Object3D) {
  return fore.children.find((child) => child.name === "hand") ?? null;
}

/** Build the locked glam figure. Feet rest near y=0. She faces +Z. */
export function createGlamRig() {
  const skin = toon(SKIN);
  const hairSolid = toon(HAIR, { roughness: 0.78 });
  const top = toon(TOP, { roughness: 0.72 });
  const skirtMat = toon(SKIRT, { roughness: 0.88, metalness: 0 });
  const bootMat = toon(BOOT);
  const heelMat = toon("#2a1820");
  const lace = toon("#fff7f4");
  const jewel = toon(JEWEL);
  const hairMat = toon("#ffffff", { map: paintHair(), roughness: 0.8 });
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
  head.position.y = 0.26;
  chest.add(head);

  const hair = new THREE.Group();
  hair.name = "hair";
  head.add(hair);

  const armL = new THREE.Bone();
  const armR = new THREE.Bone();
  armL.name = "armL";
  armR.name = "armR";
  armL.position.set(0.11, 0.12, 0);
  armR.position.set(-0.11, 0.12, 0);
  armL.rotation.set(...IDLE_ARM_L);
  armR.rotation.set(...IDLE_ARM_R);
  chest.add(armL, armR);

  const foreL = new THREE.Bone();
  const foreR = new THREE.Bone();
  foreL.name = "foreL";
  foreR.name = "foreR";
  foreL.position.y = -UPPER;
  foreR.position.y = -UPPER;
  foreL.rotation.set(...IDLE_FORE_L);
  foreR.rotation.set(...IDLE_FORE_R);
  armL.add(foreL);
  armR.add(foreR);

  const thighL = new THREE.Bone();
  const thighR = new THREE.Bone();
  thighL.name = "thighL";
  thighR.name = "thighR";
  thighL.position.set(0.04, -0.02, 0);
  thighR.position.set(-0.04, -0.02, 0);
  thighL.rotation.set(...IDLE_THIGH_L);
  thighR.rotation.set(...IDLE_THIGH_R);
  hips.add(thighL, thighR);

  const shinL = new THREE.Bone();
  const shinR = new THREE.Bone();
  shinL.name = "shinL";
  shinR.name = "shinR";
  shinL.position.y = -THIGH;
  shinR.position.y = -THIGH;
  shinL.rotation.x = IDLE_SHIN_L;
  shinR.rotation.x = IDLE_SHIN_R;
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
    [0.048, 0.34],
    [0.062, 0.32],
    [0.09, 0.3],
    [0.118, 0.28],
    [0.15, 0.255],
    [0.132, 0.22],
    [0.122, 0.18],
    [0.104, 0.14],
    [0.084, 0.1],
    [0.066, 0.055],
    [0.078, 0.015],
    [0.098, -0.03],
    [0.112, -0.08],
  ], BONE.chest, 72, 0.8);

  const sleeve = (arm: THREE.Object3D, fore: THREE.Object3D, armId: number, foreId: number) => {
    const shoulder = hipPoint(arm, hips);
    const chestPoint = hipPoint(chest, hips, new THREE.Vector3(0, 0.12, 0));
    shoulder.lerp(chestPoint, 0.42);
    const elbow = hipPoint(fore, hips);
    const wrist = hipPoint(fore, hips, new THREE.Vector3(0, -FORE, 0));
    const upperLen = shoulder.distanceTo(elbow);
    const pre = elbow.clone().lerp(shoulder, 0.14);
    const post = elbow.clone().lerp(wrist, 0.14);
    pushChain(
      outfit,
      [shoulder, pre, elbow, post, wrist],
      (t) => 0.06 + (0.027 - 0.06) * smoothstep(t),
      (dist, total) => {
        if (dist < upperLen - 0.02) {
          return [BONE.chest, armId, smoothstep((dist - upperLen * 0.04) / (upperLen * 0.46))];
        }
        const span = Math.max(0.04, total - upperLen);
        return [armId, foreId, smoothstep((dist - (upperLen - 0.02)) / (span * 0.42))];
      },
      26,
      34,
      "end",
    );
  };
  sleeve(armL, foreL, BONE.armL, BONE.foreL);
  sleeve(armR, foreR, BONE.armR, BONE.foreR);

  const legs = emptySurface();
  pushLathe(legs, [
    [0.04, 0.3],
    [0.034, 0.34],
    [0.031, 0.38],
    [0.03, 0.42],
  ], BONE.chest, 32, 0.9);
  const limb = (thigh: THREE.Object3D, shin: THREE.Object3D, thighId: number, shinId: number) => {
    const hip = hipPoint(thigh, hips);
    const knee = hipPoint(shin, hips);
    const ankle = hipPoint(shin, hips, new THREE.Vector3(0, -SHIN, 0));
    const thighLen = hip.distanceTo(knee);
    const pre = knee.clone().lerp(hip, 0.12);
    const post = knee.clone().lerp(ankle, 0.12);
    const keys = [0.078, 0.07, 0.06, 0.052, 0.036];
    pushChain(
      legs,
      [hip, pre, knee, post, ankle],
      (t) => {
        const scaled = t * (keys.length - 1);
        const index = Math.min(keys.length - 2, Math.floor(scaled));
        return THREE.MathUtils.lerp(keys[index], keys[index + 1], smoothstep(scaled - index));
      },
      (dist) => [thighId, shinId, smoothstep((dist - (thighLen - 0.055)) / 0.11)],
      30,
      40,
      "both",
    );
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
  const skirtRows = 64;
  const skirtRadial = 112;
  const skirtPos: number[] = [];
  const skirtIdx: number[] = [];
  for (let i = 0; i <= skirtRows; i += 1) {
    const t = i / skirtRows;
    const y = 0.1 + ( -0.36 - 0.1) * t;
    const hip = Math.sin(Math.min(1, t / 0.34) * Math.PI * 0.5);
    const ease = smoothstep(t);
    const rx = 0.106 + hip * 0.036 - ease * 0.012;
    const rz = 0.128 + hip * 0.078 - ease * 0.02;
    const lip = t > 0.97 ? Math.sin(((t - 0.97) / 0.03) * Math.PI) * 0.004 : 0;
    for (let j = 0; j < skirtRadial; j += 1) {
      const angle = (j / skirtRadial) * Math.PI * 2;
      skirtPos.push(Math.cos(angle) * (rx + lip), y, Math.sin(angle) * (rz + lip));
    }
  }
  for (let i = 0; i < skirtRows; i += 1) {
    for (let j = 0; j < skirtRadial; j += 1) {
      const j2 = (j + 1) % skirtRadial;
      const a = i * skirtRadial + j;
      const b = i * skirtRadial + j2;
      const c = a + skirtRadial;
      const d = b + skirtRadial;
      skirtIdx.push(a, b, c, b, d, c);
    }
  }
  const skirtGeo = new THREE.BufferGeometry();
  skirtGeo.setAttribute("position", new THREE.Float32BufferAttribute(skirtPos, 3));
  skirtGeo.setIndex(skirtIdx);
  skirtGeo.computeVertexNormals();
  const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
  skirtMesh.castShadow = true;
  skirtMesh.receiveShadow = true;
  skirt.add(skirtMesh);
  hips.add(skirt);

  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.0016, 8, 28), jewel);
  chain.rotation.x = Math.PI / 2;
  chain.position.set(0, 0.2, 0.012);
  chest.add(chain);
  const pendant = new THREE.Mesh(new THREE.SphereGeometry(0.007, 16, 12), jewel);
  pendant.name = "pendant";
  pendant.scale.set(0.5, 1.25, 0.32);
  pendant.position.set(0, 0.162, 0.048);
  chest.add(pendant);

  const faceMat = toon("#ffffff", { map: faceTexture(), roughness: 0.94, metalness: 0 });
  const skull = new THREE.Mesh(fashionHead(), faceMat);
  skull.name = "face";
  skull.castShadow = true;
  head.add(skull);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), skin);
    ear.scale.set(0.38, 1.05, 0.62);
    ear.position.set(side * 0.072, -0.004, 0.012);
    head.add(ear);
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.0044, 12, 10), jewel);
    drop.name = "earring";
    drop.scale.set(0.45, 1.5, 0.32);
    drop.position.set(side * 0.074, -0.02, 0.016);
    head.add(drop);
  }

  addHair(hair, hairMat, hairSolid);

  const handL = fashionHand(skin);
  const handR = fashionHand(skin);
  handL.position.y = -FORE;
  handR.position.y = -FORE;
  foreL.add(handL);
  foreR.add(handR);
  bootL.add(boot(bootMat, lace, heelMat));
  bootR.add(boot(bootMat, lace, heelMat));

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

/** Absolute pose. Idle is the fashion plate: hand on hip, ankles crossed. */
export function poseGlamRig(rig: THREE.Object3D, mode: GlamPose | "apose", time: number) {
  const parts = glamParts(rig);
  const leftHand = handOf(parts.foreL);
  const rightHand = handOf(parts.foreR);
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
    if (leftHand) leftHand.rotation.set(0, 0, 0);
    if (rightHand) rightHand.rotation.set(0, 0, 0);
    return;
  }

  const walk = mode === "walk" ? 1 : 0;
  const wave = mode === "wave" ? 1 : 0;
  const sit = mode === "sit" ? 1 : 0;
  const cycle = time * 6.4;
  const swing = Math.sin(cycle);
  const breathe = Math.sin(time * 1.7);
  const idle = Math.max(1 - walk - sit - wave, 0);
  const stride = 0.62;

  parts.hips.position.y = HIP_Y - sit * 0.42 + walk * Math.abs(swing) * 0.03;
  parts.hips.rotation.set(walk * 0.03, walk * swing * 0.08 + idle * -0.12, walk * swing * 0.05 + idle * 0.06);
  parts.chest.rotation.set(breathe * 0.02 + sit * 0.08, 0, idle * -0.04);
  parts.chest.position.y = 0.16 + breathe * 0.004;
  parts.head.rotation.set(idle * -0.04, walk * swing * -0.05 + wave * 0.12 + idle * 0.14, idle * -0.02);
  parts.hair.rotation.set(breathe * 0.012 + walk * swing * 0.04, 0, walk * swing * -0.02);
  parts.skirt.rotation.set(walk * 0.04 + sit * 0.28, 0, walk * swing * -0.04 + idle * 0.03);

  parts.thighL.rotation.set(
    THREE.MathUtils.lerp(IDLE_THIGH_L[0], -swing * stride, walk) * (1 - sit) + sit * -1.28,
    THREE.MathUtils.lerp(IDLE_THIGH_L[1], 0, walk) * (1 - sit),
    THREE.MathUtils.lerp(IDLE_THIGH_L[2], 0.02, walk) * (1 - sit) + sit * 0.08,
  );
  parts.thighR.rotation.set(
    THREE.MathUtils.lerp(IDLE_THIGH_R[0], swing * stride, walk) * (1 - sit) + sit * -1.28,
    THREE.MathUtils.lerp(IDLE_THIGH_R[1], 0, walk) * (1 - sit),
    THREE.MathUtils.lerp(IDLE_THIGH_R[2], -0.02, walk) * (1 - sit) + sit * -0.08,
  );
  parts.shinL.rotation.set((1 - sit) * (walk * Math.max(0, swing) * 0.9 + idle * IDLE_SHIN_L) + sit * 1.35, 0, 0);
  parts.shinR.rotation.set((1 - sit) * (walk * Math.max(0, -swing) * 0.9 + idle * IDLE_SHIN_R) + sit * 1.35, 0, 0);
  parts.bootL.rotation.set(-(parts.thighL.rotation.x + parts.shinL.rotation.x) * (sit ? 0.15 : 0.84), 0, 0);
  parts.bootR.rotation.set(-(parts.thighR.rotation.x + parts.shinR.rotation.x) * (sit ? 0.15 : 0.84), idle * 0.2, 0);

  if (walk) {
    parts.armL.rotation.set(swing * 0.55, 0, 0.22);
    parts.armR.rotation.set(-swing * 0.55, 0, -0.22);
    parts.foreL.rotation.set(0.35, 0, 0.04);
    parts.foreR.rotation.set(0.35, 0, -0.04);
    if (leftHand) leftHand.rotation.set(0, 0, 0);
    if (rightHand) rightHand.rotation.set(0, 0, 0);
  } else if (wave) {
    parts.armL.rotation.set(-1.45, 0.1, 0.18);
    parts.armR.rotation.set(0.15, 0, -0.28);
    parts.foreL.rotation.set(0.35 + Math.sin(time * 9) * 0.4, 0, 0.15);
    parts.foreR.rotation.set(0.3, 0, -0.08);
    if (leftHand) leftHand.rotation.set(0, 0, 0.4);
    if (rightHand) rightHand.rotation.set(0, 0, 0);
  } else if (sit) {
    parts.armL.rotation.set(-0.35, 0.05, 0.22);
    parts.armR.rotation.set(-0.4, -0.05, -0.22);
    parts.foreL.rotation.set(0.75, 0, 0.08);
    parts.foreR.rotation.set(0.78, 0, -0.08);
    if (leftHand) leftHand.rotation.set(0.2, 0, 0);
    if (rightHand) rightHand.rotation.set(0.2, 0, 0);
  } else {
    parts.armL.rotation.set(...IDLE_ARM_L);
    parts.armR.rotation.set(...IDLE_ARM_R);
    parts.foreL.rotation.set(...IDLE_FORE_L);
    parts.foreR.rotation.set(...IDLE_FORE_R);
    if (leftHand) leftHand.rotation.set(0.1, 0, 0.05);
    if (rightHand) rightHand.rotation.set(0.35, -0.45, 0.25);
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
