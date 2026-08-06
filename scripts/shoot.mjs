import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { loadAllCities } from "../src/cities/index.js";

const CITIES = await loadAllCities();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Screenshots every city in the installed Chrome and checks the scene drew.
// Needs a dev server running.
//
// npm run shoot [-- --url=... --areas --headed]

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const baseUrl = String(args.url ?? "http://127.0.0.1:5173");
const outDir = path.join(root, "screenshots");
const shootAreas = Boolean(args.areas);

// The scene is WebGL, so a GPU-less headless Chrome needs software rendering
// turned on explicitly or the canvas comes back blank.
const LAUNCH_ARGS = [
  "--enable-unsafe-swiftshader",
  "--use-gl=angle",
  "--use-angle=swiftshader",
  "--ignore-gpu-blocklist",
  "--disable-gpu-sandbox",
];

function cityHash(city, suffix = "") {
  const root = city.id === CITIES[0].id ? "#/" : `#/city/${city.id}`;
  if (!suffix) return root;
  return city.id === CITIES[0].id ? `#/${suffix}` : `#/city/${city.id}/${suffix}`;
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({
    channel: "chrome",
    headless: !args.headed,
    args: LAUNCH_ARGS,
  });

  const report = [];
  let failures = 0;

  for (const city of CITIES) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

    const url = `${baseUrl}/${cityHash(city)}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // init() publishes window.AIAtlas on its last line, so this is the signal
    // that every builder finished rather than a fixed sleep.
    await page.waitForFunction("window.AIAtlas !== undefined", null, { timeout: 60000 });
    // Then let a few frames land so labels lay out and the camera settles.
    await page.waitForTimeout(2500);

    const state = await page.evaluate(() => ({
      city: window.AIAtlas.city,
      startups: window.AIAtlas.startups,
      title: document.title,
      brand: document.querySelector("#brandTitle")?.textContent ?? "",
      sub: document.querySelector("#brandSub")?.textContent ?? "",
      areaButtons: document.querySelectorAll(".area-button").length,
      labels: document.querySelectorAll(".marker-label").length,
      miniPoints: document.querySelectorAll(".mini-point").length,
      miniPaths: document.querySelectorAll(".mini-map__shape").length,
      cityChips: document.querySelectorAll(".city-chip").length,
    }));

    const shot = path.join(outDir, `${city.id}-whole-board.png`);
    await page.screenshot({ path: shot });

    // A blank canvas is the classic silent failure, but reading pixels back
    // out of a WebGL canvas returns nothing unless preserveDrawingBuffer is on.
    // Compositing through a screenshot sidesteps that: a flat fill compresses
    // to almost nothing, a drawn city does not.
    const probe = await page.screenshot({ clip: { x: 520, y: 300, width: 420, height: 320 } });
    state.canvasBytes = probe.length;
    state.canvasNonBlank = probe.length > 15000;

    const problems = [];
    if (state.city !== city.id) problems.push(`resolved city "${state.city}", expected "${city.id}"`);
    if (!state.canvasNonBlank) problems.push(`canvas looks blank (${state.canvasBytes}B centre crop)`);
    if (state.areaButtons !== city.areas.length) problems.push(`${state.areaButtons} area buttons, expected ${city.areas.length}`);
    if (state.miniPoints !== city.startups.length) problems.push(`${state.miniPoints} mini-map points, expected ${city.startups.length}`);
    if (!state.miniPaths) problems.push("mini-map outline missing");
    // One registered city renders no switcher at all, by design.
    const expectedChips = CITIES.length > 1 ? CITIES.length : 0;
    if (state.cityChips !== expectedChips) problems.push(`${state.cityChips} city chips, expected ${expectedChips}`);
    if (consoleErrors.length) problems.push(`${consoleErrors.length} console errors`);

    report.push({ city: city.id, url, state, consoleErrors, problems, screenshot: path.relative(root, shot) });
    if (problems.length) failures += 1;

    console.log(`${problems.length ? "FAIL " : "PASS "} ${city.id}`);
    console.log(`      "${state.brand}" — ${state.sub}`);
    console.log(`      title="${state.title}" labels=${state.labels} pins=${state.miniPoints} areas=${state.areaButtons} canvas=${state.canvasNonBlank ? `drawn (${(state.canvasBytes / 1024).toFixed(0)}KB)` : "BLANK"}`);
    problems.forEach((p) => console.log(`      ! ${p}`));
    consoleErrors.slice(0, 5).forEach((e) => console.log(`      console: ${e.slice(0, 160)}`));

    // Optional: fly to each area and capture it.
    if (shootAreas) {
      for (const area of city.areas) {
        await page.evaluate((id) => window.AIAtlas.flyToArea(id), area.id);
        await page.waitForTimeout(2200); // camera flight is 1300ms plus easing
        await page.screenshot({ path: path.join(outDir, `${city.id}-${area.id}.png`) });
      }
      console.log(`      captured ${city.areas.length} area views`);
    }

    await context.close();
  }

  await browser.close();
  await writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(`\nScreenshots in ${path.relative(root, outDir)}/`);
  console.log(`${CITIES.length - failures}/${CITIES.length} cities clean\n`);
  process.exitCode = failures ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
