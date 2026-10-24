"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { AnimationMixer, LoopOnce, LoopRepeat, SkinnedMesh, Vector3, type AnimationAction } from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { withBasePath } from "@/lib/format";
import type { CharacterConfig, CharacterPose } from "@/lib/worlds/character";
import {
  bindHumanoid,
  HUMANOID_CLIPS,
  SPRING_DISTANCE,
  stepSprings,
  type HumanoidEmote,
} from "@/lib/worlds/humanoid";

const HUMANOID_URL = withBasePath("/worlds/humanoid.glb");
const DRACO_URL = withBasePath("/worlds/draco/");
const BASIS_URL = withBasePath("/worlds/basis/");
const _world = new Vector3();
let ktx2: KTX2Loader | null = null;

function extendHumanoidLoader(gl: Parameters<KTX2Loader["detectSupport"]>[0]) {
  return (loader: { setKTX2Loader: (transcoder: KTX2Loader) => void }) => {
    if (!ktx2) ktx2 = new KTX2Loader().setTranscoderPath(BASIS_URL);
    ktx2.detectSupport(gl);
    loader.setKTX2Loader(ktx2);
  };
}

/**
 * The office and the creator studio share this rig, so a saved look matches You.
 * Collar edge polish is a follow-up and does not block this mesh.
 */
export function CharacterFigure({
  config,
  poseRef,
  emote,
  studio = false,
}: {
  config: CharacterConfig;
  poseRef?: RefObject<CharacterPose | null>;
  emote?: HumanoidEmote;
  studio?: boolean;
}) {
  const gl = useThree((state) => state.gl);
  const gltf = useGLTF(HUMANOID_URL, DRACO_URL, false, extendHumanoidLoader(gl) as never);
  const model = useMemo(() => bindHumanoid(gltf.scene, config), [gltf.scene, config]);
  const mixer = useMemo(() => new AnimationMixer(model.rig), [model]);
  const actions = useMemo(() => {
    const map = new Map<string, AnimationAction>();
    for (const clip of gltf.animations) {
      if ((HUMANOID_CLIPS as readonly string[]).includes(clip.name)) map.set(clip.name, mixer.clipAction(clip));
    }
    return map;
  }, [gltf.animations, mixer]);
  const mode = useRef("");
  const current = useRef<AnimationAction | null>(null);
  const play = useRef<(name: string, loop: boolean) => void>(() => {});

  useEffect(() => {
    const onDone = (event: { action: AnimationAction }) => {
      const name = event.action.getClip().name;
      if (name === "sitDown" && mode.current === "sit") play.current("sitIdle", true);
      if (name === "standUp" && mode.current !== "sit") play.current("idle", true);
    };
    mixer.addEventListener("finished", onDone);
    return () => {
      mixer.removeEventListener("finished", onDone);
      mixer.stopAllAction();
      model.dispose();
    };
  }, [mixer, model]);

  useFrame(({ camera }, dt) => {
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
    const pose = poseRef?.current;
    const wanted = emote ?? (pose?.moving ? "walk" : pose?.seated ? "sit" : "idle");
    if (wanted !== mode.current) {
      const leavingSit = mode.current === "sit" && wanted !== "sit";
      mode.current = wanted;
      if (wanted === "sit") play.current("sitDown", false);
      else if (leavingSit) play.current("standUp", false);
      else play.current(wanted, true);
    }
    mixer.update(dt);
    model.rig.getWorldPosition(_world);
    const near = studio || camera.position.distanceTo(_world) < SPRING_DISTANCE;
    stepSprings(model.springs, dt, near);
    model.rig.traverse((node) => {
      if (node.userData.lod === "trim") node.visible = near;
      if (node instanceof SkinnedMesh) node.castShadow = true;
    });
  });

  return <primitive object={model.rig} />;
}
