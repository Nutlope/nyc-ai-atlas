import { ensureProxyAware } from "./lib/net.mjs";

ensureProxyAware();

const { mkdir, writeFile } = await import("node:fs/promises");
const path = await import("node:path");
const { fileURLToPath } = await import("node:url");
const { overpassArea, overpassTiles } = await import("./lib/overpass.mjs");
const { getCitySource } = await import("./city-sources.mjs");
const geom = await import("./lib/geometry.mjs");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Pulls a city's shape from Overpass: simplified land/park rings in [lat,lng],
// road and transit polylines, and building footprints collapsed to oriented
// boxes in world space.
//
// npm run geo -- --city=sf

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const cityId = args.city ?? "sf";
const city = getCitySource(cityId);
const project = geom.makeProjector(city.center, city.scale);

console.log(`\nBuilding geometry for ${city.name} (${cityId})`);
console.log(`bbox ${city.bbox.join(", ")}\n`);

const inBbox = (lat, lng) =>
  lat >= city.bbox[0] && lat <= city.bbox[1] && lng >= city.bbox[2] && lng <= city.bbox[3];

// Land and buildings are load-bearing; parks, roads and transit are dressing.
// Overpass falls over often enough that losing a whole run — and the expensive
// building extract with it — over a flaky optional layer isn't acceptable.
async function optional(label, fn, fallback) {
  try {
    return await fn();
  } catch (error) {
    console.warn(`  ${label}: SKIPPED — ${error.message}`);
    console.warn(`  ${label}: re-run to fill this in; everything cached stays cached.`);
    return fallback;
  }
}

// ------------------- Land -------------------
// OSM leaves the ocean implicit: only the coastline is mapped, land on the
// left of each way. Stitch the fragments, keep the longest run, then close it
// across the southern county line, which is a land border and has no shore.
async function buildLand() {
  const elements = await overpassArea(city.bbox, `way["natural"="coastline"];out geom;`, "coastline");
  console.log(`  coastline: ${elements.length} ways`);

  const ways = elements
    .map((el) => (el.geometry ?? []).map((g) => [g.lat, g.lon]))
    .filter((w) => w.length >= 2);
  const runs = geom.stitchWays(ways);
  if (!runs.length) throw new Error("no coastline returned");

  const main = runs[0].filter(([lat, lng]) => inBbox(lat, lng));
  console.log(`  longest run ${runs[0].length} pts -> ${main.length} inside bbox`);

  const simplified = geom.simplifyToBudget(main, 130);
  const southLat = city.landClose.southLat;
  const ring = [
    ...simplified,
    [southLat, simplified[simplified.length - 1][1]],
    [southLat, simplified[0][1]],
  ];
  console.log(`  land ring: ${ring.length} pts`);

  // Smaller runs that close on themselves are islands (Treasure, Yerba Buena, Alcatraz).
  const islands = runs
    .slice(1)
    .map((r) => r.filter(([lat, lng]) => inBbox(lat, lng)))
    .filter((r) => r.length >= 8)
    .map((r) => geom.simplifyToBudget(r, 40))
    .filter((r) => geom.ringAreaMeters(r) > 40000)
    .slice(0, 6);
  console.log(`  islands: ${islands.length}`);

  return { ring, islands };
}

// ------------------- Parks -------------------
async function buildParks() {
  const elements = await overpassArea(
    city.bbox,
    `(way["leisure"="park"];relation["leisure"="park"];);out geom tags;`,
    "parks",
  );
  const rings = [];
  for (const el of elements) {
    // Relations arrive as members; take their outer ways.
    const candidates =
      el.type === "way"
        ? [el.geometry ?? []]
        : (el.members ?? []).filter((m) => m.role === "outer").map((m) => m.geometry ?? []);
    for (const g of candidates) {
      const ring = g.map((p) => [p.lat, p.lon]).filter(([lat, lng]) => inBbox(lat, lng));
      if (ring.length < 4) continue;
      if (geom.ringAreaMeters(ring) < city.parks.minArea) continue;
      rings.push({ ring: geom.simplifyToBudget(ring, 48), name: el.tags?.name ?? "", area: geom.ringAreaMeters(ring) });
    }
  }
  rings.sort((a, b) => b.area - a.area);
  console.log(`  parks kept: ${rings.length} (largest: ${rings.slice(0, 4).map((r) => r.name).join(", ")})`);
  return rings;
}

// ------------------- Buildings -------------------
// Each footprint collapses to its minimum-area oriented box, which is exactly
// the {x, z, w, d, rot, h} instance createBuildings composes.
async function buildFootprints() {
  const inCore = (lat, lng) =>
    city.coreZones.some((z) => lat >= z[0] && lat <= z[1] && lng >= z[2] && lng <= z[3]);

  // Core zones take every footprint. Asking for all of them city-wide exceeds
  // Overpass's per-query limit, so each zone is tiled.
  const seen = new Set();
  const elements = [];
  for (const [i, zone] of city.coreZones.entries()) {
    const batch = await overpassTiles(zone, `way["building"];out geom tags;`, {
      ...city.tiles.buildingsCore,
      label: `core-${i + 1}`,
    });
    for (const el of batch) {
      if (seen.has(el.id)) continue;
      seen.add(el.id);
      elements.push(el);
    }
  }
  console.log(`  core footprints: ${elements.length}`);

  // Outside the core the map only needs enough mass to avoid bald patches, so
  // ask for the buildings that carry a height and skip the rest entirely.
  const outerBatch = await overpassTiles(
    city.bbox,
    `(way["building"]["height"];way["building"]["building:levels"];);out geom tags;`,
    { ...city.tiles.buildingsOuter, label: "outer" },
  );
  for (const el of outerBatch) {
    if (seen.has(el.id)) continue;
    seen.add(el.id);
    elements.push(el);
  }
  console.log(`  + outer tagged: ${elements.length} total`);

  const boxes = [];
  let droppedSmall = 0;
  let droppedShape = 0;

  for (const el of elements) {
    const g = el.geometry;
    if (!g || g.length < 4) continue;
    const ring = g.map((p) => [p.lat, p.lon]);
    const [cLat, cLng] = ring[0];
    if (!inBbox(cLat, cLng)) continue;

    const core = inCore(cLat, cLng);
    const area = geom.ringAreaMeters(ring);
    if (area < (core ? city.minAreaCore : city.minAreaOuter)) {
      droppedSmall += 1;
      continue;
    }

    const rect = geom.minAreaRect(ring.map(([lat, lng]) => project(lat, lng)));
    if (!rect || rect.w < 0.02 || rect.d < 0.02) {
      droppedShape += 1;
      continue;
    }

    boxes.push({
      x: rect.x,
      z: rect.z,
      w: rect.w,
      d: rect.d,
      rot: rect.rot,
      h: geom.resolveHeight(el.tags, core ? 4 : 2),
      core,
    });
  }

  console.log(`  kept ${boxes.length} (dropped ${droppedSmall} small, ${droppedShape} degenerate)`);
  const tagged = elements.filter((e) => e.tags?.height || e.tags?.["building:levels"]).length;
  console.log(`  height coverage: ${((tagged / elements.length) * 100).toFixed(0)}%`);
  return boxes;
}

// ------------------- Block plates -------------------
// createPedestrians walks the perimeter of sidewalk plates. The lattice cities
// get one per street block; here, cluster footprints onto a coarse grid and
// emit a plate per occupied cell.
function buildBlockPlates(boxes) {
  const CELL = 1.6; // world units, roughly a city block
  const cells = new Map();
  for (const b of boxes) {
    if (!b.core) continue;
    const key = `${Math.round(b.x / CELL)}:${Math.round(b.z / CELL)}`;
    const cell = cells.get(key) ?? { x: 0, z: 0, n: 0 };
    cell.x += b.x;
    cell.z += b.z;
    cell.n += 1;
    cells.set(key, cell);
  }
  const plates = [...cells.values()]
    .filter((c) => c.n >= 3)
    .map((c) => ({ x: c.x / c.n, z: c.z / c.n }));
  console.log(`  block plates: ${plates.length}`);
  return plates;
}

// ------------------- Roads -------------------
async function buildRoads() {
  const elements = await overpassArea(city.bbox, `way["highway"~"${city.roads}"];out geom;`, "roads");

  // OSM splits an arterial into dozens of short ways at every junction and
  // tag change. Taken individually most collapse to two points and the traffic
  // layer ends up with nothing long enough to drive, so stitch them end-to-end
  // first and simplify the resulting runs.
  const ways = elements
    .map((el) => (el.geometry ?? []).map((p) => [p.lat, p.lon]))
    .filter((w) => w.length >= 2);
  const runs = geom.stitchWays(ways);

  const paths = [];
  for (const run of runs) {
    const line = run.filter(([lat, lng]) => inBbox(lat, lng));
    if (line.length < 2) continue;
    const simplified = geom.simplify(line, 0.00008);
    if (simplified.length >= 2) paths.push(simplified);
  }
  const pts = paths.reduce((n, p) => n + p.length, 0);
  const longest = Math.max(...paths.map((p) => p.length));
  console.log(`  roads: ${elements.length} ways -> ${paths.length} polylines, ${pts} pts (longest ${longest})`);
  return paths;
}

// ------------------- Transit -------------------
// Station discs and the track ribbon both come from `stops`, so prefer the
// relation's actual stop nodes and fall back to sampling its geometry.
async function buildTransit() {
  // Route relations are cheap to list but Overpass will not expand their
  // members over a whole-city bbox — `out geom` and `out body` both 504, and
  // `out geom tags` silently returns no members at all. Resolving one relation
  // at a time with node(r) is a couple of seconds each and actually works.
  const relations = await overpassArea(city.bbox, `relation["route"~"${city.transit}"];out tags;`, "transit");

  const coloured = relations.filter((rel) => {
    const colour = rel.tags?.colour ?? rel.tags?.color;
    return (rel.tags?.ref || rel.tags?.name) && colour && /^#?[0-9a-f]{6}$/i.test(colour);
  });

  // Each line has a relation per direction; group and take the first that
  // yields a usable run of stops.
  const byRef = new Map();
  for (const rel of coloured) {
    const ref = rel.tags.ref ?? rel.tags.name;
    if (!byRef.has(ref)) byRef.set(ref, []);
    byRef.get(ref).push(rel);
  }

  const lines = [];
  for (const [ref, candidates] of byRef) {
    for (const rel of candidates) {
      let nodes;
      try {
        nodes = await overpassArea(city.bbox, `relation(id:${rel.id});node(r);out;`, `transit ${ref}`, 90);
      } catch (error) {
        console.warn(`  transit ${ref}: ${error.message}`);
        continue;
      }

      // node(r) preserves relation member order, which for a PTv2 route is the
      // stop sequence — so don't sort, it would scramble the path. Prefer real
      // stop positions over platform nodes, which sit off to the side and make
      // the track zigzag.
      const located = nodes.filter((n) => n.type === "node" && n.lat != null);
      const stopish = located.filter(
        (n) => n.tags?.public_transport === "stop_position" || n.tags?.railway === "stop" || n.tags?.railway === "station",
      );
      const chosen = stopish.length >= 4 ? stopish : located;

      const stops = chosen.map((n) => [n.lat, n.lon]).filter(([lat, lng]) => inBbox(lat, lng));
      if (stops.length < 4) continue;

      const colour = (rel.tags.colour ?? rel.tags.color).replace("#", "");
      const step = stops.length > 22 ? Math.ceil(stops.length / 22) : 1;
      lines.push({
        name: ref,
        color: parseInt(colour, 16),
        stops: step > 1 ? stops.filter((_, i) => i % step === 0) : stops,
      });
      break; // this ref is covered
    }
  }

  console.log(`  transit: ${lines.length} lines (${lines.map((l) => `${l.name}:${l.stops.length}`).join(", ")})`);
  return lines;
}

// ------------------- Mini-map outline -------------------
function buildOutline(ring) {
  const lats = ring.map((p) => p[0]);
  const lngs = ring.map((p) => p[1]);
  const latMax = Math.max(...lats);
  const latMin = Math.min(...lats);
  const lngMin = Math.min(...lngs);
  const lngMax = Math.max(...lngs);
  const span = Math.max(latMax - latMin, lngMax - lngMin);

  // Same 120x160 viewBox the NYC mini-map uses, centred with a small margin.
  const pad = 10;
  const w = 120 - pad * 2;
  const h = 160 - pad * 2;
  const coarse = geom.simplifyToBudget(ring, 60);
  const d = coarse
    .map(([lat, lng], i) => {
      const x = pad + ((lng - lngMin) / span) * w;
      const y = pad + ((latMax - lat) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return {
    d: `${d} Z`,
    bounds: { lngMin, lngSpan: span, latMax, latSpan: span, x: pad, y: pad, w, h },
  };
}

// ------------------- Emit -------------------
const round = (n, p = 2) => Number(n.toFixed(p));

function packBoxes(boxes) {
  // Flat [x, z, w, d, rot, h] runs gzip far better than object literals.
  const flat = [];
  for (const b of boxes) {
    flat.push(round(b.x), round(b.z), round(b.w), round(b.d), round(b.rot, 3), round(b.h, 3));
  }
  return flat;
}

function ringSource(ring) {
  return `[${ring.map(([lat, lng]) => `[${lat.toFixed(5)},${lng.toFixed(5)}]`).join(",")}]`;
}

function ringsSource(rings) {
  return `[\n${rings.map((r) => `  ${ringSource(r)}`).join(",\n")}\n]`;
}

async function main() {
  const land = await buildLand();
  const parks = await optional("parks", buildParks, []);
  const footprints = await buildFootprints();
  const plates = buildBlockPlates(footprints);
  const roads = await optional("roads", buildRoads, []);
  const transit = await optional("transit", buildTransit, []);
  const outline = buildOutline(land.ring);

  const core = footprints.filter((b) => b.core);
  const outer = footprints.filter((b) => !b.core);

  const source = `// GENERATED by scripts/build-geo.mjs — do not edit by hand.
// Source: OpenStreetMap via Overpass, ODbL. Regenerate with:
//   npm run geo -- --city=${cityId}
//
// Rings are [lat, lng] because pointInPoly works in degrees. Building boxes are
// pre-projected to world XZ against the center/scale below, packed flat as
// [x, z, w, d, rot, h] — unpack with unpackBoxes().

export const CENTER = ${JSON.stringify(city.center)};
export const SCALE = ${JSON.stringify(city.scale)};

export const LAND = ${ringSource(land.ring)};

export const ISLANDS = ${ringsSource(land.islands)};

export const PARKS = ${ringsSource(parks.map((p) => p.ring))};

export const ROADS = ${ringsSource(roads)};

export const TRANSIT = ${JSON.stringify(
    transit.map((l) => ({ name: l.name, color: l.color, stops: l.stops.map(([a, b]) => [round(a, 5), round(b, 5)]) })),
    null,
    1,
  )};

// ${core.length} core + ${outer.length} outer footprints
const CORE_BOXES = [${packBoxes(core).join(",")}];
const OUTER_BOXES = [${packBoxes(outer).join(",")}];

function unpackBoxes(flat, faded) {
  const out = [];
  for (let i = 0; i < flat.length; i += 6) {
    out.push({ x: flat[i], z: flat[i + 1], w: flat[i + 2], d: flat[i + 3], rot: flat[i + 4], h: flat[i + 5], faded });
  }
  return out;
}

export const FOOTPRINTS = unpackBoxes(CORE_BOXES, false).concat(unpackBoxes(OUTER_BOXES, true));

export const BLOCK_PLATES = [${plates.map((p) => `${round(p.x)},${round(p.z)}`).join(",")}];

export const OUTLINE = ${JSON.stringify(outline.d)};
export const OUTLINE_BOUNDS = ${JSON.stringify(outline.bounds)};
`;

  const outDir = path.join(root, "src", "cities", cityId);
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "geo.js");
  await writeFile(outPath, source, "utf8");

  const kb = (source.length / 1024).toFixed(0);
  console.log(`\nWrote ${path.relative(root, outPath)} — ${kb} KB raw`);
  console.log(`  ${core.length} core + ${outer.length} outer buildings, ${plates.length} plates`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
