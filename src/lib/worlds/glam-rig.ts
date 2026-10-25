/**
 * Locked glam Office You.
 * One skinned hourglass body, one painted head, and a few thick tapered hair locks.
 * Other looks stay on the humanoid rig.
 */

import * as THREE from "three";

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
type Mark = { u: number; v: number };

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

function paintFace(marks: { eyeL: Mark; eyeR: Mark; browL: Mark; browR: Mark; nose: Mark; lip: Mark }) {
  const size = 512;
  const data = new Uint8Array(size * size * 4);
  const blend = (x: number, y: number, rgb: RGB, alpha: number) => {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= size || iy >= size || alpha <= 0) return;
    const i = (iy * size + ix) * 4;
    const t = Math.min(1, alpha);
    data[i] = data[i] * (1 - t) + rgb[0] * t;
    data[i + 1] = data[i + 1] * (1 - t) + rgb[1] * t;
    data[i + 2] = data[i + 2] * (1 - t) + rgb[2] * t;
    data[i + 3] = 255;
  };
  const skin: RGB = [242, 196, 168];
  const highlight: RGB = [255, 224, 206];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / (size - 1);
      const v = y / (size - 1);
      const dx = (u - 0.5) * 1.35;
      const dy = (v - 0.58) * 1.15;
      const shade = Math.min(1, dx * dx + dy * dy);
      const jaw = v < 0.34 ? (0.34 - v) * 0.45 : 0;
      blend(x, y, [
        highlight[0] * (1 - shade) + skin[0] * shade - jaw * 18,
        highlight[1] * (1 - shade) + skin[1] * shade - jaw * 22,
        highlight[2] * (1 - shade) + skin[2] * shade - jaw * 18,
      ], 1);
    }
  }
  const ellipse = (u: number, v: number, ru: number, rv: number, rgb: RGB, softness = 0.35, opacity = 1) => {
    const cx = u * (size - 1);
    const cy = v * (size - 1);
    const rx = Math.max(1.2, ru * (size - 1));
    const ry = Math.max(1.2, rv * (size - 1));
    for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y += 1) {
      for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x += 1) {
        const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (e > 1) continue;
        const edge = Math.min(1, (1 - e) / Math.max(0.04, softness));
        blend(x, y, rgb, edge * opacity);
      }
    }
  };

  const gap = Math.max(0.16, Math.abs(marks.eyeR.u - marks.eyeL.u));
  const eyeRu = 0.064;
  const eyeRv = 0.022;
  ellipse(marks.eyeL.u - 0.01, marks.eyeL.v - eyeRv * 1.15, 0.055, 0.028, [230, 142, 128], 0.9, 0.55);
  ellipse(marks.eyeR.u + 0.01, marks.eyeR.v - eyeRv * 1.15, 0.055, 0.028, [230, 142, 128], 0.9, 0.55);

  const paintEye = (mark: Mark, side: number) => {
    const cx = mark.u * (size - 1);
    const cy = mark.v * (size - 1);
    const rx = eyeRu * (size - 1);
    const ry = Math.max(8, eyeRv * (size - 1));
    const irisCx = cx - side * rx * 0.04;
    const irisCy = cy - ry * 0.05;
    const irisR = Math.min(rx * 0.5, ry * 1.05);
    for (let y = Math.floor(cy - ry * 1.8); y <= Math.ceil(cy + ry * 1.7); y += 1) {
      for (let x = Math.floor(cx - rx * 1.25); x <= Math.ceil(cx + rx * 1.25); x += 1) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        const edge = Math.sqrt(Math.max(0, 1 - nx * nx));
        const upper = 0.72 * edge;
        const lower = -0.95 * edge;
        const inOpening = Math.abs(nx) <= 1 && ny <= upper && ny >= lower;
        if (!inOpening) continue;
        const dIris = Math.hypot(x - irisCx, y - irisCy);
        if (dIris < irisR) {
          const r = dIris / irisR;
          let rgb: RGB = [150, 54, 176];
          if (r < 0.2) rgb = [24, 10, 22];
          else if (r < 0.48) rgb = [206, 112, 214];
          else if (r < 0.78) rgb = [156, 48, 184];
          else rgb = [78, 24, 102];
          blend(x, y, rgb, 1);
        } else {
          blend(x, y, [255, 250, 247], 1);
        }
      }
    }
    for (let y = Math.floor(cy - ry * 0.2); y <= Math.ceil(cy + ry * 1.35); y += 1) {
      for (let x = Math.floor(cx - rx * 1.35); x <= Math.ceil(cx + rx * 1.35); x += 1) {
        const nx = (x - cx) / rx;
        const edge = Math.sqrt(Math.max(0, 1 - Math.min(1, nx * nx)));
        const lidY = cy + 0.72 * edge * ry;
        const dist = Math.abs(y - lidY);
        if (Math.abs(nx) < 1.05 && dist < 2.4 && y > lidY - 3) {
          blend(x, y, [16, 8, 14], Math.min(1, (2.4 - dist) * 0.7));
        }
        if (Math.abs(nx) < 0.92 && y > lidY && y < lidY + ry * 0.55) {
          const smoke = 1 - (y - lidY) / (ry * 0.55);
          blend(x, y, [84, 42, 72], smoke * 0.45);
        }
        const outer = nx * side;
        if (outer > 0.78 && outer < 1.35 && y > cy - ry * 0.2 && y < lidY + 4) {
          blend(x, y, [16, 8, 14], 0.85);
        }
      }
    }
    for (let i = 0; i < 7; i += 1) {
      const t = i / 6;
      const nx = side * (t * 2 - 1);
      const edge = Math.sqrt(Math.max(0, 1 - (t * 2 - 1) ** 2));
      const x0 = cx + nx * rx * 0.92;
      const y0 = cy + 0.72 * edge * ry;
      ellipse(x0 / (size - 1), (y0 + 5) / (size - 1), 0.003, 0.012, [12, 6, 10], 0.4, 0.9);
    }
    ellipse((irisCx - irisR * 0.28) / (size - 1), (irisCy + irisR * 0.32) / (size - 1), 0.01, 0.008, [255, 255, 255], 0.15, 1);
    ellipse((irisCx + irisR * 0.22) / (size - 1), (irisCy - irisR * 0.12) / (size - 1), 0.004, 0.004, [255, 255, 255], 0.2, 0.95);
  };
  paintEye(marks.eyeL, -1);
  paintEye(marks.eyeR, 1);

  const paintBrow = (mark: Mark, side: number) => {
    for (let i = 0; i <= 26; i += 1) {
      const t = i / 26;
      const x = mark.u + side * (t - 0.42) * gap * 0.62;
      const arch = Math.sin(Math.max(0, t) * Math.PI);
      const y = mark.v + arch * gap * 0.055 - t * gap * 0.012;
      const thick = (0.4 + arch * 0.7) * gap * 0.028;
      ellipse(x, y, thick * 1.35, thick * 0.72, [42, 24, 32], 0.28, 0.95);
    }
  };
  paintBrow(marks.browL, -1);
  paintBrow(marks.browR, 1);

  const nose = marks.nose;
  ellipse(nose.u, nose.v + 0.03, 0.012, 0.045, [255, 226, 208], 0.75, 0.85);
  ellipse(nose.u, nose.v - 0.012, 0.016, 0.012, [214, 158, 136], 0.55, 0.7);
  ellipse(nose.u - 0.014, nose.v - 0.016, 0.009, 0.006, [176, 112, 102], 0.4, 0.8);
  ellipse(nose.u + 0.014, nose.v - 0.016, 0.009, 0.006, [176, 112, 102], 0.4, 0.8);

  const lip = marks.lip;
  const half = 0.055;
  ellipse(lip.u, lip.v + 0.007, half * 0.9, 0.012, [206, 72, 98], 0.22, 1);
  ellipse(lip.u, lip.v + 0.014, half * 0.14, 0.006, skin, 0.5, 0.8);
  ellipse(lip.u, lip.v - 0.008, half, 0.016, [226, 96, 118], 0.2, 1);
  ellipse(lip.u, lip.v + 0.001, half * 0.78, 0.004, [132, 48, 68], 0.35, 0.9);
  ellipse(lip.u - half * 0.18, lip.v - 0.008, half * 0.28, 0.005, [255, 214, 220], 0.35, 0.85);
  ellipse(lip.u, lip.v - 0.03, half * 0.7, 0.01, [214, 160, 142], 0.8, 0.35);

  const texture = new THREE.DataTexture(data, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = false;
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
    x *= 0.82;
    y *= 1.08;
    z *= 0.93;
    if (y < -0.22) {
      const t = Math.min(1, (-y - 0.22) / 0.9);
      const s = t * t * (3 - 2 * t);
      x *= 1 - s * 0.5;
      z *= 1 - s * 0.22;
    }
    const cheek = Math.exp(-((y - 0.02) ** 2) / 0.08) * Math.exp(-((Math.abs(x) - 0.28) ** 2) / 0.04);
    if (z > 0) z += cheek * 0.05;
    const socket = ((Math.abs(x) - 0.13) ** 2) / 0.03 + ((y - 0.12) ** 2) / 0.012;
    if (socket < 1 && z > 0.05) z -= (1 - socket) * 0.03;
    const brow = Math.exp(-((Math.abs(x) - 0.12) ** 2) / 0.035) * Math.exp(-((y - 0.24) ** 2) / 0.01);
    if (z > 0) z += brow * 0.03;
    const nose = Math.exp(-(x * x) / 0.008) * Math.exp(-(y * y) / 0.018);
    if (z > 0.05) z += nose * 0.11;
    const lip = Math.exp(-(x * x) / 0.022) * Math.exp(-((y + 0.18) ** 2) / 0.006);
    if (z > 0.05) z += lip * 0.04;
    const front = z > 0.02;
    if (front) {
      uv[i * 2] = THREE.MathUtils.clamp(0.5 + x * 0.58, 0.06, 0.94);
      uv[i * 2 + 1] = THREE.MathUtils.clamp(0.5 + y * 0.4, 0.06, 0.94);
    } else {
      uv[i * 2] = x < 0 ? 0.03 : 0.97;
      uv[i * 2 + 1] = 0.03;
    }
    position.setXYZ(i, x, y, z);
  }
  const nearest = (x: number, y: number): Mark => {
    let best = Infinity;
    let u = 0.5;
    let v = 0.5;
    for (let i = 0; i < position.count; i += 1) {
      const px = position.getX(i);
      const py = position.getY(i);
      const pz = position.getZ(i);
      if (pz < 0.15) continue;
      const score = (px - x) ** 2 + (py - y) ** 2;
      if (score < best) {
        best = score;
        u = uv[i * 2];
        v = uv[i * 2 + 1];
      }
    }
    return { u, v };
  };
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  const marks = {
    eyeL: nearest(-0.125, 0.11),
    eyeR: nearest(0.125, 0.11),
    browL: nearest(-0.12, 0.24),
    browR: nearest(0.12, 0.24),
    nose: nearest(0, 0.0),
    lip: nearest(0, -0.18),
  };
  geometry.computeVertexNormals();
  geometry.scale(HEAD_SCALE, HEAD_SCALE, HEAD_SCALE);
  return { geometry, marks };
}

function hairLock(points: [number, number, number][], radius0: number, radius1: number, material: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(...point)),
    false,
    "catmullrom",
    0.4,
  );
  const steps = 36;
  const radial = 16;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const root = new THREE.Color(HAIR_DEEP);
  const mid = new THREE.Color(HAIR);
  const tip = new THREE.Color(HAIR_LIGHT);
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
    const radius = THREE.MathUtils.lerp(radius0, radius1, t * t * (3 - 2 * t) * 0.35 + t * 0.65);
    const tone = root.clone().lerp(mid, Math.min(1, t * 1.25)).lerp(tip, Math.max(0, (t - 0.55) * 1.8));
    for (let j = 0; j < radial; j += 1) {
      const angle = (j / radial) * Math.PI * 2;
      offset
        .copy(normal)
        .multiplyScalar(Math.cos(angle) * radius)
        .addScaledVector(bin, Math.sin(angle) * radius * 0.9);
      positions.push(center.x + offset.x, center.y + offset.y, center.z + offset.z);
      const shine = Math.max(0, Math.cos(angle)) * 0.08 * (1 - t * 0.45);
      colors.push(
        Math.min(1, tone.r + shine),
        Math.min(1, tone.g + shine * 0.45),
        Math.min(1, tone.b + shine * 0.8),
      );
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
    const tone = row === 0 ? root : tip;
    colors.push(tone.r, tone.g, tone.b);
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
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
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
  cap.scale.set(1.16, 0.72, 0.9);
  cap.position.set(0, 0.09, -0.02);
  cap.castShadow = true;
  hair.add(cap);

  hair.add(hairLock([
    [-0.02, 0.09, -0.01],
    [-0.07, 0.02, -0.03],
    [-0.11, -0.16, -0.04],
    [-0.09, -0.36, -0.02],
    [-0.06, -0.56, 0.0],
  ], 0.072, 0.028, hairMat));
  hair.add(hairLock([
    [0.02, 0.09, -0.015],
    [0.07, 0.0, -0.04],
    [0.1, -0.18, -0.035],
    [0.08, -0.38, -0.015],
    [0.05, -0.55, 0.0],
  ], 0.064, 0.024, hairMat));
  hair.add(hairLock([
    [0.0, 0.095, -0.03],
    [0.0, -0.05, -0.07],
    [0.01, -0.28, -0.05],
    [-0.01, -0.5, -0.02],
  ], 0.07, 0.026, hairMat));
  hair.add(hairLock([
    [0.04, 0.055, 0.03],
    [0.01, 0.046, 0.055],
    [-0.035, 0.036, 0.05],
    [-0.06, 0.028, 0.03],
  ], 0.022, 0.01, hairMat));
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
  const hairSolid = toon(HAIR);
  const top = toon(TOP);
  const skirtMat = toon(SKIRT, { side: THREE.DoubleSide });
  const bootMat = toon(BOOT);
  const heelMat = toon("#2a1820");
  const lace = toon("#fff7f4");
  const jewel = toon(JEWEL);
  const hairMat = toon("#ffffff", { vertexColors: true });
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
    shoulder.lerp(chestPoint, 0.38);
    const elbow = hipPoint(fore, hips);
    const wrist = hipPoint(fore, hips, new THREE.Vector3(0, -FORE, 0));
    const upperLen = shoulder.distanceTo(elbow);
    const foreLen = elbow.distanceTo(wrist);
    pushTube(
      outfit,
      shoulder,
      elbow,
      [0.064, 0.056, 0.048, 0.042, 0.037, 0.034],
      BONE.chest,
      armId,
      upperLen * 0.08,
      upperLen * 0.55,
      26,
      "none",
    );
    const foreStart = elbow.clone().lerp(shoulder, 0.06);
    pushTube(
      outfit,
      foreStart,
      wrist,
      [0.034, 0.032, 0.03, 0.028, 0.026],
      armId,
      foreId,
      foreLen * 0.05,
      foreLen * 0.4,
      24,
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
    const shinLen = knee.distanceTo(ankle);
    pushTube(
      legs,
      hip,
      knee,
      [0.076, 0.074, 0.068, 0.06, 0.054, 0.05],
      thighId,
      thighId,
      thighLen,
      thighLen + 1,
      28,
      "start",
    );
    const shinStart = knee.clone().lerp(hip, 0.05);
    pushTube(
      legs,
      shinStart,
      ankle,
      [0.05, 0.046, 0.052, 0.048, 0.04, 0.034],
      thighId,
      shinId,
      shinLen * 0.06,
      shinLen * 0.42,
      26,
      "end",
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
  const skirtPoints: THREE.Vector2[] = [];
  for (let i = 0; i <= 28; i += 1) {
    const t = i / 28;
    const y = 0.078 - t * 0.32;
    const hipBulge = Math.exp(-((t - 0.26) ** 2) / 0.04);
    const hem = t > 0.9 ? ((t - 0.9) / 0.1) * 0.008 : 0;
    const radius = 0.09 + hipBulge * 0.042 - t * 0.01 + hem;
    skirtPoints.push(new THREE.Vector2(radius, y));
  }
  const skirtGeo = new THREE.LatheGeometry(skirtPoints, 72);
  skirtGeo.computeVertexNormals();
  const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
  skirtMesh.scale.z = 0.86;
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

  const sculpt = fashionHead();
  const faceMat = toon("#ffffff", { map: paintFace(sculpt.marks) });
  const skull = new THREE.Mesh(sculpt.geometry, faceMat);
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
