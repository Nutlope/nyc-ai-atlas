# Agent Guide

This repo is a Vite + Three.js single-page app for the NYC AI Atlas. Use this file as the operational guide for future agent work.

## Core Facts

- App root: `/Users/hassan/Documents/interactive-3d-map`
- Main branch: `main`
- Remote: `git@github.com:Nutlope/interactive-3d-map.git`
- Runtime: Vite, Three.js, vanilla JavaScript modules, plain CSS.
- Dev command: `npm run dev`
- Build command: `npm run build`
- Current dataset: 45 startups in `STARTUPS` from `src/data.js`.

## File Map

- `index.html`: static shell, SEO/social metadata, top-level controls, dialogs, and source footer.
- `src/main.js`: Three.js scene setup, camera flights, map meshes, buildings, landmarks, vehicles, labels, search, selection, UI state, and animation loop.
- `src/geo.js`: hand-authored NYC polygons, parks, districts, subway paths, landmarks, and bridges.
- `src/data.js`: data sources, area chapters, startup records, company blurbs, and context points.
- `src/styles.css`: UI, overlays, labels, search modal, detail cards, responsive/mobile gate.
- `tokens.css`: shared CSS variables.
- `public/logos`: startup SVG logos, keyed by startup `id`.
- `public/company-addresses.*`: generated address reports.
- `scripts/fetch-logos.mjs`: regenerates logo SVGs from Simple Icons, company websites, favicon discovery, and direct asset overrides.
- `scripts/generate-address-report.mjs`: regenerates address reports by reverse geocoding coordinates.

## Working Rules

- Prefer small, scoped edits. This app is visually dense, so unrelated refactors create risk.
- Keep data count copy synchronized. If `STARTUPS.length` changes, update `index.html`, area descriptions if needed, README references, and generated reports if requested.
- Do not claim addresses are verified company offices unless you have explicitly verified them from authoritative current sources. Most report addresses are nearest addresses from reverse geocoded pins.
- Do not replace real company logos with generated initials unless no real source is available. After logo work, run `rg -l "<text " public/logos` to find generated fallback SVGs.
- Preserve the app's first-screen product experience. It should open directly into the interactive 3D atlas, not a marketing landing page.
- Keep UI labels compact and scannable. Avoid explanatory in-app text about how the UI works.
- `dist/`, `node_modules/`, `.pnpm-store/`, and `.vercel/` are ignored outputs/local state.

## Common Commands

```sh
pnpm install
npm run dev
npm run build
npm run preview
npm run logos
npm run addresses
```

Notes:

- `npm run dev` runs `vite --host 127.0.0.1`.
- `npm run build` should pass before pushing. Vite may warn that the Three.js bundle is over 500 kB; that warning is currently expected.
- `npm run logos` needs network access and writes `public/logos/*.svg`.
- `npm run addresses` needs network access, calls OpenStreetMap/Nominatim, and intentionally throttles requests.

## Visual QA

When changing scene, camera, layout, assets, or data:

1. Build with `npm run build`.
2. Start Vite with `npm run dev`.
3. Open the local URL in a browser.
4. Verify the canvas is nonblank and the scene is framed correctly.
5. Click these area buttons: Whole Board, Midtown Stack, Flatiron / Union Square, Brooklyn Arc.
6. Search for `Together AI`, `Runway`, `Hugging Face`, and `Cohere`.
7. Confirm there are no broken images for `.marker-label__logo`.
8. Check for console errors.

## Data Model

Startup records in `src/data.js` use this shape:

```js
{
  id: "together-ai",
  name: "Together AI",
  lat: 40.754588212187,
  lng: -73.971575291769,
  area: "midtown",
  stage: "Late-Stage",
  sector: "AI/Data Infrastructure",
  office: "Satellite Office",
  website: "https://www.together.ai/",
  source: "user",
  address: "777 3RD AVE, NEW YORK, NY, 10017"
}
```

The `id` is important because it maps to `public/logos/{id}.svg`, search/detail rendering, mini-map points, and selection state.

Area records include camera focus settings:

```js
focus: { lat, lng, distance, height, rotation }
```

Adjust these carefully and test the camera flight on desktop-sized viewports.

## Logo Pipeline

`scripts/fetch-logos.mjs` writes a logo for every startup id.

The source order is:

1. Simple Icons candidates.
2. Direct logo assets for edge cases.
3. Company website favicon/icon/logo discovery.
4. Clearbit logo fallback.
5. Generated initials fallback.

After running it:

```sh
rg -l "<text " public/logos
find public/logos -maxdepth 1 -name "*.svg" | wc -l
```

The first command should ideally print nothing. The second may include stale unreferenced logos if startup ids were removed; only `src/data.js` controls what the app renders.

## Address Pipeline

`scripts/generate-address-report.mjs` writes:

- `public/company-addresses.csv`
- `public/company-addresses.md`

It uses explicit `startup.address` when present, otherwise reverse geocodes the latitude/longitude. Reverse geocoding confirms the nearest mapped address to the pin, not current office occupancy.

## Git / Push Flow

Before pushing:

```sh
git status --short --branch
npm run build
git add README.md AGENTS.md <other changed files>
git commit -m "Add project documentation"
git push origin main
```

Never revert user changes to unrelated files. If the worktree is dirty before you start, inspect changes before editing overlapping files.

