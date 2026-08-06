// =================== Geometry helpers for the OSM -> atlas pipeline ===================
// Coordinates arrive from Overpass as {lat, lon}. Polygons that the app tests at
// runtime (land, parks) stay in [lat, lng] because pointInPoly works in degrees.
// Buildings get pre-projected to world XZ here: they are the bulk of the payload
// and never need lat/lng again once placed.

// ------------------- Projection -------------------
// Mirrors project() in src/main.js. Kept in sync by construction: the city module
// exports the same center/scale the renderer uses.
export function makeProjector(center, scale) {
  return (lat, lng) => ({
    x: (lng - center.lng) * scale.lng,
    z: -(lat - center.lat) * scale.lat,
  });
}

// ------------------- Douglas-Peucker -------------------
// pointInPoly is O(n) and runs tens of thousands of times during scatter, so
// coastlines have to come down from thousands of points to ~100.
export function simplify(points, tolerance) {
  if (points.length <= 2) return points.slice();

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];

  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDist = 0;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const dist = perpendicularDistance(points[i], points[first], points[last]);
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }
    if (maxDist > tolerance && index !== -1) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

function perpendicularDistance(p, a, b) {
  const [py, px] = p;
  const [ay, ax] = a;
  const [by, bx] = b;
  const dy = by - ay;
  const dx = bx - ax;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Shrink a ring until it fits a point budget, loosening tolerance as needed.
export function simplifyToBudget(points, budget, startTolerance = 0.00004) {
  let tolerance = startTolerance;
  let out = simplify(points, tolerance);
  let guard = 0;
  while (out.length > budget && guard < 40) {
    tolerance *= 1.5;
    out = simplify(points, tolerance);
    guard += 1;
  }
  return out;
}

// ------------------- Convex hull (Andrew monotone chain) -------------------
export function convexHull(pts) {
  if (pts.length < 4) return pts.slice();
  const sorted = pts.slice().sort((a, b) => a.x - b.x || a.z - b.z);
  const cross = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// ------------------- Minimum-area oriented bounding box -------------------
// Rotating calipers: the min-area rectangle always shares an edge with the hull,
// so test every hull edge and keep the tightest.
//
// Rotation convention matches createBuildings in src/main.js, which composes
// quat(UP, rot) against a unit box scaled (w, h, d). A Y rotation sends the box's
// local Z axis to (sin rot, cos rot) in world XZ, so rot = atan2(depth.x, depth.z).
export function minAreaRect(worldPts) {
  const hull = convexHull(worldPts);
  if (hull.length < 3) return null;

  let best = null;
  for (let i = 0; i < hull.length; i += 1) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const len = Math.hypot(ex, ez);
    if (len < 1e-9) continue;
    // Edge direction becomes the width axis; its normal becomes depth.
    const ux = ex / len;
    const uz = ez / len;
    const nx = -uz;
    const nz = ux;

    let minU = Infinity;
    let maxU = -Infinity;
    let minN = Infinity;
    let maxN = -Infinity;
    for (const p of hull) {
      const du = p.x * ux + p.z * uz;
      const dn = p.x * nx + p.z * nz;
      if (du < minU) minU = du;
      if (du > maxU) maxU = du;
      if (dn < minN) minN = dn;
      if (dn > maxN) maxN = dn;
    }
    const w = maxU - minU;
    const d = maxN - minN;
    const area = w * d;
    if (!best || area < best.area) {
      const midU = (minU + maxU) / 2;
      const midN = (minN + maxN) / 2;
      best = {
        area,
        w,
        d,
        x: ux * midU + nx * midN,
        z: uz * midU + nz * midN,
        rot: Math.atan2(nx, nz),
      };
    }
  }
  return best;
}

// ------------------- Ring measurement -------------------
// Shoelace in metres, using a local equirectangular approximation. Used to drop
// footprints too small to be worth an instance.
export function ringAreaMeters(ring) {
  if (ring.length < 3) return 0;
  const latRef = (ring.reduce((sum, p) => sum + p[0], 0) / ring.length) * (Math.PI / 180);
  const mPerDegLat = 111132;
  const mPerDegLng = 111320 * Math.cos(latRef);
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][1] * mPerDegLng;
    const yi = ring[i][0] * mPerDegLat;
    const xj = ring[j][1] * mPerDegLng;
    const yj = ring[j][0] * mPerDegLat;
    sum += xj * yi - xi * yj;
  }
  return Math.abs(sum) / 2;
}

// ------------------- Way stitching -------------------
// OSM coastline arrives as directed fragments. Join them end-to-end into the
// longest runs possible so the result is a usable outline instead of confetti.
export function stitchWays(ways, epsilon = 1e-7) {
  const key = (pt) => `${pt[0].toFixed(7)}:${pt[1].toFixed(7)}`;
  const remaining = ways.filter((w) => w.length >= 2).map((w) => w.slice());
  const byStart = new Map();
  remaining.forEach((way, i) => {
    const k = key(way[0]);
    if (!byStart.has(k)) byStart.set(k, []);
    byStart.get(k).push(i);
  });

  const used = new Set();
  const runs = [];

  remaining.forEach((way, i) => {
    if (used.has(i)) return;
    used.add(i);
    const run = way.slice();

    // Walk forward while some unused way starts where this one ends.
    let extended = true;
    while (extended) {
      extended = false;
      const tail = key(run[run.length - 1]);
      for (const candidate of byStart.get(tail) ?? []) {
        if (used.has(candidate)) continue;
        used.add(candidate);
        run.push(...remaining[candidate].slice(1));
        extended = true;
        break;
      }
    }
    runs.push(run);
  });

  // Longest first: the main shoreline should win over stray islet fragments.
  return runs.sort((a, b) => b.length - a.length);
}

// ------------------- Height resolution -------------------
// OSM tags height in metres (sometimes with a unit suffix) or in storeys.
// One world unit is ~90m, per the note in the original geo.js.
const METERS_PER_UNIT = 90;
const METERS_PER_LEVEL = 3.2;
// OSM carries the occasional nonsense height (sub-metre, or a unit the tag
// didn't declare). Anything under one storey is a tagging artefact, and a
// zero-height box would be an invisible degenerate instance.
const MIN_METERS = 3;

export function resolveHeight(tags, fallbackLevels = 3) {
  const raw = tags?.height ?? tags?.["building:height"];
  if (raw) {
    const meters = parseFloat(String(raw).replace(/[^\d.]/g, ""));
    if (Number.isFinite(meters) && meters > 0) return Math.max(meters, MIN_METERS) / METERS_PER_UNIT;
  }
  const levels = parseFloat(tags?.["building:levels"]);
  if (Number.isFinite(levels) && levels > 0) {
    return Math.max(levels * METERS_PER_LEVEL, MIN_METERS) / METERS_PER_UNIT;
  }
  return (fallbackLevels * METERS_PER_LEVEL) / METERS_PER_UNIT;
}
