/** Stages for the office placeholder. Detail loads after the first picture. */
export const OFFICE_BOOT_STAGES = ["plan", "shell", "bots", "detail"] as const;

export type OfficeBootStage = (typeof OFFICE_BOOT_STAGES)[number];

const STEPS: Record<OfficeBootStage, { progress: number; label: string }> = {
  plan: { progress: 18, label: "Drawing the floor plan" },
  shell: { progress: 46, label: "Raising the walls" },
  bots: { progress: 74, label: "Seating the team" },
  detail: { progress: 100, label: "Adding the grounds" },
};

export function officeBootStep(stage: OfficeBootStage) {
  return STEPS[stage];
}
