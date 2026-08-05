# NYC AI Atlas

NYC AI Atlas is a high-fidelity 3D interactive map of New York City's AI startup ecosystem. It renders a stylized, explorable NYC scene with startup pins, company logos, neighborhood chapters, landmarks, transit, moving traffic, ferries, planes, and a searchable company index.

The app was inspired by the interaction model of Levels.fyi Atlas: a left-side chapter legend, animated camera flights into city areas, clickable company labels, and ambient realtime movement in the scene.

## What It Shows

- 49 AI/startup company points across Manhattan and Brooklyn.
- 7 explorable map views: whole board, Midtown, Flatiron/Union Square, West Side/Chelsea, SoHo/NoHo, Tribeca/FiDi, and Brooklyn.
- Company labels with SVG logo assets from `public/logos`.
- Company details with stage, sector, office type, website, source, and short blurbs.
- NYC context layers: Big Tech offices, VCs/events, coworking, universities, subway lines, parks, bridges, ferries, planes, cars, landmark buildings, and a mini map.
- A richer Central Park layer with water bodies, lawns, paths, and trees.

## Add Your Startup

Know an AI startup with a real NYC office that belongs on the map? Open a pull request. Everything about a company is one entry in [src/data.js](src/data.js) plus a one-line blurb, so it is a small, self-contained change. [CONTRIBUTING.md](CONTRIBUTING.md) walks through it.

Two easy ways to do it:

- **Ask an AI coding agent.** Clone the repo and tell your agent (Claude Code, Cursor, etc.) "add \<company\> to the atlas and open a PR." [AGENTS.md](AGENTS.md) has a deterministic recipe it can follow.
- **By hand.** Add the entry, run `npm run logos`, verify with `npm run dev`, and open the PR.

There is also an "Add your startup" button in the app, and the same link appears when a search finds no matches.

## Data Sources

Startup data is stored in [src/data.js](src/data.js). The source links are:

- Lux NYC Airtable: <https://airtable.com/appK49oThZBOTSYlX/shr5Chudz00G5jxwW/tblFlqQHeAvsVxLNI>
- Lux Felt map: <https://felt.com/map/LUX-NYC-tki3mxiaS9B2Uc9Bg3EN9BWJB>

Together AI was added manually at `777 3RD AVE, NEW YORK, NY, 10017`.

Address reports live in:

- [public/company-addresses.md](public/company-addresses.md)
- [public/company-addresses.csv](public/company-addresses.csv)

Important caveat: most addresses are reverse-geocoded from map-pin coordinates. They identify the nearest mapped address for the pin, not a verified lease, headquarters filing, or current office occupancy. Only entries with an explicit `address` field in `src/data.js` should be treated as directly supplied.

## Tech Stack

- Vite
- Three.js
- Vanilla JavaScript modules
- CSS custom properties and plain CSS
- Geist (single self-hosted variable UI font, SIL OFL)

There is no React app or backend service. The scene is built in [src/main.js](src/main.js), geography lives in [src/geo.js](src/geo.js), data lives in [src/data.js](src/data.js), and UI styling lives in [src/styles.css](src/styles.css).

## Getting Started

Install dependencies:

```sh
pnpm install
```

Run the dev server:

```sh
npm run dev
```

Vite serves the app on `http://127.0.0.1:5173/` by default. If that port is busy, Vite will pick the next open port.

Build for production:

```sh
npm run build
```

Preview the production build:

```sh
npm run preview
```

## Useful Scripts

```sh
npm run dev
npm run build
npm run preview
npm run logos
npm run addresses
```

- `npm run logos` regenerates SVG logo files in `public/logos`. It fetches Simple Icons, company favicons, site icons, and a small set of direct logo assets. It needs network access.
- `npm run addresses` regenerates `public/company-addresses.csv` and `public/company-addresses.md` by reverse-geocoding startup coordinates through OpenStreetMap/Nominatim. It intentionally waits between requests and needs network access.

## Project Structure

```text
.
├── index.html
├── package.json
├── public/
│   ├── company-addresses.csv
│   ├── company-addresses.md
│   ├── fonts/
│   ├── logos/
│   └── og.png
├── scripts/
│   ├── fetch-logos.mjs
│   └── generate-address-report.mjs
├── src/
│   ├── data.js
│   ├── geo.js
│   ├── main.js
│   └── styles.css
└── tokens.css
```

## Development Notes

- The app renders company count from `STARTUPS` in `src/data.js`; keep homepage copy, search placeholders, and source/footer copy aligned with that count.
- Logo filenames are keyed by startup `id`, e.g. `/logos/together-ai.svg`.
- Camera destinations are controlled by each area object's `focus` values in `src/data.js`.
- Map geography is stylized, not GIS-precise. Coastlines, parks, districts, subway lines, bridges, and landmarks are hand-authored in `src/geo.js`.
- `dist/` is build output and is ignored by git.

## Verification Checklist

Before pushing visual or data changes:

1. Run `npm run build`.
2. Run `npm run dev` and open the local Vite URL.
3. Check the whole-board view renders a nonblank 3D scene.
4. Click through each area in the left legend and verify the camera flight, detail card, labels, and mini map update.
5. Search for a few companies, including `Together AI`.
6. Check browser console errors and broken logo images.
