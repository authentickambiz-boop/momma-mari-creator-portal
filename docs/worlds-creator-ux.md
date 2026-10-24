# Worlds character creator

The creator at `/worlds/create` (production mount `/portal/worlds/create`) edits the version 1 look stored in `office_characters`. Saving a user character writes that row. The office reads it with `GET /api/worlds/characters?mine=1` and applies it to the You actor.

## Mesh

This studio uses the current chibi (`characterFigure`). That is the mesh the office draws for You, so a saved look matches the desk.

PR #210 (`cursor/worlds-humanoid-2ba0`) adds a skinned humanoid and `public/worlds/humanoid.glb`. It is open and not merged. Its preview was still unchecked, so this pass does not depend on that rig.

## Gaps until the humanoid lands

- Emotes are limb pivots on the chibi: idle, walk, wave, and sit. They are not skeletal clips. Cheer, dance, and think from #210 are not here.
- Clothes do not deform with the body. Tops, coats, pants, and shoes are shells.
- Top and outerwear share the `top` slot. A shirt replaces a coat, and a coat replaces a shirt. There is no second outerwear layer in version 1.
- Hair, hems, and trims do not spring.
- The humanoid glTF is not in this branch. When #210 merges, the studio can swap `CharacterFigure` for the rig and keep these categories, the turntable, and the save path.
- Every wearable id in the current catalog has a chibi mesh. A category with no meshed ids, a worn id the builder does not draw, or a failed WebGL context shows an empty or error state. The office skips a piece it cannot draw.
