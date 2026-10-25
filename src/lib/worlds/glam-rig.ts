/**
 * Locked glam Office You. Sculpted fashion figure with soft toon shading,
 * a painted face, and a continuous outfit. Other looks stay on the humanoid rig.
 */

import * as THREE from "three";

export const GLAM_HEIGHT = 1.74;

export const GLAM_POSES = ["idle", "walk", "wave", "sit"] as const;
export type GlamPose = (typeof GLAM_POSES)[number];

const SKIN = "#f2c3a6";
const HAIR = "#7a3498";
const HAIR_DEEP = "#43185f";
const HAIR_LIGHT = "#d2aee0";
const TOP = "#ee5a90";
const TOP_SHADE = "#c43870";
const SKIRT = "#3e8eac";
const SKIRT_SHADE = "#2c6c86";
const BOOT = "#e43778";
const JEWEL = "#f6f3ee";

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
const HEAD_SCALE = 0.092;

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

let sharedGradient: THREE.DataTexture | null = null;

function toonGradient() {
  if (sharedGradient) return sharedGradient;
  const steps = [176, 196, 214, 228, 240, 250, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((value, index) => {
    data[index * 4] = value;
    data[index * 4 + 1] = value;
    data[index * 4 + 2] = value;
    data[index * 4 + 3] = 255;
  });
  const texture = new THREE.DataTexture(data, steps.length, 1);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  sharedGradient = texture;
  return texture;
}

function toon(color: string, extra: Partial<THREE.MeshToonMaterialParameters> = {}) {
  const material = new THREE.MeshToonMaterial({
    color,
    gradientMap: toonGradient(),
    ...extra,
  });
  material.toneMapped = false;
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
  segments = 48,
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
  radial = 20,
  profile: [number, number] = [1, 1],
  caps: "both" | "start" | "end" | "none" = "both",
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
    let wB = 0;
    if (dist >= blend1) wB = 1;
    else if (dist > blend0) wB = (dist - blend0) / Math.max(0.0001, blend1 - blend0);
    return wB * wB * (3 - 2 * wB);
  };
  for (let i = 0; i < rows; i += 1) {
    const t = i / (rows - 1);
    const dist = t * length;
    const center = origin.clone().addScaledVector(axis, dist);
    for (let j = 0; j < radial; j += 1) {
      const angle = (j / radial) * Math.PI * 2;
      const offset = side.clone().multiplyScalar(Math.cos(angle) * radii[i] * profile[0])
        .addScaledVector(bin, Math.sin(angle) * radii[i] * profile[1]);
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
      surface.indices.push(a, c, b, b, c, d);
    }
  }
  const cap = (row: number, inward: number) => {
    const centerIndex = surface.positions.length / 3;
    const yRow = row / (rows - 1);
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

function paintFace() {
  const size = 384;
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
  const skin: RGB = [242, 195, 166];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) blend(x, y, skin, 1);
  }
  const ellipse = (u: number, v: number, ru: number, rv: number, rgb: RGB, softness = 0.35) => {
    const cx = u * (size - 1);
    const cy = v * (size - 1);
    const rx = Math.max(1, ru * (size - 1));
    const ry = Math.max(1, rv * (size - 1));
    for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y += 1) {
      for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x += 1) {
        const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (e > 1) continue;
        blend(x, y, rgb, Math.min(1, (1 - e) / Math.max(0.08, softness)));
      }
    }
  };
  ellipse(0.5, 0.62, 0.1, 0.04, [255, 220, 198], 0.8);
  ellipse(0.32, 0.46, 0.07, 0.035, [226, 140, 132], 0.8);
  ellipse(0.68, 0.46, 0.07, 0.035, [226, 140, 132], 0.8);
  ellipse(0.5, 0.5, 0.02, 0.05, [255, 214, 190], 0.75);

  const texture = new THREE.DataTexture(data, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function paintIris() {
  const size = 96;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x / (size - 1)) * 2 - 1;
      const v = (y / (size - 1)) * 2 - 1;
      const r = Math.hypot(u, v);
      const i = (y * size + x) * 4;
      let rgb: RGB = [28, 10, 24];
      if (r < 0.2) rgb = [24, 8, 20];
      else if (r < 0.38) rgb = [214, 120, 214];
      else if (r < 0.7) rgb = [176, 64, 186];
      else if (r < 0.88) rgb = [98, 32, 112];
      else rgb = [42, 14, 48];
      const spokes = Math.pow(Math.abs(Math.sin(Math.atan2(v, u) * 7)), 6) * 0.18;
      if (r > 0.24 && r < 0.78) {
        rgb = [
          Math.min(255, rgb[0] + spokes * 80),
          Math.min(255, rgb[1] + spokes * 30),
          Math.min(255, rgb[2] + spokes * 70),
        ];
      }
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function fashionHead() {
  const geometry = new THREE.SphereGeometry(1, 64, 48);
  const position = geometry.attributes.position;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i += 1) {
    let x = position.getX(i);
    let y = position.getY(i);
    let z = position.getZ(i);
    x *= 0.76;
    y *= 1.08;
    z *= 0.9;
    if (y < 0) {
      const taper = Math.min(1, -y / 1.05);
      y = -Math.pow(taper, 1.45) * 0.58;
      x *= 1 - taper * 0.42;
      z *= 1 - taper * 0.16;
    }
    const brow = Math.exp(-(x * x) / 0.22) * Math.exp(-((y - 0.2) ** 2) / 0.018);
    if (z > 0) z += brow * 0.07;
    const cheek = Math.exp(-((y - 0.0) ** 2) / 0.06) * Math.exp(-((Math.abs(x) - 0.32) ** 2) / 0.035);
    if (z > 0) z += cheek * 0.055;
    const socket = ((Math.abs(x) - 0.28) ** 2) / 0.05 + ((y - 0.08) ** 2) / 0.026;
    if (socket < 1 && z > 0.05) z -= (1 - socket) * 0.06;
    const nose = Math.exp(-(x * x) / 0.012) * Math.exp(-((y + 0.02) ** 2) / 0.028);
    if (z > 0.05) z += nose * 0.26;
    const lip = Math.exp(-(x * x) / 0.04) * Math.exp(-((y + 0.18) ** 2) / 0.01);
    if (z > 0) z += lip * 0.07;
    const u = 0.5 + x * 0.52;
    const v = 0.46 + y * 0.38;
    uv[i * 2] = THREE.MathUtils.clamp(u, 0.02, 0.98);
    uv[i * 2 + 1] = THREE.MathUtils.clamp(v, 0.02, 0.98);
    position.setXYZ(i, x, y, z);
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  geometry.scale(HEAD_SCALE, HEAD_SCALE, HEAD_SCALE);

  const index = geometry.getIndex();
  const pos = geometry.attributes.position;
  const faceList: number[] = [];
  const hairList: number[] = [];
  if (index) {
    for (let t = 0; t < index.count; t += 3) {
      const a = index.getX(t);
      const b = index.getX(t + 1);
      const c = index.getX(t + 2);
      const z = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
      const y = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3;
      const skin = y > -0.06 && ((z > 0.04 && y < 0.058) || (z > 0.02 && y < 0.028));
      (skin ? faceList : hairList).push(a, b, c);
    }
    geometry.setIndex([...faceList, ...hairList]);
    geometry.clearGroups();
    geometry.addGroup(0, faceList.length, 0);
    geometry.addGroup(faceList.length, hairList.length, 1);
  }
  return geometry;
}

function frontPoint(geometry: THREE.BufferGeometry, x: number, y: number) {
  const pos = geometry.attributes.position;
  let best = Infinity;
  const pick = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    if (pz < 0.02) continue;
    const score = (px - x) ** 2 + (py - y) ** 2;
    if (score < best) {
      best = score;
      pick.set(px, py, pz);
    }
  }
  return pick;
}

function spherePatch(radius: number, phi0: number, phi1: number, theta0: number, theta1: number, phiSegs = 16, thetaSegs = 6) {
  const positions: number[] = [];
  const indices: number[] = [];
  const cols = phiSegs;
  const rows = thetaSegs;
  for (let iy = 0; iy <= rows; iy += 1) {
    const theta = theta0 + ((theta1 - theta0) * iy) / rows;
    for (let ix = 0; ix <= cols; ix += 1) {
      const phi = phi0 + ((phi1 - phi0) * ix) / cols;
      positions.push(
        radius * Math.sin(theta) * Math.sin(phi),
        radius * Math.cos(theta),
        radius * Math.sin(theta) * Math.cos(phi),
      );
    }
  }
  const stride = cols + 1;
  for (let iy = 0; iy < rows; iy += 1) {
    for (let ix = 0; ix < cols; ix += 1) {
      const a = iy * stride + ix;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function almondTheta(u: number, center: number, corner: number) {
  const edge = Math.sin(u * Math.PI);
  return corner + (center - corner) * edge;
}

function almondPatch(radius: number, upper: boolean) {
  const steps = 18;
  const rows = 5;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= rows; j += 1) {
    const v = j / rows;
    for (let i = 0; i <= steps; i += 1) {
      const u = i / steps;
      const phi = -1.05 + u * 2.1;
      const lash = upper ? almondTheta(u, 1.0, 1.32) : almondTheta(u, 1.55, 1.38);
      const far = upper ? 0.4 : 1.9;
      const theta = lash + (far - lash) * v;
      const r = radius * (1 + v * 0.03);
      positions.push(
        r * Math.sin(theta) * Math.sin(phi),
        r * Math.cos(theta),
        r * Math.sin(theta) * Math.cos(phi),
      );
    }
  }
  const stride = steps + 1;
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < steps; i += 1) {
      const a = j * stride + i;
      indices.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function lashStrip(radius: number, extra: number) {
  const steps = 16;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const u = i / steps;
    const phi = -1.02 + u * 2.04;
    const theta = almondTheta(u, 0.98, 1.3);
    const push = (r: number, th: number) => {
      positions.push(
        r * Math.sin(th) * Math.sin(phi),
        r * Math.cos(th),
        r * Math.sin(th) * Math.cos(phi),
      );
    };
    push(radius, theta);
    push(radius + extra, theta - 0.2);
  }
  for (let i = 0; i < steps; i += 1) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function browGeometry() {
  const steps = 14;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = -0.018 + t * 0.034;
    const arch = Math.sin(t * Math.PI) * 0.009 + Math.sin(t * Math.PI * 0.5) * 0.002;
    const y = arch;
    const z = 0.003 + Math.sin(t * Math.PI) * 0.002;
    const thick = 0.0026 * (0.55 + Math.sin(t * Math.PI));
    positions.push(x, y - thick, z);
    positions.push(x, y + thick * 0.45, z + 0.0016);
  }
  for (let i = 0; i < steps; i += 1) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function irisGeometry(radius: number) {
  const geometry = new THREE.SphereGeometry(radius, 20, 16);
  const pos = geometry.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    uv[i * 2] = THREE.MathUtils.clamp(0.5 + (pos.getX(i) / radius) * 0.49, 0.001, 0.999);
    uv[i * 2 + 1] = THREE.MathUtils.clamp(0.5 + (pos.getY(i) / radius) * 0.49, 0.001, 0.999);
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geometry;
}

function addEye(
  head: THREE.Object3D,
  anchor: THREE.Vector3,
  side: number,
  skinMat: THREE.Material,
  scleraMat: THREE.Material,
  irisMat: THREE.Material,
  pupilMat: THREE.Material,
  linerMat: THREE.Material,
  shadowMat: THREE.Material,
  glintMat: THREE.Material,
) {
  const eye = new THREE.Group();
  eye.position.copy(anchor);
  eye.position.z -= 0.002;
  const white = new THREE.Mesh(new THREE.SphereGeometry(0.0165, 24, 18), scleraMat);
  white.scale.z = 0.92;
  eye.add(white);
  const iris = new THREE.Mesh(irisGeometry(0.0094), irisMat);
  iris.position.z = 0.012;
  eye.add(iris);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 12, 10), pupilMat);
  pupil.position.z = 0.0188;
  eye.add(pupil);
  const glint = new THREE.Mesh(new THREE.SphereGeometry(0.0018, 8, 6), glintMat);
  glint.position.set(-0.0034, 0.0036, 0.0202);
  eye.add(glint);
  const shadow = new THREE.Mesh(spherePatch(0.018, -0.85, 0.85, 0.34, 0.78, 14, 4), shadowMat);
  const lid = new THREE.Mesh(almondPatch(0.018, true), skinMat);
  const lower = new THREE.Mesh(almondPatch(0.0172, false), skinMat);
  const lash = new THREE.Mesh(lashStrip(0.0174, 0.0045), linerMat);
  eye.add(shadow, lid, lower, lash);
  const brow = new THREE.Mesh(browGeometry(), linerMat);
  brow.position.set(side * -0.001, 0.02, 0.004);
  if (side < 0) brow.scale.x = -1;
  eye.add(brow);
  head.add(eye);
}

function addNose(head: THREE.Object3D, skinMat: THREE.Material, anchor: THREE.Vector3) {
  const bridge = new THREE.Mesh(new THREE.SphereGeometry(0.011, 16, 12), skinMat);
  bridge.scale.set(0.38, 1.25, 0.55);
  bridge.position.set(0, anchor.y + 0.014, anchor.z - 0.006);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0072, 16, 12), skinMat);
  tip.scale.set(0.85, 0.7, 0.8);
  tip.position.set(0, anchor.y - 0.002, anchor.z + 0.008);
  head.add(bridge, tip);
  for (const side of [-1, 1]) {
    const ala = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 12, 8), skinMat);
    ala.scale.set(1.15, 0.62, 0.7);
    ala.position.set(side * 0.0065, anchor.y - 0.005, anchor.z + 0.002);
    head.add(ala);
  }
}

function addLips(head: THREE.Object3D, lipMat: THREE.Material, shineMat: THREE.Material, anchor: THREE.Vector3) {
  const upper = new THREE.Mesh(new THREE.SphereGeometry(0.0155, 20, 14), lipMat);
  upper.scale.set(1.28, 0.36, 0.5);
  upper.position.set(0, anchor.y + 0.0035, anchor.z + 0.003);
  const lower = new THREE.Mesh(new THREE.SphereGeometry(0.0165, 20, 14), lipMat);
  lower.scale.set(1.16, 0.5, 0.58);
  lower.position.set(0, anchor.y - 0.0045, anchor.z + 0.005);
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 10, 8), shineMat);
  shine.scale.set(1.7, 0.42, 0.35);
  shine.position.set(-0.003, anchor.y - 0.003, anchor.z + 0.012);
  head.add(upper, lower, shine);
}

function hairRibbon(points: [number, number, number][], width0: number, width1: number, surface: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(...point)),
    false,
    "catmullrom",
    0.12,
  );
  const steps = 20;
  const across = 6;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const root = new THREE.Color(HAIR_DEEP);
  const mid = new THREE.Color(HAIR);
  const tip = new THREE.Color(HAIR_LIGHT);
  const radial = new THREE.Vector3();
  const widthDir = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const center = curve.getPoint(t);
    tangent.copy(curve.getTangent(t));
    radial.set(center.x, 0, center.z);
    if (radial.lengthSq() < 1e-4) radial.set(0, 0, 1);
    else radial.normalize();
    widthDir.crossVectors(tangent, radial);
    if (widthDir.lengthSq() < 1e-4) widthDir.set(1, 0, 0);
    else widthDir.normalize();
    center.addScaledVector(radial, 0.01);
    const width = THREE.MathUtils.lerp(width0, width1, t);
    const tone = root.clone().lerp(mid, Math.min(1, t * 1.15)).lerp(tip, Math.max(0, t - 0.5) * 1.5);
    for (let j = 0; j < across; j += 1) {
      const u = (j / (across - 1)) * 2 - 1;
      const camber = Math.cos(Math.abs(u) * Math.PI * 0.5) * width * 0.22;
      const offset = widthDir.clone().multiplyScalar(u * width * 0.5).addScaledVector(radial, camber);
      positions.push(center.x + offset.x, center.y + offset.y, center.z + offset.z);
      const shine = (1 - Math.abs(u)) * 0.16;
      colors.push(
        Math.min(1, tone.r + shine),
        Math.min(1, tone.g + shine * 0.55),
        Math.min(1, tone.b + shine * 0.9),
      );
    }
  }
  for (let i = 0; i < steps; i += 1) {
    for (let j = 0; j < across - 1; j += 1) {
      const a = i * across + j;
      const b = a + 1;
      const c = a + across;
      const d = c + 1;
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

function addHair(hair: THREE.Object3D, hairMat: THREE.Material) {
  for (let i = 0; i < 7; i += 1) {
    const s = (i / 6) * 2 - 1;
    hair.add(hairRibbon([
      [s * 0.02, 0.078, 0.02],
      [s * 0.04, 0.092, -0.01],
      [s * 0.05, 0.06, -0.05],
    ], 0.05, 0.028, hairMat));
  }
  for (let i = 0; i < 16; i += 1) {
    const s = (i / 15) * 2 - 1;
    const span = Math.abs(s);
    const wave = Math.sin(i * 1.35);
    const rootZ = -0.045 - (1 - span) * 0.02;
    const rootX = s * (0.03 + span * 0.042);
    hair.add(hairRibbon([
      [rootX, 0.086 - span * 0.008, rootZ],
      [rootX + s * 0.02, 0.02, rootZ - 0.02],
      [s * 0.135 + wave * 0.02, -0.12, rootZ - 0.015],
      [s * 0.09 - wave * 0.025, -0.3, rootZ - 0.02],
      [s * 0.11 + wave * 0.015, -0.52 - span * 0.05, rootZ - 0.01],
    ], 0.052 - span * 0.008, 0.016, hairMat));
  }
  for (const side of [-1, 1]) {
    hair.add(hairRibbon([
      [side * 0.04, 0.074, 0.015],
      [side * 0.1, 0.0, 0.02],
      [side * 0.145, -0.14, -0.01],
      [side * 0.12, -0.34, -0.02],
      [side * 0.11, -0.52, -0.02],
    ], 0.048, 0.016, hairMat));
  }
  hair.add(hairRibbon([
    [0.045, 0.07, 0.03],
    [0.0, 0.056, 0.078],
    [-0.048, 0.044, 0.052],
  ], 0.044, 0.02, hairMat));
  hair.add(hairRibbon([
    [0.06, 0.062, 0.018],
    [0.012, 0.05, 0.07],
    [-0.038, 0.04, 0.048],
  ], 0.036, 0.016, hairMat));
  hair.add(hairRibbon([
    [-0.008, 0.068, 0.04],
    [-0.042, 0.05, 0.072],
    [-0.062, 0.04, 0.04],
  ], 0.03, 0.014, hairMat));
}

function boot(surface: THREE.Material, laceMat: THREE.Material, shade: THREE.Material, heelMat: THREE.Material) {
  const joint = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.034, -0.015),
    new THREE.Vector2(0.042, 0.02),
    new THREE.Vector2(0.039, 0.055),
    new THREE.Vector2(0.046, 0.092),
  ], 22), surface);
  shaft.castShadow = true;
  joint.add(shaft);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.0045, 8, 18), shade);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = 0.09;
  joint.add(cuff);
  const foot = new THREE.Mesh(new THREE.SphereGeometry(0.026, 18, 14), surface);
  foot.scale.set(0.72, 0.4, 1.9);
  foot.position.set(0, -0.008, 0.046);
  foot.castShadow = true;
  joint.add(foot);
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.12), shade);
  sole.position.set(0, -0.026, 0.032);
  joint.add(sole);
  const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.004, 0.078, 10), surface);
  heel.position.set(0, -0.06, -0.012);
  heel.castShadow = true;
  joint.add(heel);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, 0.02), heelMat);
  tip.position.set(0, -0.098, -0.012);
  joint.add(tip);
  for (let i = 0; i < 4; i += 1) {
    const y = 0.028 - i * 0.016;
    const left = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, 0.03, 5), laceMat);
    left.rotation.z = 0.75;
    left.position.set(0, y, 0.044);
    const right = left.clone();
    right.rotation.z = -0.75;
    right.position.z = 0.045;
    joint.add(left, right);
  }
  return joint;
}

function fashionHand(skinMat: THREE.Material) {
  const root = new THREE.Group();
  root.name = "hand";
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 12), skinMat);
  palm.scale.set(1.05, 1.2, 0.42);
  palm.position.y = -0.008;
  palm.castShadow = true;
  root.add(palm);
  for (let i = 0; i < 4; i += 1) {
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.0036, 0.032, 3, 6), skinMat);
    finger.position.set(-0.011 + i * 0.0074, -0.046, 0.003);
    finger.rotation.z = (i - 1.5) * 0.07;
    root.add(finger);
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0042, 0.018, 3, 6), skinMat);
  thumb.rotation.z = 0.95;
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
  const faceMat = toon("#ffffff", { map: paintFace() });
  const top = toon(TOP);
  const topShade = toon(TOP_SHADE);
  const skirtMat = toon(SKIRT, { side: THREE.DoubleSide });
  const skirtShade = toon(SKIRT_SHADE);
  const bootMat = toon(BOOT);
  const bootShade = toon("#c42d68");
  const heelMat = toon("#2a1820");
  const lace = toon("#fff7f4");
  const jewel = toon(JEWEL);
  const hairMat = toon("#ffffff", { vertexColors: true, side: THREE.DoubleSide });
  const scleraMat = toon("#fff8f5");
  const irisMat = new THREE.MeshBasicMaterial({ map: paintIris() });
  irisMat.toneMapped = false;
  const pupilMat = toon("#14080e");
  const linerMat = toon("#1a0e14", { side: THREE.DoubleSide });
  const shadowMat = toon("#6a3870", { side: THREE.DoubleSide });
  const lidSkin = toon(SKIN, { side: THREE.DoubleSide });
  const glintMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  glintMat.toneMapped = false;
  const lipMat = new THREE.MeshStandardMaterial({
    color: "#e48b9c",
    roughness: 0.24,
    metalness: 0.16,
    emissive: "#6a2434",
    emissiveIntensity: 0.2,
  });
  lipMat.toneMapped = false;
  const shineMat = new THREE.MeshBasicMaterial({ color: "#ffe4ea" });
  shineMat.toneMapped = false;
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
    [0.068, 0.31],
    [0.096, 0.28],
    [0.134, 0.25],
    [0.12, 0.18],
    [0.094, 0.11],
    [0.062, 0.04],
    [0.086, -0.015],
    [0.11, -0.09],
  ], BONE.chest, 56, 0.8);

  const sleeve = (arm: THREE.Object3D, fore: THREE.Object3D, armId: number, foreId: number) => {
    const shoulder = hipPoint(arm, hips);
    const chestPoint = hipPoint(chest, hips);
    shoulder.lerp(chestPoint, 0.3);
    const elbow = hipPoint(fore, hips);
    const wrist = hipPoint(fore, hips, new THREE.Vector3(0, -FORE, 0));
    const upperLen = shoulder.distanceTo(elbow);
    const foreLen = elbow.distanceTo(wrist);
    pushTube(
      outfit,
      shoulder,
      elbow,
      [0.05, 0.044, 0.039, 0.035],
      BONE.chest,
      armId,
      upperLen * 0.12,
      upperLen * 0.48,
      18,
      [0.92, 1],
      "none",
    );
    pushTube(
      outfit,
      elbow,
      wrist,
      [0.034, 0.031, 0.028, 0.026],
      armId,
      foreId,
      foreLen * 0.06,
      foreLen * 0.32,
      16,
      [0.9, 1],
      "end",
    );
  };
  sleeve(armL, foreL, BONE.armL, BONE.foreL);
  sleeve(armR, foreR, BONE.armR, BONE.foreR);

  const legs = emptySurface();
  pushLathe(legs, [
    [0.034, 0.3],
    [0.031, 0.36],
    [0.03, 0.41],
  ], BONE.chest, 28, 0.88);
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
      [0.066, 0.064, 0.056, 0.049, 0.046],
      thighId,
      thighId,
      thighLen,
      thighLen + 1,
      22,
      [0.86, 1.04],
      "start",
    );
    pushTube(
      legs,
      knee,
      ankle,
      [0.046, 0.042, 0.05, 0.044, 0.034, 0.028],
      thighId,
      shinId,
      shinLen * 0.08,
      shinLen * 0.36,
      20,
      [0.88, 1.02],
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
  const skirtGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0.104, -0.2),
    new THREE.Vector2(0.112, -0.14),
    new THREE.Vector2(0.132, -0.06),
    new THREE.Vector2(0.116, 0.01),
    new THREE.Vector2(0.09, 0.07),
  ], 56);
  const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
  skirtMesh.scale.z = 0.84;
  skirtMesh.castShadow = true;
  skirtMesh.receiveShadow = true;
  skirt.add(skirtMesh);
  const waistband = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.007, 8, 28), skirtShade);
  waistband.rotation.x = Math.PI / 2;
  waistband.scale.z = 0.84;
  waistband.position.y = 0.07;
  skirt.add(waistband);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.106, 0.006, 8, 28), skirtShade);
  hem.rotation.x = Math.PI / 2;
  hem.scale.z = 0.84;
  hem.position.y = -0.2;
  skirt.add(hem);
  const skirtSeam = new THREE.Mesh(new THREE.CylinderGeometry(0.0014, 0.0014, 0.24, 6), skirtShade);
  skirtSeam.position.set(0.0, -0.06, 0.1);
  skirt.add(skirtSeam);
  hips.add(skirt);

  for (const side of [-1, 1]) {
    const seam = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.15, 6), topShade);
    seam.position.set(side * 0.055, 0.1, 0.055);
    seam.rotation.z = side * -0.22;
    chest.add(seam);
  }
  for (const fore of [foreL, foreR]) {
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.0035, 6, 14), topShade);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -FORE;
    fore.add(cuff);
  }

  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.0015, 6, 24), jewel);
  chain.rotation.x = Math.PI / 2.35;
  chain.position.set(0, -0.055, 0.03);
  head.add(chain);
  const pendant = new THREE.Mesh(new THREE.SphereGeometry(0.009, 14, 12), jewel);
  pendant.name = "pendant";
  pendant.scale.set(0.42, 1.2, 0.28);
  pendant.position.set(0, -0.078, 0.055);
  head.add(pendant);

  const skullGeo = fashionHead();
  const skull = new THREE.Mesh(skullGeo, [faceMat, hairSolid]);
  skull.name = "face";
  skull.castShadow = true;
  head.add(skull);

  const eyeL = frontPoint(skullGeo, -0.022, 0.008);
  const eyeR = frontPoint(skullGeo, 0.022, 0.008);
  addEye(head, eyeL, -1, lidSkin, scleraMat, irisMat, pupilMat, linerMat, shadowMat, glintMat);
  addEye(head, eyeR, 1, lidSkin, scleraMat, irisMat, pupilMat, linerMat, shadowMat, glintMat);
  addNose(head, skin, frontPoint(skullGeo, 0, -0.002));
  addLips(head, lipMat, shineMat, frontPoint(skullGeo, 0, -0.017));
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.011, 14, 10), skin);
    ear.scale.set(0.36, 1.05, 0.62);
    ear.position.set(side * 0.064, -0.004, 0);
    head.add(ear);
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 10, 8), jewel);
    drop.name = "earring";
    drop.scale.set(0.42, 1.55, 0.28);
    drop.position.set(side * 0.066, -0.02, 0.006);
    head.add(drop);
  }

  addHair(hair, hairMat);

  const handL = fashionHand(skin);
  const handR = fashionHand(skin);
  handL.position.y = -FORE;
  handR.position.y = -FORE;
  foreL.add(handL);
  foreR.add(handR);
  bootL.add(boot(bootMat, lace, bootShade, heelMat));
  bootR.add(boot(bootMat, lace, bootShade, heelMat));

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
  let gradientDisposed = false;
  materials.forEach((item) => {
    const textured = item as THREE.MeshToonMaterial;
    textured.map?.dispose();
    if (textured.gradientMap && !gradientDisposed) {
      textured.gradientMap.dispose();
      gradientDisposed = true;
    }
    item.dispose();
  });
  sharedGradient = null;
}
