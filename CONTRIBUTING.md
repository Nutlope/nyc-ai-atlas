# Contributing to AI Atlas

The best way to grow the atlas is to add companies. Everything about a company
lives in one city's data file — [`src/cities/nyc/data.js`](src/cities/nyc/data.js)
or [`src/cities/sf/data.js`](src/cities/sf/data.js) — so adding one is a small,
self-contained pull request. There are two ways to open it.

## Option A: ask an AI coding agent

If you use an agent (Claude Code, Cursor, etc.), clone the repo and ask it
something like:

> Add **Together AI** (https://www.together.ai/, office at 777 3rd Ave, Midtown)
> to the New York atlas and open a pull request.

For best results, include:

- Company name and website.
- **Which city**, and a location within it for the map pin. A real office address
  or exact coordinates are best, but an approximate public area is fine if you do
  not want to share an exact address, for example "near Union Square", "Hayes
  Valley", or "DUMBO waterfront".
- Preferred official logo asset, ideally SVG or transparent PNG. If you do not
  have one, tell the agent it may fetch one from the company website.
- One factual line describing what the company does.
- Stage and office type, if known.

The agent has everything it needs: [`AGENTS.md`](AGENTS.md) documents the exact
"Adding a startup" recipe, and the steps below are written to be followed
deterministically. It will edit the right city's `data.js`, verify the build, and
open the PR.

## Option B: do it yourself

### 1. Add the company to `STARTUPS` in `src/cities/<city>/data.js`

```js
{
  id: "acme-ai",                      // kebab-case slug; also the logo filename
  name: "Acme AI",
  lat: 40.7412,                       // right-click the office in Google Maps,
  lng: -73.9896,                      //   "What's here?", copy the coordinates
  area: "flatiron",                   // NYC: midtown | flatiron | west-side | soho | fidi | brooklyn
                                      // SF:  soma | mission-bay | mission | hayes-valley | fidi | showplace
  stage: "Early-Stage",               // "Early-Stage" | "Late-Stage" | "Public" (or null if unknown)
  sector: "AI/Data Infrastructure",   // reuse an existing sector string when you can
  office: "HQ",                       // "HQ" | "Satellite Office" (or null)
  website: "https://acme.ai/",
  source: "user",
  address: "123 Broadway, New York, NY", // omit if the pin is approximate
},
```

Keep the array alphabetized by `name`.

### 2. Add a one-line blurb to `COMPANY_INFO` in the same file

```js
"acme-ai": { blurb: "What the company does, in one factual line.", loc: "Broadway · Flatiron" },
```

`loc` is a street plus neighborhood, never an exact suite.
For approximate-only pins, keep this label approximate too, for example
`"Near Union Square"` or `"DUMBO waterfront"`.

### 3. Logo

Run `npm run logos` (needs network) to auto-fetch it from the company site, or
drop an SVG at `public/logos/acme-ai.svg` yourself (filename = the `id`). Then
confirm no text-fallback logo was generated:

```sh
rg -l "<text " public/logos
```

### 4. Verify and open the PR

```sh
npm install
npm run check   # must report zero failures — catches pins in the water,
                #   unknown area ids, duplicate ids, and missing blurbs
npm run dev     # confirm the pin sits on the right block, label + logo render,
                #   search finds it, and the card shows the blurb
npm run build   # must pass
```

The rail subtitle and search placeholder read their counts from the data at
runtime, so there is no count copy to keep in sync. `README.md` still lists
per-city totals in its table — update that if you like.

Then commit on a branch and open a pull request.

## Ground rules

- Only companies with a real, current office in one of the mapped cities.
- Exact addresses are not required. You may submit an approximate public area for
  privacy, but not just a broad "New York" location or guessed coworking space.
- PRs should say whether the pin is exact or approximate. Approximate pins should
  not include an exact `address` field.
- Prefer an official logo asset. Generated initials are only a last resort.
- Blurbs are factual and about one line; no marketing superlatives.
- Never invent addresses, stages, or funding. If you don't know a field, use
  `null` (for `stage`/`office`) or leave enrichment fields out.
