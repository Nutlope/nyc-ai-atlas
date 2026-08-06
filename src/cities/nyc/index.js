import {
  MANHATTAN,
  BROOKLYN_QUEENS,
  ROOSEVELT_ISLAND,
  JERSEY,
  HARBOR_ISLANDS,
  CENTRAL_PARK,
  CENTRAL_PARK_FEATURES,
  PARKS,
  DISTRICTS,
  SUBWAY_LINES,
  LANDMARKS,
  BRIDGES,
} from "./geo.js";
import { AREAS, CONTEXT_POINTS, COMPANY_INFO, DATA_SOURCES, STARTUPS } from "./data.js";
import { createBigParkDetails, createLandmarks } from "./landmarks.js";

// =================== New York City ===================
// The original atlas. Buildings come from the Manhattan street lattice rather
// than real footprints, so this city carries a `grid` and no `footprints`.

export const nyc = {
  id: "nyc",
  name: "New York City",
  shortName: "NYC",
  mapLabel: "NYC",
  tagline: "AI startups across Manhattan and Brooklyn",
  description:
    "A high-fidelity 3D interactive map of New York City's AI startups, neighborhood by neighborhood.",
  jobsLocation: "New York",
  credit: {
    label: "Lux NYC AI database",
    href: DATA_SOURCES.airtable,
    date: "June 2026",
  },
  dataSources: DATA_SOURCES,

  // Flat equirectangular projection tuned to Manhattan's latitude.
  center: { lat: 40.7294, lng: -73.9957 },
  scale: { lat: 1180, lng: 900 },

  camera: {
    minDistance: 18,
    maxDistance: 140,
    fogDensity: 0.0052,
    water: { width: 260, depth: 230 },
  },

  // Manhattan's grid runs ~29 degrees east of north. Buildings, sidewalk plates
  // and traffic all share this lattice so the blocks line up.
  grid: {
    theta: (29 * Math.PI) / 180,
    latRef: 40.75, // lng compression reference
    origin: { lat: 40.7359, lng: -73.9911 }, // Union Square
    cellU: 0.00094, // street to street
    cellV: 0.0026, // avenue to avenue
    iRange: [-52, 98],
    jRange: [-8, 8],
    avenueRange: [-7, 8],
    crosstownRows: [-21, -12, 0, 9, 20, 28, 43], // Canal, Houston, 14th, 23rd, 34th, 42nd, 57th
    // Shoreline highways: West Side Highway + FDR, inset from the water.
    shoreRoads: [
      { slice: [0, 13], offsetLng: 0.0016 },
      { slice: [13], offsetLng: -0.0016 },
    ],
    // Each outer borough shares one street orientation, offset from the
    // Manhattan grid so the boroughs don't all read as the same city.
    outerRotations: {
      "Brooklyn-N": 0.9,
      "Brooklyn-S": 0.55,
      "LIC/Queens": 0.2,
      JerseyCity: 0.12,
    },
  },

  // Lines that run outdoors once they leave Manhattan climb onto viaducts.
  transitElevated: ["7", "L"],
  transitHub: { name: "Grand Central", lat: 40.7527, lng: -73.9772, y: 2.7 },

  geo: {
    land: MANHATTAN,
    landmasses: [
      { coords: MANHATTAN, material: "asphalt", y: 0 },
      { coords: BROOKLYN_QUEENS, material: "landAlt", y: 0 },
      { coords: JERSEY, material: "land", y: 0 },
      { coords: ROOSEVELT_ISLAND, material: "landAlt", y: 0.01 },
    ],
    buildable: [MANHATTAN, BROOKLYN_QUEENS, JERSEY, ROOSEVELT_ISLAND],
    // Subway runs at surface level over these, on viaducts over those.
    transitCore: [MANHATTAN, ROOSEVELT_ISLAND],
    transitOuter: [BROOKLYN_QUEENS, JERSEY],
    islands: HARBOR_ISLANDS,
    bigPark: CENTRAL_PARK,
    bigParkFeatures: CENTRAL_PARK_FEATURES,
    parks: PARKS,
    districts: DISTRICTS,
    transit: SUBWAY_LINES,
    landmarks: LANDMARKS,
    bridges: BRIDGES,
    footprints: null, // lattice city: buildings are generated, not imported
    roads: null,
  },

  // ------------------- Ambient scene dressing -------------------
  ambient: {
    piers: [
      // Hudson River piers (Manhattan west side)
      { lat: 40.7228, lng: -74.0125, width: 2.4, depth: 0.5, rotation: 0.4 },
      { lat: 40.7322, lng: -74.0112, width: 2.4, depth: 0.5, rotation: 0.4 },
      { lat: 40.7425, lng: -74.0098, width: 2.6, depth: 0.52, rotation: 0.4 },
      // East River / Seaport piers
      { lat: 40.7055, lng: -74.0005, width: 1.8, depth: 0.42, rotation: -0.7 },
      { lat: 40.7015, lng: -73.9965, width: 1.8, depth: 0.42, rotation: -0.7 },
    ],
    ferryRoutes: [
      {
        // East River: harbor up the channel between Manhattan and Brooklyn/Queens
        color: 0x2e6cff,
        path: [
          [40.699, -74.0],
          [40.707, -73.99],
          [40.715, -73.979],
          [40.724, -73.969],
          [40.735, -73.962],
          [40.747, -73.957],
          [40.757, -73.951],
        ],
      },
      {
        // Hudson River: harbor up the channel between Manhattan and New Jersey
        color: 0xffcc4d,
        path: [
          [40.7, -74.024],
          [40.713, -74.02],
          [40.727, -74.018],
          [40.741, -74.016],
          [40.755, -74.011],
          [40.767, -74.005],
        ],
      },
      {
        // Battery out past Liberty and Ellis and back, in Staten Island orange.
        color: 0xf25c19,
        path: [
          [40.7005, -74.0155],
          [40.6965, -74.026],
          [40.6925, -74.034],
          [40.6905, -74.0405],
          [40.6945, -74.0375],
          [40.699, -74.028],
          [40.7005, -74.0155],
        ],
      },
    ],
    flightPaths: [
      [
        [40.69, -74.075, 17],
        [40.725, -74.02, 20],
        [40.77, -73.94, 19],
      ],
      [
        [40.805, -74.065, 24],
        [40.755, -74.0, 22],
        [40.71, -73.92, 20],
      ],
    ],
    hazePads: [
      { lat: 40.682, lng: -73.952, w: 48, d: 36 }, // Brooklyn
      { lat: 40.714, lng: -73.928, w: 32, d: 26 }, // Williamsburg / Bushwick
      { lat: 40.762, lng: -73.918, w: 32, d: 28 }, // LIC / Astoria
      { lat: 40.742, lng: -74.048, w: 28, d: 48 }, // Jersey
    ],
    treeRows: [
      { from: [40.7365, -73.9885], to: [40.7825, -73.955], step: 0.8 },
      { from: [40.7205, -74.0125], to: [40.7575, -73.9985], step: 0.95 },
      { from: [40.708, -73.996], to: [40.7345, -73.9728], step: 1.05 },
    ],
    birdFlocks: [
      { lat: 40.781, lng: -73.9665, alt: 6.4, radius: 4.6, count: 5 }, // Central Park
      { lat: 40.696, lng: -74.021, alt: 4.6, radius: 5.2, count: 4 }, // the harbor
      { lat: 40.7003, lng: -73.9955, alt: 5.2, radius: 3.4, count: 3 }, // Brooklyn Bridge
    ],
  },

  createLandmarks,
  createBigParkDetails,

  areas: AREAS,
  startups: STARTUPS,
  companyInfo: COMPANY_INFO,
  contextPoints: CONTEXT_POINTS,

  miniMap: {
    viewBox: "0 0 120 160",
    label: "Simplified NYC outline and active area",
    paths: [
      { className: "mini-map__land", d: "M48 10 L72 18 L82 48 L76 84 L84 120 L62 148 L42 130 L48 92 L38 56 Z" },
      { className: "mini-map__brooklyn", d: "M76 92 L110 104 L104 150 L66 148 L84 120 Z" },
    ],
    bounds: { lngMin: -74.028, lngSpan: 0.082, latMax: 40.765, latSpan: 0.082, x: 12, y: 10, w: 96, h: 135 },
    clamp: { x: [5, 115], y: [5, 155] },
  },
};
