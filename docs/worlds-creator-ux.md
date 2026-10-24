# Worlds character creator

The creator at `/worlds/create` (production mount `/portal/worlds/create`) edits the version 1 look stored in `office_characters`. Saving a user character writes that row. The office reads it with `GET /api/worlds/characters?mine=1` and applies it to the You actor.

## Look

Player-facing avatars are a layered 2D fashion paper doll (`FashionDoll`). The creator concept sheet and office You both draw that doll from the version 1 slots. The 3D humanoid is not the creator preview and is not office You.

Office bots still use `CharacterFigure` and `public/worlds/humanoid.glb`. The player default is the paper doll.

A new owner look starts as a trendy content-creator outfit: long hair, studio headphones, a collared blouse, an A-line skirt, ankle boots, and a shoulder bag. Hair, clothing, and accessory colors tint the matching layer. Shop items stay locked.

## Gaps

- Top and outerwear share the `top` slot. A shirt replaces a coat, and a coat replaces a shirt. There is no second outerwear layer in version 1.
- Office bots are still the 3D humanoid. The creator and office You are the 2D doll.
- Emotes idle, walk, wave, and sit pose the paper doll. They do not play humanoid clips.

## Concept sheet

The preview is a two-by-two sheet on neutral light gray `#e6e6e6`: front, side, back, and a profile headshot. Each cell is the same paper doll, so the clothing, hair, and expression match across angles. The header reads the character name and the content-creator archetype. The legend lists build, expression, and each worn piece with its color. Compare keeps the current look on the body views and the last saved look on the profile headshot.

On a narrow viewport the picker is a bottom sheet. The concept sheet sits in the band above it. Tapping the sheet scrim hides the picker.
