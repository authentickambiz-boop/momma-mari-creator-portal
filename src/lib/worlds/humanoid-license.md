# Humanoid assets

The character in `public/worlds/humanoid.glb` is a rigged MakeHuman body with
separate clothes, hair, eyes, and teeth. MakeHuman's system assets and the
community clothes below are CC0 1.0. CC0 allows commercial use and does not
require attribution. The motion was retargeted from Quaternius's Universal
Animation Library, also CC0. No generative-image model was used to create
these meshes.

| Piece | Source | Author | License |
| --- | --- | --- | --- |
| Body, skin, eyes, brows, lashes, teeth, hair, sneakers, hat | [MakeHuman system assets](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html) | MakeHuman Community | CC0 |
| Extra skin tones (fair, tan, deep) | Same system skin set: young caucasian, asian, and african female | MakeHuman Community | CC0 |
| T-shirt, sweater, wool pants, ankle boots | Shirts 01, Pants 01, Shoes 01 packs | Margaret Toigo | CC0 |
| Jeans shorts | Pants 01 | Cortu | CC0 |
| Tiered skirt | Skirts 01 | Margaret Toigo | CC0 |
| Glasses | Glasses 01 | kwnet | CC0 |
| Briefs, worn only when no outer bottom is selected | Underwear 01 | Wolgade | CC0 |
| Idle, walk, sit, stand, dance, talk | [Universal Animation Library](https://quaternius.itch.io/universal-animation-library) | Quaternius | CC0 |
| Wave and cheer | Posed on the same skeleton from the idle clip | — | CC0 |

Clothes, hair, and the body share the game-engine skeleton, so a shirt follows
the arms through a walk, a sit, and an emote. Hair tips, the sweater hem, and
the skirt hem also carry a little weight on spring bones (`hairA`, `coatHemL`,
`fur`, `skirtHemL`, and the matching right and back bones). Those bones move
only for a nearby character or the creator studio.

The file is Draco-compressed geometry with UASTC KTX2 textures. Decoder files
live in `public/worlds/draco/` and `public/worlds/basis/` and come from three.js.

This is a real human mesh with photographic skin, not a primitive mannequin and
not the earlier stylized superhero. The body, clothes, hair, lashes, and eyes
are Catmull-Clark subdivided twice and exported with smooth normals and a PBR
skin roughness. The head mesh is named `softFace` and keeps the MakeHuman face:
cheeks, nose bridge, eyelids, lips, and ears. The same mesh continues through
the neck, shoulders, torso, arms, hands, hips, thighs, shins, and feet, with
finger bones on the hands. It is still one adult MakeHuman body: three
skin photographs chosen from the saved skin color, and hair cards rather than
strands. Saved looks stay on character
version 1. Several item ids share a mesh when the CC0 wardrobe has one good
garment for that slot (the vest uses the t-shirt, the hoodie uses the sweater).
Scarf, bag, badge, and watch still have no mesh.
