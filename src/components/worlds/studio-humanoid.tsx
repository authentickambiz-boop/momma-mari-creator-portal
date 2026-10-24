"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AnimationMixer, LoopOnce, LoopRepeat, Vector3, type AnimationAction, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { withBasePath } from "@/lib/format";
import type { CharacterConfig } from "@/lib/worlds/character";
import {
  SOFT_FACE_NODE,
  createHumanoid,
  glbHasSoftFace,
  humanoidClips,
  stepSprings,
  type HumanoidEmote,
} from "@/lib/worlds/humanoid";

const _world = new Vector3();

let landedFace: Promise<Object3D | null> | null = null;

function landedSoftFace() {
  if (landedFace) return landedFace;
  landedFace = (async () => {
    try {
      const response = await fetch(withBasePath("/worlds/humanoid.glb"));
      if (!response.ok) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!glbHasSoftFace(bytes)) return null;
      const gltf = await new GLTFLoader().parseAsync(bytes.buffer, "");
      return gltf.scene.getObjectByName(SOFT_FACE_NODE) ?? null;
    } catch {
      return null;
    }
  })();
  return landedFace;
}

/**
 * Creator preview of the PR #210 humanoid. The office still draws the chibi
 * until that rig lands there. A glTF node named softFace replaces this face
 * when that asset is in humanoid.glb.
 */
export function StudioHumanoid({
  config,
  emote,
}: {
  config: CharacterConfig;
  emote: HumanoidEmote;
}) {
  const model = useMemo(() => createHumanoid(config), [config]);
  const mixer = useMemo(() => new AnimationMixer(model.rig), [model]);
  const actions = useMemo(() => {
    const map = new Map<string, AnimationAction>();
    for (const clip of humanoidClips()) map.set(clip.name, mixer.clipAction(clip));
    return map;
  }, [mixer]);
  const mode = useRef("");
  const current = useRef<AnimationAction | null>(null);
  const play = useRef<(name: string, loop: boolean) => void>(() => {});

  useEffect(() => {
    let cancel = false;
    void landedSoftFace().then((node) => {
      if (cancel || !node) return;
      const head = model.rig.getObjectByName("head");
      const face = model.rig.getObjectByName("face");
      if (!head) return;
      face?.removeFromParent();
      const next = node.clone(true);
      next.name = "face";
      head.add(next);
    });
    const onDone = (event: { action: AnimationAction }) => {
      const name = event.action.getClip().name;
      if (name === "sitDown" && mode.current === "sit") play.current("sitIdle", true);
      if (name === "standUp" && mode.current !== "sit") play.current("idle", true);
    };
    mixer.addEventListener("finished", onDone);
    return () => {
      cancel = true;
      mixer.removeEventListener("finished", onDone);
      mixer.stopAllAction();
      model.dispose();
    };
  }, [mixer, model]);

  useFrame((_, dt) => {
    play.current = (name, loop) => {
      const next = actions.get(name);
      if (!next) return;
      next.reset();
      next.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
      next.clampWhenFinished = !loop;
      next.enabled = true;
      next.fadeIn(0.18).play();
      const previous = current.current;
      if (previous && previous !== next) previous.fadeOut(0.18);
      current.current = next;
    };
    if (emote !== mode.current) {
      const leavingSit = mode.current === "sit" && emote !== "sit";
      mode.current = emote;
      if (emote === "sit") play.current("sitDown", false);
      else if (leavingSit) play.current("standUp", false);
      else play.current(emote, true);
    }
    mixer.update(dt);
    model.rig.getWorldPosition(_world);
    stepSprings(model.springs, dt, true);
  });

  return <primitive object={model.rig} />;
}
