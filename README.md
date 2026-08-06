# AI Atlas

AI Atlas is a set of high-fidelity 3D interactive maps of the world's AI startup clusters. Each city renders as a stylized, explorable scene with startup pins, company logos, neighborhood chapters, landmarks, transit, moving traffic, ferries, planes, and a searchable company index.

The app was inspired by the interaction model of Levels.fyi Atlas: a left-side chapter legend, animated camera flights into city areas, clickable company labels, and ambient realtime movement in the scene.

## Cities

| City | Companies | Clusters | Geometry |
| --- | --- | --- | --- |
| New York | 48 | 6 | Hand-authored polygons + Manhattan street lattice |
| San Francisco | 46 | 6 | OpenStreetMap coastline, parks, roads and building footprints |

Switch cities from the chip in the top right, or link straight to one: `#/city/sf/`. New York is the default city, so its routes stay unprefixed (`#/area/flatiron`, `#/company/together-ai`) and older shared links keep working.

## What It Shows

- Company pins coloured by stage, with SVG logos from `public/logos`.
- Per-city area chapters with their own camera flights and descriptions.
- Company details with stage, sector, office type, website, and a short blurb.
- Context layers: Big Tech offices, VCs and event spaces, coworking, universities, transit lines, parks, bridges, ferries, planes, cars, landmark buildings, and a mini map.

## Two Kinds of City

The renderer supports two ways of producing buildings, and a city picks one:

- **Lattice cities** (New York) declare a `grid` — an origin, a rotation, and block spacing. Buildings, sidewalk plates and the traffic network are all generated on that shared lattice, which is what makes Manhattan read as Manhattan.
- **Footprint cities** (San Francisco) declare `geo.footprints` instead. Every building is a real OpenStreetMap outline reduced to its minimum-area oriented bounding box, with a real height. This is the right model for cities without a single dominant street grid.

Both paths feed the same instancing code in `createBuildings()`.

## Add Your Startup

Know an AI company with a real office in one of these cities? Open a pull request. Everything about a company is one entry in that city's `data.js` plus a one-line blurb, so it is a small, self-contained change. [CONTRIBUTING.md](CONTRIBUTING.md) walks through it.

Two easy ways to do it:

- **Ask an AI coding agent.** Clone the repo and tell your agent (Claude Code, Cursor, etc.) "add \<company\> to the \<city\> atlas and open a PR." [AGENTS.md](AGENTS.md) has a deterministic recipe it can follow.
- **By hand.** Add the entry, run `npm run logos`, verify with `npm run check` and `npm run dev`, and open the PR.

## Data Sources

**New York** — [src/cities/nyc/data.js](src/cities/nyc/data.js)

- Lux NYC Airtable: <https://airtable.com/appK49oThZBOTSYlX/shr5Chudz00G5jxwW/tblFlqQHeAvsVxLNI>
- Lux Felt map: <https://felt.com/map/LUX-NYC-tki3mxiaS9B2Uc9Bg3EN9BWJB>

**San Francisco** — [src/cities/sf/data.js](src/cities/sf/data.js)

Pins fall into two classes, and the distinction matters:

- `source: "company"` — the entry carries a street `address` taken from commercial-real-estate reporting and forward-geocoded through Nominatim. 18 of the 46 SF entries. `npm run geocode -- --city=sf` re-checks every one against its stored pin.
- `source: "user"` — neighbourhood-accurate only, deliberately carrying **no** `address` field. Do not read these as a company's verified office.

Two sourcing traps worth knowing, both hit while building this list. Data aggregators widely repeat "1455 Third Street" as OpenAI's address; it geocodes to **Uber's headquarters**. And "2261 Market Street" is a virtual-mailbox building that appears as the registered address for Anysphere, Chroma, Decagon and Linear among others — it is never an office. Companies that are genuinely remote-first with only a registered address are left off the map rather than pinned to a mail drop.

**Geometry** — San Francisco's coastline, parks, roads, transit and building footprints come from [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL) via the Overpass API. New York's geography is hand-authored and deliberately stylized.

Address reports live in [public/company-addresses.md](public/company-addresses.md) and [public/company-addresses.csv](public/company-addresses.csv). Important caveat: most NYC addresses there are reverse-geocoded from map-pin coordinates. They identify the nearest mapped address for the pin, not a verified lease or current office occupancy.

## Tech Stack

- Vite
- Three.js
- Vanilla JavaScript modules
- CSS custom properties and plain CSS
- Geist (single self-hosted variable UI font, SIL OFL)

There is no React app or backend service.

## Getting Started

```sh
pnpm install
npm run dev
```

Vite serves the app on `http://127.0.0.1:5173/` by default.

```sh
npm run build     # production build
npm run preview   # preview that build
```

## Useful Scripts

```sh
npm run check                 # validate every city's data invariants
npm run smoke                 # boot every city headlessly and run every scene builder
npm run shoot                 # screenshot every city in a real browser (needs npm run dev)
npm run geo -- --city=sf      # regenerate a city's geometry from OpenStreetMap
npm run geocode -- --city=sf  # re-check stored pins against their addresses
npm run logos                 # regenerate public/logos/*.svg
npm run addresses             # regenerate the reverse-geocoded address report
```

- `check` is offline and fast: pins in the water, unknown area ids, duplicate ids, missing blurbs, mini-map bounds that miss a pin.
- `smoke` boots `main.js` against a stubbed DOM and WebGL. It stops at rasterisation, so it's a boot test, not a visual one.
- `shoot` uses `playwright-core` against the Chrome you already have (no download). Screenshots go to `screenshots/`. Flags: `--areas`, `--headed`, `--url=`.
- `geo` caches Overpass responses under `scripts/.cache/`, so re-runs are free. A cold run takes several minutes.
- `geocode` throttles to 1 req/sec per Nominatim's policy.

Behind a proxy, Node's `fetch` ignores `HTTP_PROXY`/`HTTPS_PROXY` and the network scripts hang while `npm install` works fine. `scripts/lib/net.mjs` detects that and re-runs with `NODE_USE_ENV_PROXY=1`.

## Project Structure

```text
.
├── index.html
├── scripts/
│   ├── build-geo.mjs             # OpenStreetMap -> city geometry
│   ├── check-cities.mjs          # data invariants
│   ├── city-sources.mjs          # per-city extract config (bboxes, filters)
│   ├── geocode-companies.mjs     # address -> coordinates
│   ├── fetch-logos.mjs
│   ├── generate-address-report.mjs
│   └── lib/                      # overpass client, geometry, net plumbing
├── src/
│   ├── cities/
│   │   ├── index.js              # the registry; add a city here
│   │   ├── nyc/{index,data,geo,landmarks}.js
│   │   └── sf/{index,data,geo,landmarks}.js
│   ├── geo-utils.js              # pointInPoly / inEllipse
│   ├── main.js                   # scene, camera, UI, routing
│   └── styles.css
└── tokens.css
```

## Development Notes

- A city is one object in `src/cities/<id>/index.js`, registered in `src/cities/index.js`. It owns its projection, camera envelope, geometry, ambient dressing, areas, companies and mini-map.
- Switching cities reloads the page. The scene rebuilds wholesale anyway, so a reload only costs the bundle re-parse and avoids disposing dozens of instanced meshes by hand.
- `src/cities/sf/geo.js` is generated. Change `scripts/city-sources.mjs` and re-run `npm run geo` instead of editing it.
- Footprints are pre-projected to world XZ against that city's `center`/`scale`. Change either without regenerating and the buildings slide off the coastline.
- Logo filenames are the startup `id`. Camera destinations are each area's `focus`. One world unit is ~90m.
- OG tags are static — hash routes never reach a server, so shared city links render the generic card.

## Verification Checklist

Before pushing visual or data changes:

1. `npm run check` passes with no failures.
2. `npm run smoke` boots every city.
3. `npm run build` passes.
4. `npm run dev`, then walk **both** cities: whole-board view renders a nonblank scene, every area button flies the camera correctly, the detail card and mini map update.
5. Search in each city and confirm results are scoped to that city.
6. Confirm legacy links still resolve: `#/area/flatiron` and `#/company/together-ai` should land on New York.
7. Check the browser console for errors and broken logo images.
