import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, describe, test } from "node:test";
import { SkinnedMesh } from "three";
import { defaultCharacter } from "../src/lib/worlds/character";
import {
  HUMANOID_CLIPS,
  SIT_POSE,
  ankleHeight,
  createHumanoid,
  humanoidClips,
  migrateLook,
  setHumanoidTemplate,
  springBoneNames,
  stepSprings,
} from "../src/lib/worlds/humanoid";
import { loadHumanoidTemplate } from "./humanoid-load";

before(async () => {
  const gltf = await loadHumanoidTemplate();
  setHumanoidTemplate(gltf.scene, gltf.animations);
});

function dressed(top: string, bottom: string, hair = "long") {
  const config = defaultCharacter("owner");
  return {
    ...config,
    slots: {
      ...config.slots,
      hair: { item: hair, color: "#3d2314" },
      top: { item: top, color: "#2f6283" },
      bottom: { item: bottom, color: "#1c211e" },
      shoes: { item: "sneakers", color: "#f7f1e4" },
    },
  };
}

describe("Worlds humanoid", () => {
  test("clothing is skinned to the body and covered skin is left out", () => {
    const model = createHumanoid(dressed("jacket", "pants"));
    const body = model.rig.getObjectByName("body");
    const jacket = model.rig.getObjectByName("jacket");
    const pants = model.rig.getObjectByName("pants");
    assert.ok(body instanceof SkinnedMesh);
    assert.ok(jacket instanceof SkinnedMesh);
    assert.ok(pants instanceof SkinnedMesh);
    if (!(body instanceof SkinnedMesh) || !(jacket instanceof SkinnedMesh) || !(pants instanceof SkinnedMesh)) return;
    assert.equal(jacket.skeleton, body.skeleton);
    assert.equal(pants.skeleton, body.skeleton);
    const regions = body.userData.regions as string[];
    assert.equal(regions.includes("chest"), false);
    assert.equal(regions.includes("upperLegL"), false);
    assert.equal(regions.includes("footL"), false);
    assert.equal(regions.includes("head"), true);
    assert.equal(regions.includes("hands"), true);
    const weights = jacket.geometry.getAttribute("skinWeight");
    const indices = jacket.geometry.getAttribute("skinIndex");
    const names = jacket.skeleton.bones.map((bone) => bone.name);
    let coat = 0;
    for (let i = 0; i < weights.count; i += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) {
        const weight = weights.getComponent(i, k) as number;
        const index = indices.getComponent(i, k) as number;
        sum += weight;
        assert.ok(index >= 0 && index < names.length);
        if (weight > 0.2 && (names[index] === "coatHemL" || names[index] === "fur" || names[index] === "chest")) coat += 1;
      }
      assert.ok(Math.abs(sum - 1) < 0.02);
    }
    assert.ok(coat > 8);
    assert.ok(springBoneNames(dressed("jacket", "skirt", "long")).includes("fur"));
    assert.ok(springBoneNames(dressed("jacket", "skirt", "long")).includes("skirtHemL"));
    const face = model.rig.getObjectByName("softFace");
    assert.ok(face instanceof SkinnedMesh);
    assert.equal((face as SkinnedMesh).skeleton, body.skeleton);
    assert.ok(body.skeleton.bones.some((bone) => bone.name === "Head"));
    model.dispose();
  });

  test("the clip set blends idle, walk, sitting, and emotes", () => {
    const names = humanoidClips().map((clip) => clip.name);
    assert.deepEqual(names, [...HUMANOID_CLIPS]);
    const stand = ankleHeight();
    const sit = ankleHeight(SIT_POSE);
    assert.ok(stand > 0.04 && stand < 0.16, `stand ankle ${stand}`);
    assert.ok(sit > 0.02 && sit < 0.22, `sit ankle ${sit}`);
    assert.ok(sit < stand + 0.2);
    const saved = defaultCharacter("content");
    const moved = migrateLook(saved);
    assert.equal(moved.version, 1);
    assert.equal(moved.slots.top.item, saved.slots.top.item);
    assert.equal(moved.slots.hair.color, saved.slots.hair.color);
  });

  test("distant characters keep spring bones at rest", () => {
    const model = createHumanoid(dressed("hoodie", "skirt", "waves"));
    assert.ok(model.springs.length >= 3);
    const spring = model.springs[0];
    assert.ok(spring);
    if (!spring) return;
    spring.bone.position.x += 0.2;
    stepSprings(model.springs, 1 / 30, false);
    assert.ok(spring.bone.position.distanceTo(spring.rest) < 0.0001);
    stepSprings(model.springs, 1 / 30, true);
    assert.ok(spring.bone.position.distanceTo(spring.rest) < 0.09);
    model.dispose();
  });

  test("the checked-in glTF rig carries the skeleton and the clip names", () => {
    const bytes = readFileSync(new URL("../public/worlds/humanoid.glb", import.meta.url));
    assert.equal(bytes.subarray(0, 4).toString(), "glTF");
    assert.ok(bytes.length > 50_000);
    const text = bytes.toString("utf8");
    for (const name of ["sitDown", "sitIdle", "standUp", "wave", "coatHemL", "fur", "softFace"]) {
      assert.equal(text.includes(name), true, name);
    }
  });
});
