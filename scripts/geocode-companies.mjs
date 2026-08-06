import { ensureProxyAware } from "./lib/net.mjs";

ensureProxyAware();

const { readFile, writeFile } = await import("node:fs/promises");
const path = await import("node:path");
const { fileURLToPath } = await import("node:url");
const { delay } = await import("./lib/net.mjs");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// =================== Address -> coordinates ===================
// Mirrors generate-address-report.mjs in reverse. Two modes:
//
//   --seed=<file.json>   geocode a list of {name, address} and print records
//   --city=<id>          re-check the stored lat/lng of every startup that
//                        carries an address, and flag the ones that drifted
//
// Nominatim's usage policy caps this at 1 request/second with a real
// User-Agent, so both modes throttle. Never point it at a bulk list.

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "ai-atlas-geocoder/1.0 (https://github.com/Nutlope/nyc-ai-atlas)";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

async function geocode(query) {
  const url = new URL(NOMINATIM);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("q", query);

  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) return { error: `HTTP ${response.status}` };
  const [hit] = await response.json();
  if (!hit) return { error: "no match" };
  return {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    matched: hit.display_name,
    type: hit.type,
  };
}

// Metres between two coordinates; used to flag drift, not for display.
function metersBetween(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function runSeed(seedPath) {
  const seed = JSON.parse(await readFile(seedPath, "utf8"));
  const out = [];
  for (const entry of seed) {
    const result = await geocode(entry.address);
    if (result.error) {
      console.log(`  MISS  ${entry.name}: ${result.error}`);
      out.push({ ...entry, lat: null, lng: null, note: result.error });
    } else {
      console.log(`  ok    ${entry.name}: ${result.lat.toFixed(6)}, ${result.lng.toFixed(6)}  [${result.type}]`);
      out.push({ ...entry, lat: result.lat, lng: result.lng, matched: result.matched });
    }
    await delay(1100); // Nominatim: 1 req/sec
  }
  const outPath = seedPath.replace(/\.json$/, ".geocoded.json");
  await writeFile(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`\nWrote ${outPath}`);
  const missed = out.filter((o) => o.lat == null);
  if (missed.length) console.log(`${missed.length} unresolved: ${missed.map((m) => m.name).join(", ")}`);
}

async function runVerify(cityId) {
  const registry = await import(`file://${path.join(root, "src", "cities", "index.js")}`);
  if (registry.resolveCityId(cityId) !== cityId) throw new Error(`unknown city "${cityId}"`);
  const city = await registry.loadCity(cityId);

  const withAddress = city.startups.filter((s) => s.address);
  console.log(`Checking ${withAddress.length} of ${city.startups.length} startups that carry an address\n`);

  let drifted = 0;
  for (const startup of withAddress) {
    const result = await geocode(startup.address);
    if (result.error) {
      console.log(`  MISS  ${startup.name}: ${result.error}`);
    } else {
      const off = metersBetween(startup, result);
      // A street-level geocode lands within a block; past ~250m the stored pin
      // and the stored address disagree about where the company actually is.
      if (off > 250) {
        drifted += 1;
        console.log(`  DRIFT ${startup.name}: pin is ${off.toFixed(0)}m from "${startup.address}"`);
        console.log(`        stored  ${startup.lat}, ${startup.lng}`);
        console.log(`        geocode ${result.lat.toFixed(6)}, ${result.lng.toFixed(6)} (${result.matched})`);
      } else {
        console.log(`  ok    ${startup.name}: ${off.toFixed(0)}m`);
      }
    }
    await delay(1100);
  }
  console.log(`\n${drifted} pins disagree with their stored address.`);
  process.exitCode = drifted ? 1 : 0;
}

if (args.seed) await runSeed(path.resolve(root, String(args.seed)));
else await runVerify(String(args.city ?? "sf"));
