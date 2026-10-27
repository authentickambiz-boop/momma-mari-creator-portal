"use client";

import { useEffect, useMemo, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { CharacterPose } from "@/lib/worlds/character";
import { createGlamRig, disposeGlamRig, poseGlamRig, type GlamPose } from "@/lib/worlds/glam-rig";

/** Office You as the locked glam figure. The face is sculpted on the rig, not a photo card. */
export function GlamFigure({ poseRef }: { poseRef?: RefObject<CharacterPose | null> }) {
  const rig = useMemo(() => createGlamRig(), []);

  useEffect(() => () => disposeGlamRig(rig), [rig]);

  useFrame(({ clock }) => {
    const pose = poseRef?.current;
    const mode: GlamPose = pose?.wave ? "wave" : pose?.moving ? "walk" : pose?.seated ? "sit" : "idle";
    poseGlamRig(rig, mode, pose?.moving ? pose.phase * 0.35 : clock.elapsedTime);
  });

  return <primitive object={rig} />;
}
