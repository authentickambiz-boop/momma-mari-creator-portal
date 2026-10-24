# Worlds character creator

The creator at `/worlds/create` (production mount `/portal/worlds/create`) edits the version 1 look stored in `office_characters`. Saving a user character writes that row. The office reads it with `GET /api/worlds/characters?mine=1` and applies it to the You actor.

## Mesh

This studio uses the current chibi (`characterFigure`). That is the mesh the office draws for You, so a saved look matches the desk.

PR #210 (`cursor/worlds-humanoid-2ba0`) is open and not merged. Its `public/worlds/humanoid.glb` is an export of the sphere and cylinder rig in `humanoid.ts`. That file is not a finished soft-face mesh, so this creator does not preview it. When #210 adds a real humanoid GLB, the studio can show that asset and keep these categories, the turntable, and the version 1 save path.

## Gaps until a real humanoid GLB lands

- Emotes are limb pivots on the chibi: idle, walk, wave, and sit. They are not skeletal clips. Cheer, dance, and think from #210 are not here.
- Clothes do not deform with the body. Tops, coats, pants, and shoes are shells.
- Top and outerwear share the `top` slot. A shirt replaces a coat, and a coat replaces a shirt. There is no second outerwear layer in version 1.
- Hair, hems, and trims do not spring.
- The sphere and cylinder humanoid stays on #210. It is not the creator preview.
- Every wearable id in the current catalog has a chibi mesh. A category with no meshed ids, a worn id the builder does not draw, or a failed WebGL context shows an empty or error state. The office skips a piece it cannot draw.

## Studio light and the office HUD

The turntable uses the office interior palette from `Lights` in `office-canvas.tsx`: sky `#fff7ee`, ground `#6a5848`, sun `#fff3dd`, key `#fff1d6`, lamp `#f6e2b8`. Stage pills use the same cream, `#d6cec1` border, and shadow as `.office-hud` and `.office-panel`.

No separate HUD light rig has landed. When one does, replace the `STUDIO_*` constants in `character-stage.tsx` with that rig so the creator and the office stay on the same light.

On a narrow viewport the picker is a bottom sheet over the full-bleed stage. Tapping the stage scrim hides it. The camera shifts the chibi into the band above the sheet.
