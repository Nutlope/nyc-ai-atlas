import { CITY_MANIFEST, DEFAULT_CITY_ID, loadAllCities, resolveCityId } from "../src/cities/index.js";
import { pointInPoly } from "../src/geo-utils.js";

const CITIES = await loadAllCities();

// Data invariants the scene builders assume. A violation shows up as a
// mislocated or invisible city rather than an exception, so check up front.
//
// npm run check

let failures = 0;
let warnings = 0;

function fail(message) {
  console.error(`  FAIL  ${message}`);
  failures += 1;
}

function warn(message) {
  console.warn(`  warn  ${message}`);
  warnings += 1;
}

function ok(message) {
  console.log(`  ok    ${message}`);
}

for (const city of CITIES) {
  console.log(`\n${city.name} (${city.id})`);

  // ------------------- Required shape -------------------
  for (const key of ["id", "name", "shortName", "center", "scale", "camera", "geo", "areas", "startups"]) {
    if (city[key] == null) fail(`missing "${key}"`);
  }
  if (!city.geo.land?.length) fail("geo.land is empty");
  if (!city.grid && !city.geo.footprints) fail("needs either a grid or imported footprints");

  // ------------------- Areas -------------------
  const areaIds = new Set(city.areas.map((a) => a.id));
  if (!areaIds.has("all")) fail('no "all" area — init() reads AREA_BY_ID.all');
  for (const area of city.areas) {
    if (!area.focus) fail(`area "${area.id}" has no camera focus`);
    if (!area.description) warn(`area "${area.id}" has no description`);
  }
  const numbers = city.areas.map((a) => a.number);
  if (new Set(numbers).size !== numbers.length) warn("duplicate area numbers");
  ok(`${city.areas.length} areas`);

  // ------------------- Startups -------------------
  const ids = new Set();
  let offLand = 0;
  let badArea = 0;
  for (const s of city.startups) {
    if (ids.has(s.id)) fail(`duplicate startup id "${s.id}"`);
    ids.add(s.id);
    if (!areaIds.has(s.area)) {
      badArea += 1;
      fail(`"${s.name}" has unknown area "${s.area}"`);
    }
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) fail(`"${s.name}" has no coordinates`);
    // A pin in the water is the single most visible data error.
    const onLand = (city.geo.buildable ?? [city.geo.land]).some((poly) => pointInPoly(s.lat, s.lng, poly));
    if (!onLand) {
      offLand += 1;
      warn(`"${s.name}" (${s.lat}, ${s.lng}) sits outside the land polygons`);
    }
  }
  if (!badArea) ok(`${city.startups.length} startups, all areas valid`);
  if (!offLand) ok("every pin lands on land");

  // ------------------- Blurbs -------------------
  const missingBlurb = city.startups.filter((s) => !city.companyInfo?.[s.id]);
  if (missingBlurb.length) {
    warn(`${missingBlurb.length} startups without a COMPANY_INFO entry: ${missingBlurb.slice(0, 5).map((s) => s.name).join(", ")}`);
  } else {
    ok("every startup has a blurb");
  }

  // ------------------- Mini-map -------------------
  if (!city.miniMap?.bounds) fail("no miniMap.bounds");
  else {
    const b = city.miniMap.bounds;
    const outside = city.startups.filter(
      (s) => s.lng < b.lngMin || s.lng > b.lngMin + b.lngSpan || s.lat > b.latMax || s.lat < b.latMax - b.latSpan,
    );
    if (outside.length) warn(`${outside.length} startups fall outside the mini-map bounds (they will clamp to the edge)`);
    else ok("mini-map bounds cover every pin");
  }

  // ------------------- Footprint cities -------------------
  if (city.geo.footprints) {
    const n = city.geo.footprints.length;
    if (!n) fail("footprints array is empty");
    const bad = city.geo.footprints.filter((b) => !Number.isFinite(b.x) || !Number.isFinite(b.h) || b.h <= 0);
    if (bad.length) fail(`${bad.length} footprints have invalid geometry`);
    else ok(`${n} footprints, all finite`);
    const tallest = Math.max(...city.geo.footprints.map((b) => b.h));
    ok(`tallest building ${(tallest * 90).toFixed(0)}m`);
  }

  if (city.geo.transit?.length) ok(`${city.geo.transit.length} transit lines`);
  if (city.geo.roads?.length) ok(`${city.geo.roads.length} road polylines`);
}

// ------------------- Registry -------------------
console.log("\nRegistry");
if (resolveCityId(DEFAULT_CITY_ID) !== DEFAULT_CITY_ID) fail(`DEFAULT_CITY_ID "${DEFAULT_CITY_ID}" has no loader`);
else ok(`default city: ${DEFAULT_CITY_ID}`);
if (new Set(CITIES.map((c) => c.id)).size !== CITIES.length) fail("duplicate city ids");
// The manifest drives the switcher without loading any geometry, so a drift
// between it and the loaders would show up as a chip that goes nowhere.
const manifestIds = CITY_MANIFEST.map((c) => c.id).join(",");
const loadedIds = CITIES.map((c) => c.id).join(",");
if (manifestIds !== loadedIds) fail(`manifest [${manifestIds}] does not match loaded [${loadedIds}]`);
else ok("manifest matches the loaded cities");

console.log(`\n${failures} failures, ${warnings} warnings\n`);
process.exitCode = failures ? 1 : 0;
