// =================== Per-city extract config for scripts/build-geo.mjs ===================
// bbox tuples are [latMin, latMax, lngMin, lngMax].
//
// `center`/`scale` must match the values the city module hands the renderer:
// building footprints are pre-projected at build time, so a mismatch would slide
// the whole city off its coastline.
//
// scale.lng is scale.lat * cos(center.lat) — that ratio is what keeps the map
// from stretching east-west. NYC uses 1180/900 at 40.73 (cos = 0.758).

export const CITY_SOURCES = {
  sf: {
    id: "sf",
    name: "San Francisco",
    // SF county limits, peninsula tip only. South edge is the San Mateo line.
    bbox: [37.7025, 37.8135, -122.5175, -122.3555],
    center: { lat: 37.7775, lng: -122.4125 },
    scale: { lat: 980, lng: 775 }, // cos(37.7775) = 0.7906
    // Coastline, parks, roads and transit all come back whole-city in seconds.
    // Buildings do not: every footprint downtown blows Overpass's per-query
    // resource limit, so the core zones get tiled near the size that returns
    // ~400 buildings, and the rest of the city only asks for tagged heights.
    tiles: {
      buildingsCore: { latStep: 0.01, lngStep: 0.013 },
      buildingsOuter: { latStep: 0.028, lngStep: 0.04 },
    },

    // Full building fidelity where the companies actually are. Everything
    // outside these keeps only larger structures, so the rest of the city still
    // has texture without carrying 160k footprints.
    coreZones: [
      [37.7690, 37.8080, -122.4130, -122.3860], // FiDi / Jackson Sq / SoMa / Mission Bay
      [37.7600, 37.7860, -122.4400, -122.4080], // Hayes Valley / Civic Center / Mid-Market
      [37.7480, 37.7700, -122.4300, -122.3960], // Mission / Potrero
    ],
    minAreaCore: 140, // m^2
    minAreaOuter: 700,

    // The southern county line is a land border, not a shore, so the stitched
    // coastline is open there and has to be closed manually.
    landClose: { southLat: 37.7045 },

    parks: { minArea: 12000 }, // m^2 — drop pocket parks, keep the recognizable ones
    roads: "^(motorway|trunk|primary|secondary)$",
    transit: "^(subway|light_rail|tram)$",
  },
};

export function getCitySource(id) {
  const source = CITY_SOURCES[id];
  if (!source) {
    throw new Error(`Unknown city "${id}". Known: ${Object.keys(CITY_SOURCES).join(", ")}`);
  }
  return source;
}
