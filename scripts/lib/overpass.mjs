import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { delay, withRetry } from "./net.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.resolve(__dirname, "..", ".cache");

// Public instances rate-limit hard. Rotate on failure rather than hammering one.
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const USER_AGENT = "ai-atlas-geo/1.0 (https://github.com/Nutlope/nyc-ai-atlas)";

let endpointIndex = 0;

// ------------------- Cached query -------------------
// Every response lands on disk keyed by the query text, so re-runs and tweaks
// downstream of the fetch cost nothing and don't re-hit the API.
// A tile Overpass refused four times will almost certainly refuse again, and
// with escalating timeouts each retry costs minutes. Remember the failure so
// later runs skip straight past it; pass --retry-gaps to attempt them again.
const RETRY_GAPS = process.argv.includes("--retry-gaps");

export async function overpass(ql, label = "query") {
  await mkdir(CACHE_DIR, { recursive: true });
  const key = createHash("sha1").update(ql).digest("hex").slice(0, 16);
  const cachePath = path.join(CACHE_DIR, `overpass-${key}.json`);
  const tombstone = path.join(CACHE_DIR, `overpass-${key}.failed`);

  try {
    return JSON.parse(await readFile(cachePath, "utf8"));
  } catch {
    // not cached yet
  }

  if (!RETRY_GAPS) {
    try {
      await readFile(tombstone, "utf8");
      throw new Error("skipped: failed on an earlier run (--retry-gaps to retry)");
    } catch (error) {
      if (error.message.startsWith("skipped:")) throw error;
      // no tombstone; carry on and fetch
    }
  }

  const json = await withRetry(label, async (attempt) => {
    const endpoint = ENDPOINTS[endpointIndex % ENDPOINTS.length];
    endpointIndex += 1;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": USER_AGENT,
      },
      body: "data=" + encodeURIComponent(ql),
      // Most tiles that succeed come back in under ~20s, so cut early and
      // rotate mirrors rather than burning minutes on one that will 504.
      // Later attempts get progressively more patient: by then the tile has
      // proven it is genuinely heavy, not just unlucky.
      signal: AbortSignal.timeout([35000, 60000, 100000, 150000][attempt] ?? 150000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(endpoint).host}`);
    return JSON.parse(await response.text());
  });

  await writeFile(cachePath, JSON.stringify(json), "utf8");
  await delay(400); // small courtesy gap between live calls
  return json;
}

// Called by the tiled fetcher when a tile is finally given up on.
export async function markFailed(ql) {
  const key = createHash("sha1").update(ql).digest("hex").slice(0, 16);
  await writeFile(path.join(CACHE_DIR, `overpass-${key}.failed`), new Date(0).toISOString(), "utf8");
}

// The global [bbox:] setting is dramatically faster than a per-statement bbox
// filter — whole-city coastline comes back in ~1.5s this way and times out the
// other way. Always build queries through here.
function ql(bbox, body, timeout = 120) {
  const [latMin, latMax, lngMin, lngMax] = bbox;
  const box = `${latMin.toFixed(5)},${lngMin.toFixed(5)},${latMax.toFixed(5)},${lngMax.toFixed(5)}`;
  return `[out:json][timeout:${timeout}][bbox:${box}];${body}`;
}

export async function overpassArea(bbox, body, label = "area", timeout = 120) {
  const json = await overpass(ql(bbox, body, timeout), label);
  return json.elements ?? [];
}

// ------------------- Tiled query -------------------
// Dense extracts (every building in a downtown) exceed Overpass's per-query
// resource limit even over a small bbox. Split by target degree size, which
// keeps each tile near the ~400-building sweet spot that returns in seconds.
export async function overpassTiles(bbox, body, { latStep, lngStep, label = "tiles", timeout = 120 }) {
  const [latMin, latMax, lngMin, lngMax] = bbox;
  const rows = Math.max(1, Math.ceil((latMax - latMin) / latStep));
  const cols = Math.max(1, Math.ceil((lngMax - lngMin) / lngStep));
  const dLat = (latMax - latMin) / rows;
  const dLng = (lngMax - lngMin) / cols;

  const queue = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      queue.push({
        r,
        c,
        tile: [latMin + r * dLat, latMin + (r + 1) * dLat, lngMin + c * dLng, lngMin + (c + 1) * dLng],
      });
    }
  }

  const elements = [];
  const seen = new Set();
  let done = 0;
  let next = 0;

  // Three workers against three mirrors. Public Overpass allows 2 concurrent
  // slots per instance, so this stays polite while cutting wall-clock roughly
  // threefold — the run is almost entirely spent waiting on loaded servers.
  async function worker() {
    while (next < queue.length) {
      const { r, c, tile } = queue[next++];
      let batch = [];
      try {
        batch = await overpassArea(tile, body, `${label} ${r},${c}`, timeout);
      } catch (error) {
        // A single dead tile shouldn't sink the run; record it and move on so
        // the next run doesn't spend minutes rediscovering the same failure.
        if (!error.message.startsWith("skipped:")) {
          await markFailed(ql(tile, body, timeout));
          console.warn(`  ${label} ${r},${c}: giving up (${error.message})`);
        }
      }
      // Tiles overlap at their seams; the same way comes back more than once.
      for (const el of batch) {
        const id = `${el.type}/${el.id}`;
        if (seen.has(id)) continue;
        seen.add(id);
        elements.push(el);
      }
      done += 1;
      // One line per tile: stdout is block-buffered when piped, so a \r
      // progress bar just looks like the script hung.
      console.log(`  ${label}: ${done}/${queue.length} tiles, ${elements.length} elements`);
    }
  }

  await Promise.all([worker(), worker(), worker()]);
  return elements;
}
