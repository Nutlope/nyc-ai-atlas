// Switcher order. First entry is the default city and keeps unprefixed routes.
//
// The manifest is names only, so importing it pulls in no geometry — a city's
// geo module is hundreds of kB and only the active one should load. Keep the
// manifest and the loaders in sync; npm run check enforces it.

export const CITY_MANIFEST = [
  { id: "nyc", name: "New York City", shortName: "NYC" },
  { id: "sf", name: "San Francisco", shortName: "SF" },
];

export const DEFAULT_CITY_ID = CITY_MANIFEST[0].id;

const LOADERS = {
  nyc: () => import("./nyc/index.js").then((m) => m.nyc),
  sf: () => import("./sf/index.js").then((m) => m.sf),
};

export function resolveCityId(id) {
  return LOADERS[id] ? id : DEFAULT_CITY_ID;
}

export function loadCity(id) {
  return LOADERS[resolveCityId(id)]();
}

// For tooling that genuinely needs every city at once. Never call this from
// the app: it defeats the whole point of the split.
export function loadAllCities() {
  return Promise.all(CITY_MANIFEST.map((entry) => LOADERS[entry.id]()));
}
