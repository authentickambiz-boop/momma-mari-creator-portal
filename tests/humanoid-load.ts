import { NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression, KHRTextureBasisu } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import { fileURLToPath } from "node:url";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Decode the artist GLB for node tests. Textures stay on the GPU path in the browser. */
export async function loadHumanoidTemplate() {
  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression, KHRTextureBasisu])
    .registerDependencies({ "draco3d.decoder": await draco3d.createDecoderModule() });
  const path = fileURLToPath(new URL("../public/worlds/humanoid.glb", import.meta.url));
  const doc = await io.read(path);
  for (const material of doc.getRoot().listMaterials()) {
    material.setBaseColorTexture(null);
    material.setNormalTexture(null);
    material.setMetallicRoughnessTexture(null);
    material.setOcclusionTexture(null);
    material.setEmissiveTexture(null);
  }
  for (const texture of [...doc.getRoot().listTextures()]) texture.dispose();
  for (const extension of [...doc.getRoot().listExtensionsUsed()]) extension.dispose();
  const bytes = await new NodeIO().writeBinary(doc);
  const loader = new GLTFLoader();
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return loader.parseAsync(copy, "");
}
