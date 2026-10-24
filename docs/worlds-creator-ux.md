# Worlds character creator

The creator at `/worlds/create` (production mount `/portal/worlds/create`) edits the version 1 look stored in `office_characters`. Saving a user character writes that row. The office reads it with `GET /api/worlds/characters?mine=1` and applies it to the You actor.

## Mesh

The studio and the office both draw `CharacterFigure` from `public/worlds/humanoid.glb` (the full-body mesh on PR #210 after the crew-collar cleanup). Saving a look still writes version 1, and office You wears that same rig.

Arm QC passed for stand, walk, and sit with continuous arms. The #210 crew collar closes the earlier jagged collar. The studio uses that cleaned file.

## Gaps

- Studio emotes play the humanoid clips for idle, walk, wave, and sit. Cheer, dance, and think are on the rig and are not buttons here.
- Top and outerwear share the `top` slot. A shirt replaces a coat, and a coat replaces a shirt. There is no second outerwear layer in version 1.
- Several item ids share one garment mesh. Scarf, bag, badge, and watch have no mesh on this GLB.
- A category with no meshed ids, a worn id the builder does not draw, or a failed WebGL context shows an empty or error state. The office skips a piece it cannot draw.

## Concept sheet

The preview is a two-by-two sheet on neutral light gray `#e6e6e6`: front, side, back, and a profile headshot. One humanoid and one office light rig feed every cell, so the clothing, hair, and expression match across angles. The legend reads adult woman, content-creator archetype, body shape and size, expression, and each worn piece with its fabric name and color. Compare keeps the current look on the body views and the last saved look on the profile headshot.

## Studio light and the office HUD

The sheet uses the office interior palette from `Lights` in `office-canvas.tsx`: sky `#fff7ee`, ground `#6a5848`, sun `#fff3dd`, key `#fff1d6`, lamp `#f6e2b8`. Stage pills use the same cream, `#d6cec1` border, and shadow as `.office-hud` and `.office-panel`.

No separate HUD light rig has landed. When one does, replace the `STUDIO_*` constants in `character-stage.tsx` with that rig so the creator and the office stay on the same light.

On a narrow viewport the picker is a bottom sheet. The concept sheet sits in the band above it. Tapping the sheet scrim hides the picker.
