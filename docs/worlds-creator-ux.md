# Worlds character creator

The creator at `/worlds/create` (production mount `/portal/worlds/create`) edits the version 1 look stored in `office_characters`. Saving a user character writes that row. The office reads it with `GET /api/worlds/characters?mine=1` and applies it to the You actor.

## Mesh

The studio and the office both draw `CharacterFigure` from `public/worlds/humanoid.glb` (the full-body mesh on PR #210 after arm QC). Saving a look still writes version 1, and office You wears that same rig.

Arm QC passed for stand, walk, and sit with continuous arms. A jagged collar edge remains a follow-up polish and does not block this wire.

## Gaps

- Studio emotes play the humanoid clips for idle, walk, wave, and sit. Cheer, dance, and think are on the rig and are not buttons here.
- Top and outerwear share the `top` slot. A shirt replaces a coat, and a coat replaces a shirt. There is no second outerwear layer in version 1.
- Several item ids share one garment mesh. Scarf, bag, badge, and watch have no mesh on this GLB.
- The collar's jagged edge is polish for a later pass.
- A category with no meshed ids, a worn id the builder does not draw, or a failed WebGL context shows an empty or error state. The office skips a piece it cannot draw.

## Studio light and the office HUD

The turntable uses the office interior palette from `Lights` in `office-canvas.tsx`: sky `#fff7ee`, ground `#6a5848`, sun `#fff3dd`, key `#fff1d6`, lamp `#f6e2b8`. Stage pills use the same cream, `#d6cec1` border, and shadow as `.office-hud` and `.office-panel`.

No separate HUD light rig has landed. When one does, replace the `STUDIO_*` constants in `character-stage.tsx` with that rig so the creator and the office stay on the same light.

On a narrow viewport the picker is a bottom sheet over the full-bleed stage. Tapping the stage scrim hides it. The camera keeps the full body in the band above the sheet.
