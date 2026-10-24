# Worlds City

The city is the bot office, pulled back so the streets show. It lives at `/worlds/city` (portal path `/portal/worlds/city`) and stays hidden unless `WORLDS_CITY` is exactly `true`. The owner sign-in is required either way. The live office at `/worlds` does not mount the city.

Drag the ground to pan. Right-drag or twist to rotate. Scroll, pinch, or the plus and minus buttons zoom. On a phone, the joystick moves the view. A drag does not open a panel. Tap a building to move the camera to its door and open its panel. The Places button in the corner lists every location. It stays closed, so the street is clear until you ask for the list.

The city uses the office sun, sky, and shadows. It opens on a clear afternoon so the overview reads in daylight. The live office still follows the Mooresville clock. Learning center, the library, personal home, the call center, and the art studio open a 3D room when you enter. The camera steps inside and looks across the room. The panel still holds the lessons, the shelf tasks, the home tiers, and the other actions. Each task shows auto check, peer score, owner gate, and delivery. Practice socials and email drafts stay unsent.

Kash is the in-game currency in `src/lib/worlds/economy.ts`. There is no earnings cap. Each action has a limit and a cooldown. Social likes, comments, follows, and story drafts share one cap of 8 a day. Momma Mari owns the in-game assets. No real payment is sent. Paid tasks are opt-in, and the panel says they are real work for Momma Mari and what they earn. Learning center lessons teach a skill before the paid version unlocks.

Worlds has no adult category and no explicit shop, task, or label. A note that reads that way is rejected and is not stored. The screen does not show it.

Quality runs in order: an auto check, then a peer or bot score, then an owner gate when the work could leave the city. Social tasks stay in practice mode (`LIVE_SOCIAL_ACTIONS` is false) and only score a draft. Outreach email stays a draft (`LIVE_EMAIL_SEND` is false) and is never auto-sent. Kamron has to approve anything external. Submissions stay in the city. Nothing is posted to a webhook, a mailbox, or a social network.

`src/lib/worlds/city/practice.ts` is the owner practice harness. `runPracticeTask` and `runPracticeLocation` run Social club, Library, and Call center tasks on a throwaway owner session with a mocked note, the real quality checks, and a Kash payout. The harness does not post or send. `tests/worlds-city.test.ts` runs that harness for every task in those three buildings, and once more for every city task, before this draft is a public release. `WORLDS_CITY` defaults off. The route still requires the owner.

The office, the bank, the bots, the calendar, the to-dos, Box, and the conference table are the existing office taps. They are listed in `interactables.ts` with the new buildings.

## Locations

| Location | Building | Real-world category | Tasks |
| --- | --- | --- | --- |
| Office | Street-facing HQ, brick and flat roof like the live office | Office operations | Bots, calendar, to-dos, Box, conference table |
| Personal home | Home, a different roof for each tier. Walk-in room | Home life | Rest and journal (Studio). Cook (Apartment). Host (House). Pin an idea (Creator loft). Gallery (Mansion) |
| Social club | Club | Managed creator socials | Say hello. Practice like, comment, follow, story post, and story reply. Live posting is off |
| Research lab | Lab | Brand and market research | Sample brand scan, audience questions, competitor note, sample quotes. After the research lesson |
| Library | Library | Content summaries | Summary, shelf test, read a card for a hidden tip, short story, rate a shelf piece. After the writing lesson, except the reading visit |
| Computer lab | Computers | Data entry and QA | Sample data entry, QA check, clip tags, sheet cleanup. After the data lesson |
| Learning center | Learning hall. Walk-in room | Skill lessons | Lessons and skill badges. Not a school |
| Call center | Call center | Outreach call scripts and reviewed DMs | Call script, reviewed DM, script ideas, situation drill, outreach email draft. Email is never auto-sent. After the outreach lesson |
| Art studio | Art | Thumbnails and graphics | Thumbnail, caption card, cover crop. After the design lesson |
| Music studio | Music | Audio snippets | Audio snippet, hook line, bed music note. After the audio lesson |
| Bank | Bank | In-game bank | Opens the existing vault bank. No real payment |
| Clothing shop | Clothing | Clothing | Waves, crown, jacket, overalls, heels, watch |
| Furniture shop | Furniture | Furniture | Desk plant, poster, rug, loft lamp. Patio, fence, planter, and oversized pieces need a house or better |

## Art

Buildings are original meshes in the office palette, with brick, wood, stone, glass, and metal textures drawn in the scene. Glass keeps a light reflection. Trim, corner posts, and a belt course sit on the envelopes. Each model keeps its own roof line: lab tanks, library pediment, call-center mast, shop awnings, and a neighborhood shape per home tier. District names are tall billboards, so they read from the overview. Studio row is the smallest plot. The apartment complex is a shared 1 bed, 1 bath building with no private yard. As more people move in, that complex gains floors. It does not grow sideways. House lane, loft block, and mansion grounds grow from there.

Streets run through every neighborhood and tie back to the ring road, with sidewalks and lamps. Studio row, house lane, loft block, and mansion grounds each have empty lots among the built homes. A lot shows a fence, stakes, and a Build here sign with its lot number. The footprint matches that tier. Tapping a lot opens a practice claim priced in Kash. Only the owner can claim one for now. Momma Mari still owns the lot, and nothing is charged for real. After the claim, a concrete foundation, wood shell, and a roof that sits on the top plate rise on the lot. The finished building comes later. House, studio, loft, mansion, and apartment roofs sit on the walls instead of cutting through them. Neighboring house and studio gables keep a clear gap so the roofs do not meet. Claim an apartment unit and a new brick story rises on the complex. There is still no side yard. A park sits west of HQ, and a fountain sits in the mansion yard. Each junction is a single asphalt pad: the curb return is a sidewalk ring around the corner, sidewalks meet with no grass gap, and a dead end finishes in a round cap. At night every lamp shows a bright bulb and a pool of light on the ground. Close buildings show a furnished room through the windows. House lane has a row of flower beds along each front yard. The HQ uses the office brick colors, flat roof, and Momma Mari sign. Windows, district signs, porch lamps, parked cars, and a yard tree stay on at mid distance. Only a far camera, or Fast quality at long range, drops those down to the silhouette. Streets reuse the office asphalt and sidewalk colors, with a path from each door. Licenses are in `LICENSES.md`. Furniture and clothing that need a yard stay locked until the home tier says so.
