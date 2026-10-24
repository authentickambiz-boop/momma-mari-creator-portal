# Worlds character creator

The creator at `/worlds/create` (production mount `/portal/worlds/create`) edits the version 1 look stored in `office_characters`. Saving a user character writes that row. The office reads it with `GET /api/worlds/characters?mine=1` and applies it to the You actor.

## Look

Player-facing avatars are a layered 2D fashion paper doll (`FashionDoll`). The creator concept sheet and office You both draw that doll from the version 1 slots. The 3D humanoid is not the creator preview and is not office You.

Office bots still use `CharacterFigure` and `public/worlds/humanoid.glb`. The player default is the paper doll.

A new owner look is the locked glam portrait: long plum hair, no headwear, a fitted pink blouse, a teal pencil skirt, and pink heeled boots. Earrings and the pendant are painted into that portrait. Hair, blouse, skirt, boots, and skin colors tint the matching region. A different piece (headphones, a bag, another haircut) falls back to the simpler paper doll so the choice still shows. Shop items stay locked.

## Gaps

- Top and outerwear share the `top` slot. A shirt replaces a coat, and a coat replaces a shirt. There is no second outerwear layer in version 1.
- Office bots are still the 3D humanoid. The creator and office You are the 2D doll.
- Emotes nudge the locked portrait (a bob, a lean, a lower sit). They do not redraw that pose, and they do not play humanoid clips. The simpler paper doll still changes pose.
- The glam portrait is the default silhouette only. Other shop and starter pieces stay on the simpler doll.

## Concept sheet

The preview is a two-by-two sheet on neutral light gray `#e6e6e6`: front, side, back, and a profile headshot. Each cell is the same paper doll, so the clothing, hair, and expression match across angles. The header reads the character name and the content-creator archetype. The legend lists build, expression, and each worn piece with its color. Compare keeps the current look on the body views and the last saved look on the profile headshot.

On a narrow viewport the picker is a bottom sheet. The concept sheet sits in the band above it. Tapping the sheet scrim hides the picker.
