# Worlds character creator

The creator at `/worlds/create` (production mount `/portal/worlds/create`) edits the version 1 look stored in `office_characters`. Saving a user character writes that row. The office reads it with `GET /api/worlds/characters?mine=1` and applies it to the You actor.

## Mesh

The studio previews the skinned humanoid from PR #210 (`src/lib/worlds/humanoid.ts`, `public/worlds/humanoid.glb`). The head is a high-segment oval with cheek volume, and the eyes and mouth are spheres and a curved lip, not boxes. Saved looks stay version 1.

The office still draws the chibi (`characterFigure`) until #210 lands on the desk. Saving still writes the same look, so You keeps the chosen hair, clothes, and colors.

If `humanoid.glb` gains a node named `softFace`, the studio swaps that mesh onto the head and drops the code-built face. Until that node is in the file, the studio builds the soft face in `faceOn`.

## Gaps until the humanoid lands in the office

- The office emotes are still limb pivots. The studio plays the humanoid clips for idle, walk, wave, and sit.
- Cheer, dance, and think exist on the rig and are not buttons in this creator.
- Top and outerwear share the `top` slot. A shirt replaces a coat, and a coat replaces a shirt.
- A category with no meshed ids, a worn id the builder does not draw, or a failed WebGL context shows an empty or error state. The office chibi skips a piece it cannot draw.

## Studio light and the office HUD

The turntable uses the office interior palette from `Lights` in `office-canvas.tsx`: sky `#fff7ee`, ground `#6a5848`, sun `#fff3dd`, key `#fff1d6`, lamp `#f6e2b8`. Stage pills use the same cream, `#d6cec1` border, and shadow as `.office-hud` and `.office-panel`.

No separate HUD light rig has landed. When one does, replace the `STUDIO_*` constants in `character-stage.tsx` with that rig so the creator and the office stay on the same light.

On a narrow viewport the picker is a bottom sheet over the full-bleed stage. Tapping the stage scrim hides it. The camera keeps the humanoid in the band above the sheet.
