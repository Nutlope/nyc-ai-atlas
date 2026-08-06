# Agent Guide

This repo is a Vite + Three.js single-page app for AI Atlas: 3D maps of AI startup clusters, one city at a time. Use this file as the operational guide for future agent work.

## Core Facts

- Main branch: `main`
- Remote: `git@github.com:Nutlope/nyc-ai-atlas.git` (repo name predates the multi-city rename)
- Runtime: Vite, Three.js, vanilla JavaScript modules, plain CSS. No framework, no TypeScript, no tests.
- Dev command: `npm run dev` (`vite --host 127.0.0.1`)
- Build command: `npm run build`
- Current dataset: **48 startups in New York, 46 in San Francisco.** Both counts render from `city.startups.length`; there is no hardcoded count copy left in `index.html`.

## Cities

A city is one object exported from `src/cities/<id>/index.js` and registered in `src/cities/index.js`. The first entry in `CITIES` is the default city.

The city object owns everything location-specific: `center`/`scale` (the equirectangular projection), `camera` (distance limits, fog, water plane size), `geo`, `ambient`, `areas`, `startups`, `companyInfo`, `contextPoints`, `miniMap`, `jobsLocation`, and optional `createLandmarks`/`createBigParkDetails` hooks.

**Two building models.** A city declares exactly one:

- `grid` — a lattice city (New York). Origin, rotation, and block spacing generate buildings, sidewalk plates and the road network together.
- `geo.footprints` — a footprint city (San Francisco). Real OSM outlines reduced to oriented bounding boxes, already projected to world XZ.

`createBuildings()` and `createStreetNetwork()` branch on which one is present.

**Switching cities reloads the page.** `switchCity()` sets the hash and calls `location.reload()`. This is deliberate: the scene is rebuilt wholesale on a city change anyway, so a reload costs only the bundle re-parse and avoids hand-disposing dozens of `InstancedMesh`es, canvas textures and tube geometries. Because of that, every module-level binding in `main.js` can stay a plain `const`.

**Routing.** `#/city/:cityId`, `#/city/:cityId/area/:areaId`, `#/city/:cityId/company/:id`. The default city's routes are unprefixed (`#/`, `#/area/:id`, `#/company/:id`) so links shared before the multi-city change still resolve. Do not break that.

## File Map

- `index.html`: static shell, SEO/social metadata, the glass HUD skeleton. Contains no city-specific copy — the brand line, credit, search placeholder, mini-map outline and city switcher are all filled by `renderChrome()` and `renderMiniMap()`.
- `src/main.js`: Three.js scene setup, camera flights, meshes, buildings, vehicles, labels, search, selection, UI state, routing, animation loop.
- `src/cities/index.js`: the registry. Adding a city means adding one import and one array entry.
- `src/cities/<id>/index.js`: the city object.
- `src/cities/<id>/data.js`: areas, startup records, company blurbs, context points.
- `src/cities/<id>/geo.js`: geometry. Hand-authored for NYC; **generated** for SF.
- `src/cities/<id>/landmarks.js`: hand-modelled landmark geometry, called with the scene kit from `buildCityKit()`.
- `src/geo-utils.js`: `pointInPoly` / `inEllipse`, shared by every city.
- `src/styles.css`, `tokens.css`: HUD styling and design tokens.
- `scripts/build-geo.mjs` + `scripts/city-sources.mjs` + `scripts/lib/`: the OpenStreetMap pipeline.
- `scripts/check-cities.mjs`: offline data invariants.
- `scripts/geocode-companies.mjs`: address → coordinates, and pin-vs-address drift checking.

## Working Rules

- Prefer small, scoped edits. This app is visually dense, so unrelated refactors create risk.
- Run `npm run check` after any data change. It is fast, offline, and catches pins in the water, unknown area ids, duplicate ids, and missing blurbs.
- **Never hand-edit `src/cities/sf/geo.js`.** It is generated. Change `scripts/city-sources.mjs` and re-run `npm run geo -- --city=sf`.
- Building footprints are pre-projected against that city's `center`/`scale`. Changing either without regenerating slides every building off the coastline.
- Do not claim addresses are verified company offices unless you have explicitly verified them from authoritative current sources.
- Do not replace real company logos with generated initials unless no real source is available. After logo work, run `rg -l "<text " public/logos`.
- Preserve the app's first-screen product experience. It should open directly into the interactive 3D atlas, not a marketing landing page.
- Keep UI labels compact and scannable. Avoid explanatory in-app text about how the UI works.
- `dist/`, `node_modules/`, `.pnpm-store/`, `.vercel/` and `scripts/.cache/` are ignored outputs/local state.

## Common Commands

```sh
pnpm install
npm run dev
npm run build
npm run check                 # data invariants, offline
npm run smoke                 # boot every city headlessly, offline
npm run shoot                 # real-browser screenshots + assertions (needs npm run dev)
npm run geo -- --city=sf      # regenerate geometry from OpenStreetMap
npm run geocode -- --city=sf  # verify stored pins against their addresses
npm run geocode -- --seed=path/to/seed.json   # bootstrap coordinates for new entries
npm run logos
npm run addresses
```

Notes:

- `npm run build` should pass before pushing. Vite warns that the Three.js bundle is over 500 kB; that warning is expected.
- `npm run geo`, `npm run geocode`, `npm run logos` and `npm run addresses` all need network access.
- Overpass responses cache to `scripts/.cache/`, so re-running `npm run geo` after tweaking downstream logic is free. A cold run takes several minutes — public instances 504 often under load, and the client retries across three mirrors with three workers.
- **Proxied machines:** Node's `fetch` ignores `HTTP_PROXY`/`HTTPS_PROXY`, which makes every script hang while `npm install` works fine. `scripts/lib/net.mjs` detects the mismatch and re-execs with `NODE_USE_ENV_PROXY=1`. If you add a new network script, call `ensureProxyAware()` first.

## Data Model

Startup records use this shape:

```js
{
  id: "together-ai",
  name: "Together AI",
  lat: 40.754588212187,
  lng: -73.971575291769,
  area: "midtown",
  stage: "Late-Stage",       // | "Early-Stage" | "Public" | null
  sector: "AI/Data Infrastructure",
  office: "Satellite Office", // | "HQ" | null
  website: "https://www.together.ai/",
  source: "user",             // "company" | "user" | "felt" | "felt+airtable"
  address: "777 3RD AVE, NEW YORK, NY, 10017"  // omit for approximate pins
}
```

The `id` maps to `public/logos/{id}.svg`, search, detail rendering, mini-map points, and the `#/company/:id` route. It must be unique within its city.

Area records include camera focus settings:

```js
focus: { lat, lng, distance, height, rotation }
```

Adjust these carefully and test the camera flight on desktop-sized viewports.

## Adding a Startup (deterministic recipe)

When asked to add a company, do exactly this and open a PR. Everything lives in `src/cities/<city>/data.js`.

Before editing, make sure you have enough contributor-supplied information. Ask for anything missing instead of guessing:

- Company name and website.
- **Which city**, and a location within it for the map pin. Prefer a real office address or exact coordinates, but accept an approximate public area ("near Union Square", "Hayes Valley", "DUMBO waterfront").
- Preferred logo SVG/PNG, or permission to fetch one from the company website.
- One factual blurb about what the company does.
- Stage and office type, if known. Use `null` otherwise.

Do not add a company from only a city-level location, a guessed coworking space, or a remote-work claim.

1. Derive `id`: kebab-case the name (`"Acme AI"` → `acme-ai`). Ensure it is unique within that city's `STARTUPS`.
2. Validate the location:
   - Coordinates supplied → confirm they land in the right city and match the stated address or neighbourhood.
   - Address supplied → geocode it. Add it to a seed JSON and run `npm run geocode -- --seed=<file>`, or use any map source. Do not guess coordinates.
   - Approximate area only → choose a representative coordinate in that area, **omit the `address` field**, set `source: "user"`, and make the approximation explicit in the PR and in `COMPANY_INFO.loc`.
   - Do not claim the address is a verified company office unless you checked an authoritative current source (company website, careers page, contact page, press release, or reputable real-estate reporting).
3. Append to `STARTUPS`, keeping the array alphabetized by `name`.
   - `area` must be one of that city's area ids. NYC: `midtown`, `flatiron`, `west-side`, `soho`, `fidi`, `brooklyn`. SF: `soma`, `mission-bay`, `mission`, `hayes-valley`, `fidi`, `showplace`.
   - `sector`: reuse an existing sector string from the file when possible.
   - Never invent `stage`, `office`, or an exact `address`.
4. Add a matching one-line entry to `COMPANY_INFO`, keyed by the same id.
5. Logo: ask the contributor for an official asset first; otherwise run `npm run logos` or add `public/logos/<id>.svg` from an official source. Then run `rg -l "<text " public/logos` — the new id should not appear.
6. Run `npm run check`. It must report zero failures.
7. Run `npm run build`. Then branch, commit, and open a PR with `gh`.

The PR description should include the location source, whether the pin is exact or approximate, the logo source, validation performed, and build result.

## Adding a City

1. Add a bbox, projection, core zones and filters to `scripts/city-sources.mjs`. `scale.lng` must be `scale.lat * cos(center.lat)` or the map stretches east-west.
2. Run `npm run geo -- --city=<id>`. This writes `src/cities/<id>/geo.js`.
3. Write `src/cities/<id>/data.js` (areas with `focus`, startups, blurbs, context points).
4. Write `src/cities/<id>/landmarks.js`. Without recognizable silhouettes the city reads as a field of boxes.
5. Write `src/cities/<id>/index.js` assembling the city object.
6. Register it in `src/cities/index.js`.
7. Run `npm run check`, then `npm run build`, then walk the city in the browser.

Keep the geometry payload in mind: the SF module is the largest file in the repo. If a new city overshoots, tighten `minAreaCore`/`minAreaOuter` or shrink the core zones in `city-sources.mjs`.

## Geometry Pipeline

`scripts/build-geo.mjs` pulls from Overpass and reduces:

- **Land** — `natural=coastline` ways stitched end-to-end, longest run kept, Douglas–Peucker simplified to ~130 points, then closed across the city's land border. OSM leaves the ocean implicit, so there is no water polygon to fetch.
- **Parks** — `leisure=park` ways and relations above a minimum area, simplified to 48 points.
- **Buildings** — every footprint inside the core zones, plus height-tagged buildings elsewhere. Each is collapsed to its minimum-area oriented bounding box by rotating calipers on the convex hull, producing exactly the `{x, z, w, d, rot, h}` instance `createBuildings()` composes. Heights come from `height`, else `building:levels × 3.2m`, else a fallback. SF's OSM height coverage is ~90%.
- **Roads** — `highway=motorway|trunk|primary|secondary`, simplified, projected at runtime.
- **Transit** — `route=subway|light_rail|tram` relations with a `colour` tag, deduplicated to the longest relation per line.

Two details worth knowing before touching it:

- Always use the global `[bbox:...]` setting, never a per-statement bbox filter. Whole-city coastline returns in ~1.5s the first way and times out the second.
- `pointInPoly` is O(n) and runs tens of thousands of times during scatter passes. Ring simplification is a hard performance requirement, not polish.

## Visual QA

When changing scene, camera, layout, assets, or data:

1. `npm run check` — zero failures.
2. `npm run smoke` — every city boots. This runs `init()` for real against stubbed DOM/WebGL, so it catches undefined variables and broken city config the bundler cannot. It stops in the GPU path by design; that is reported as a pass.
3. `npm run build`.
4. `npm run dev`, then `npm run shoot` — drives the installed Chrome via `playwright-core`, walks every city, and asserts the canvas drew, the label/pin/area counts match the data, the mini-map outline rendered, and the console is clean. Screenshots land in `screenshots/`. Add `--areas` to capture every area view.
5. Read the screenshots. The assertions catch structural breakage; they don't catch a city rendered upside down.
6. Search a few companies per city and confirm results are scoped correctly.
7. Confirm `#/area/flatiron` and `#/company/together-ai` still land on New York.

## Proving a Refactor Changed Nothing

The scene animates continuously — traffic, ferries, clouds, birds — so two screenshots are never byte-identical and pixel diffing is useless. Compare the scene graph instead; it is fully seeded and deterministic:

```js
// in the page, via window.__atlas
const s = window.__atlas.scene; let total = 0, verts = 0; const counts = [];
s.traverse((o) => {
  total++;
  if (o.isInstancedMesh) counts.push(o.count);
  if (o.geometry?.attributes?.position) verts += o.geometry.attributes.position.count;
});
```

Object count, vertex count, sorted `InstancedMesh` counts and `camera.position` must all match exactly across a behaviour-preserving change. Check the old revision out with `git worktree add`, run both dev servers on different ports, and probe each.

## Git / Push Flow

```sh
git status --short --branch
npm run check
npm run build
git add <changed files>
git commit -m "..."
git push origin <branch>
```

Never revert user changes to unrelated files. If the worktree is dirty before you start, inspect changes before editing overlapping files.
