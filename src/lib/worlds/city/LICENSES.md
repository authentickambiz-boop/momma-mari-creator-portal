# City art licenses

The city does not vendor a downloaded model pack. The meshes are original geometry in this repository, drawn to match the chibi figure in `src/components/worlds/character-figure.tsx`.

| Piece | Where | License |
| --- | --- | --- |
| City buildings, streets, lamps, interior panels | `src/components/worlds/city/` | Original. Momma Mari owns the in-game assets. |
| Chibi figure used by the office bots | `src/lib/worlds/character.ts`, `src/components/worlds/character-figure.tsx` | Original, already in the office. |
| three.js | dependency `three` | MIT |
| React Three Fiber | dependency `@react-three/fiber` | MIT |
| drei `MapControls` (the office camera) | dependency `@react-three/drei` | MIT |

The office floor, lawn, vault bank, and bot roster are the existing office scene. The city does not replace them.

Level of detail: Fast quality and distant buildings skip windows, signs, and outline shells so phones draw fewer triangles.
