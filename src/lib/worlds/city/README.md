# Worlds City

The city is the bot office, pulled back so the streets show. It lives at `/worlds/city` (portal path `/portal/worlds/city`) and stays hidden unless `WORLDS_CITY` is exactly `true`. The owner sign-in is required either way. The live office at `/worlds` does not mount the city.

Drag the ground to pan. Right-drag or twist to rotate. Scroll, pinch, or the plus and minus buttons zoom. On a phone, the joystick moves the view. A drag does not open a panel. Tap a building to move the camera to its door and open its interior panel.

Kash is the in-game currency in `src/lib/worlds/economy.ts`. There is no earnings cap. Each action has a limit and a cooldown. Momma Mari owns the in-game assets. No real payment is sent. Paid tasks are opt-in, and the panel says they are real work for Momma Mari and what they earn. Learning center lessons teach a skill before the paid version unlocks. Submissions stay in the city. Nothing is posted to a webhook or a processor.

The office, the bank, the bots, the calendar, the to-dos, Box, and the conference table are the existing office taps. They are listed in `interactables.ts` with the new buildings.

## Locations

| Location | Building | Real-world category | Tasks |
| --- | --- | --- | --- |
| Office | HQ marker on the live office | Office operations | Bots, calendar, to-dos, Box, conference table |
| Personal home | Home, scaled by tier | Home life | Rest and journal (Studio). Cook (Apartment). Host (House). Pin an idea (Creator loft). Gallery (Mansion) |
| Social club | Club | Community | Say hello. Not work for Momma Mari |
| Research lab | Lab | Brand and market research | Sample brand scan, after the research lesson |
| Library | Library | Content summaries | Content summary, after the writing lesson |
| Computer lab | Computers | Data entry and QA | Sample data entry and sample QA check, after the data lesson |
| Learning center | Learning | Skill lessons | Lessons and skill badges. Not a school |
| Call center | Call center | Outreach call scripts and reviewed DMs | Call script and reviewed DM note, after the outreach lesson |
| Art studio | Art | Thumbnails and graphics | Thumbnail note, after the design lesson |
| Music studio | Music | Audio snippets | Audio snippet note, after the audio lesson |
| Bank | Bank | In-game bank | Opens the existing vault bank. No real payment |
| Clothing shop | Clothing | Clothing | Waves, crown, jacket, overalls, heels, watch |
| Furniture shop | Furniture | Furniture | Desk plant, poster, rug, loft lamp |

## Art

Buildings are original toon meshes in the same palette as the chibi figure: chunky masses, cream trim, and a three-step gradient. Close cameras draw windows, signs, and props. Mid distance drops the props. Far distance, and Fast quality, draw a single box. Streets reuse the office asphalt and sidewalk colors. Licenses are in `LICENSES.md`.
