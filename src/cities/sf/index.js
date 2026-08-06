import {
  CENTER,
  SCALE,
  LAND,
  ISLANDS,
  PARKS,
  ROADS,
  TRANSIT,
  FOOTPRINTS,
  BLOCK_PLATES,
  OUTLINE,
  OUTLINE_BOUNDS,
} from "./geo.js";
import { AREAS, CONTEXT_POINTS, COMPANY_INFO, DATA_SOURCES, STARTUPS } from "./data.js";
import { createLandmarks } from "./landmarks.js";

// =================== San Francisco ===================
// A footprint city: land, parks, roads, transit and building boxes all come
// from OpenStreetMap via scripts/build-geo.mjs, so there is no street lattice
// to generate. SF has no single Manhattan-style grid anyway — downtown, the
// Mission and the Richmond all run at different angles.

export const sf = {
  id: "sf",
  name: "San Francisco",
  shortName: "SF",
  mapLabel: "SF",
  tagline: "AI companies across San Francisco",
  description:
    "A high-fidelity 3D interactive map of San Francisco's AI companies, neighborhood by neighborhood.",
  jobsLocation: "San Francisco Bay Area",
  credit: {
    label: "OpenStreetMap + SF Standard lease reporting",
    href: DATA_SOURCES.sfStandard,
    date: "August 2026",
  },
  dataSources: DATA_SOURCES,

  center: CENTER,
  scale: SCALE,

  camera: {
    minDistance: 16,
    maxDistance: 150,
    fogDensity: 0.005,
    // Wider than NYC: the Pacific sits west of the peninsula and the bay east,
    // so the water plane has to reach past both.
    water: { width: 300, depth: 280 },
  },

  grid: null, // footprint city — buildings are imported, not generated

  geo: {
    land: LAND,
    landmasses: [
      { coords: LAND, material: "asphalt", y: 0 },
      ...ISLANDS.map((coords) => ({ coords, material: "landAlt", y: 0.01 })),
    ],
    buildable: [LAND, ...ISLANDS],
    islands: null, // ISLANDS are real polygons here, not centre+radius ellipses
    bigPark: null, // Golden Gate Park arrives as an ordinary park polygon
    bigParkFeatures: null,
    parks: PARKS,
    districts: [], // heights come from the footprints themselves
    transit: TRANSIT,
    bridges: [
      {
        name: "Bay Bridge (West Span)",
        deck: [
          [37.7906, -122.3878],
          [37.7955, -122.3805],
          [37.801, -122.373],
          [37.808, -122.3648],
        ],
        towers: [
          [37.796, -122.3798],
          [37.8022, -122.3714],
        ],
        type: "suspension",
      },
      {
        name: "Golden Gate Bridge",
        deck: [
          [37.807, -122.4753],
          [37.8125, -122.476],
          [37.8185, -122.4768],
          [37.8235, -122.4775],
        ],
        towers: [
          [37.8103, -122.4756],
          [37.8177, -122.4767],
        ],
        type: "suspension",
      },
    ],
    footprints: FOOTPRINTS,
    blockPlates: BLOCK_PLATES,
    roads: ROADS,
  },

  // Muni and BART run in subway or at grade here; nothing climbs a viaduct
  // inside the city limits.
  transitElevated: [],

  // ------------------- Ambient scene dressing -------------------
  ambient: {
    piers: [
      // The Embarcadero finger piers, pointing north-east into the bay.
      { lat: 37.8085, lng: -122.4105, width: 1.3, depth: 0.34, rotation: -0.95 },
      { lat: 37.8035, lng: -122.4013, width: 1.2, depth: 0.32, rotation: -0.95 },
      { lat: 37.8003, lng: -122.3975, width: 1.2, depth: 0.32, rotation: -0.95 },
      { lat: 37.7972, lng: -122.3922, width: 1.0, depth: 0.3, rotation: -1.1 },
      // Mission Bay / Dogpatch working piers.
      { lat: 37.7688, lng: -122.3838, width: 1.0, depth: 0.28, rotation: -1.2 },
    ],
    ferryRoutes: [
      {
        // Ferry Building out to the East Bay.
        color: 0x2e6cff,
        path: [
          [37.7955, -122.3925],
          [37.7985, -122.3805],
          [37.8025, -122.3685],
          [37.8065, -122.3585],
        ],
      },
      {
        // North across the Golden Gate toward Sausalito.
        color: 0xffcc4d,
        path: [
          [37.797, -122.3915],
          [37.8095, -122.4045],
          [37.8185, -122.4285],
          [37.8255, -122.4555],
        ],
      },
      {
        // Down the waterfront to Mission Bay and Oracle Park.
        color: 0xf25c19,
        path: [
          [37.7995, -122.3925],
          [37.7885, -122.3835],
          [37.7785, -122.3805],
          [37.7695, -122.3805],
        ],
      },
    ],
    flightPaths: [
      // SFO departures climbing north over the bay.
      [
        [37.705, -122.36, 16],
        [37.762, -122.345, 20],
        [37.822, -122.36, 22],
      ],
      // Ocean approach crossing the peninsula.
      [
        [37.82, -122.53, 24],
        [37.775, -122.5, 21],
        [37.72, -122.44, 18],
      ],
    ],
    hazePads: [
      { lat: 37.8, lng: -122.31, w: 46, d: 52 }, // Oakland / Berkeley across the bay
      { lat: 37.855, lng: -122.47, w: 40, d: 34 }, // Marin headlands
      { lat: 37.685, lng: -122.43, w: 40, d: 26 }, // Daly City / the peninsula
    ],
    treeRows: [
      { from: [37.7935, -122.396], to: [37.7702, -122.4268], step: 0.85 }, // Market St
      { from: [37.769, -122.4265], to: [37.7502, -122.4258], step: 0.9 }, // Dolores St
      { from: [37.7715, -122.4515], to: [37.7723, -122.4405], step: 1.0 }, // the Panhandle
      { from: [37.8005, -122.4105], to: [37.7955, -122.3935], step: 1.0 }, // the Embarcadero
    ],
    birdFlocks: [
      { lat: 37.7695, lng: -122.4835, alt: 5.2, radius: 5.4, count: 5 }, // Ocean Beach
      { lat: 37.8095, lng: -122.4045, alt: 4.8, radius: 4.2, count: 4 }, // the waterfront
      { lat: 37.7695, lng: -122.4835, alt: 6.4, radius: 3.6, count: 3 }, // out over the Pacific
    ],
  },

  createLandmarks,

  areas: AREAS,
  startups: STARTUPS,
  companyInfo: COMPANY_INFO,
  contextPoints: CONTEXT_POINTS,

  miniMap: {
    viewBox: "0 0 120 160",
    label: "Simplified San Francisco outline and active area",
    paths: [{ className: "mini-map__land", d: OUTLINE }],
    bounds: OUTLINE_BOUNDS,
    clamp: { x: [5, 115], y: [5, 155] },
  },
};
