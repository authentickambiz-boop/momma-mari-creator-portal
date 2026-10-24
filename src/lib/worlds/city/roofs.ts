/** Pitched-roof poses. The slab sits on the wall top and meets at the ridge. */

export type RoofSlab = {
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotZ: number;
  length: number;
  thickness: number;
};

export function gableSlabs(
  w: number,
  h: number,
  pitch = 0.42,
  overhangX = 0.16,
  thickness = 0.12,
): { eave: number; ridge: number; slabs: [RoofSlab, RoofSlab] } {
  const half = w / 2 + overhangX;
  const rise = half * Math.tan(pitch);
  const slopeLen = half / Math.cos(pitch);
  const eave = h + 0.12;
  const lift = thickness / 2;
  const midX = half / 2;
  const midY = eave + rise / 2;
  const slabs: [RoofSlab, RoofSlab] = [
    {
      x: -midX - Math.sin(pitch) * lift,
      y: midY + Math.cos(pitch) * lift,
      z: 0,
      rotX: 0,
      rotZ: pitch,
      length: slopeLen,
      thickness,
    },
    {
      x: midX + Math.sin(pitch) * lift,
      y: midY + Math.cos(pitch) * lift,
      z: 0,
      rotX: 0,
      rotZ: -pitch,
      length: slopeLen,
      thickness,
    },
  ];
  return { eave, ridge: eave + rise, slabs };
}

export function shedSlab(
  d: number,
  h: number,
  pitch = 0.36,
  overhangZ = 0.28,
  thickness = 0.1,
): RoofSlab & { eave: number; ridge: number } {
  const span = d + overhangZ * 2;
  const rise = span * Math.tan(pitch);
  const slopeLen = span / Math.cos(pitch);
  const eave = h + 0.12;
  const lift = thickness / 2;
  return {
    x: 0,
    y: eave + rise / 2 + Math.cos(pitch) * lift,
    z: Math.sin(pitch) * lift,
    rotX: pitch,
    rotZ: 0,
    length: slopeLen,
    thickness,
    eave,
    ridge: eave + rise,
  };
}

export function slabPoint(slab: RoofSlab, localX: number, localY: number, localZ = 0) {
  const x = Math.cos(slab.rotZ) * localX - Math.sin(slab.rotZ) * localY;
  const y = Math.sin(slab.rotZ) * localX + Math.cos(slab.rotZ) * localY;
  const z = localZ;
  const y2 = Math.cos(slab.rotX) * y - Math.sin(slab.rotX) * z;
  const z2 = Math.sin(slab.rotX) * y + Math.cos(slab.rotX) * z;
  return { x: slab.x + x, y: slab.y + y2, z: slab.z + z2 };
}
