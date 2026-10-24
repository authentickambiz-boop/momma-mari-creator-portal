import { mkdirSync, writeFileSync } from "node:fs";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { defaultCharacter } from "../src/lib/worlds/character";
import { createHumanoid, humanoidClips } from "../src/lib/worlds/humanoid";

class ArrayBufferReader {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
}

async function main() {
  Object.assign(globalThis, { FileReader: ArrayBufferReader });
  const config = defaultCharacter("humanoid");
  config.slots.hair = { item: "long", color: "#3d2314" };
  config.slots.top = { item: "jacket", color: "#2f6283" };
  config.slots.bottom = { item: "pants", color: "#1c211e" };
  config.slots.shoes = { item: "sneakers", color: "#f4f1ea" };
  const model = createHumanoid(config);
  const clips = humanoidClips();
  model.rig.traverse((node) => {
    const mesh = node as { material?: { normalMap: unknown } | { normalMap: unknown }[] };
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of materials) material.normalMap = null;
  });
  model.rig.animations = clips;
  const exporter = new GLTFExporter();
  const glb = await exporter.parseAsync(model.rig, { binary: true, animations: clips });
  mkdirSync("public/worlds", { recursive: true });
  const bytes = glb instanceof ArrayBuffer ? Buffer.from(glb) : Buffer.from(glb as unknown as ArrayBuffer);
  writeFileSync("public/worlds/humanoid.glb", bytes);
  console.log(`wrote ${bytes.length} bytes`);
  model.dispose();
}

void main();
