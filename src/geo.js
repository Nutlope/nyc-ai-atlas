// Accurate-enough NYC geography for the atlas, all coordinates [lat, lng].
// Traced to be recognizable: Manhattan's taper, the river widths, Central Park's
// rotated rectangle, the harbor islands. Building scatter is clipped to these
// polygons so nothing ever lands in the water.

// ---- Coastlines -----------------------------------------------------------

export const MANHATTAN = [
  // West (Hudson) side, south -> north
  [40.7008, -74.0136], // Battery, south tip
  [40.7085, -74.019], // Battery Park City
  [40.719, -74.0145], // Tribeca / piers
  [40.728, -74.011], // West Village
  [40.738, -74.0095], // Chelsea
  [40.748, -74.008], // Hudson Yards (W34)
  [40.7575, -74.004], // W50s
  [40.766, -73.9955], // W66 Riverside
  [40.776, -73.988], // W90s
  [40.788, -73.979], // Morningside (W110)
  [40.799, -73.971], // Manhattanville (W125)
  [40.81, -73.961], // Hamilton Heights
  [40.814, -73.954], // north of frame
  // East (Harlem + East River) side, north -> south
  [40.805, -73.934], // E130 Harlem River
  [40.793, -73.934], // East Harlem bulge (E100)
  [40.78, -73.941], // E84
  [40.769, -73.949], // E63 (Queensboro)
  [40.7585, -73.959], // E49 (UN)
  [40.749, -73.9665], // E38
  [40.74, -73.97], // E30
  [40.73, -73.972], // E20 (Stuy Town bulge)
  [40.72, -73.973], // E10
  [40.712, -73.976], // Williamsburg Br / Delancey
  [40.708, -73.983], // LES
  [40.709, -73.991], // Two Bridges
  [40.705, -73.998], // South St Seaport
  [40.7015, -74.0085], // FiDi SE
];

export const BROOKLYN_QUEENS = [
  // East River shore facing Manhattan, south -> north
  [40.674, -74.016], // Red Hook
  [40.683, -74.005], // Columbia waterfront
  [40.696, -73.999], // Brooklyn Bridge Park
  [40.703, -73.9905], // DUMBO
  [40.701, -73.976], // Navy Yard
  [40.7075, -73.9705], // Williamsburg S (waterfront)
  [40.722, -73.9645], // Williamsburg N (waterfront)
  [40.736, -73.956], // Greenpoint
  [40.747, -73.956], // LIC
  [40.751, -73.958], // Hunters Point
  [40.76, -73.945], // Queens East River
  [40.77, -73.934], // Astoria approach
  [40.78, -73.922], // Astoria
  [40.778, -73.91], // Astoria NE
  // Inland / frame edges, north -> south
  [40.77, -73.9], // Queens interior (frame edge)
  [40.7, -73.9], // Queens/Brooklyn interior
  [40.66, -73.92], // Brooklyn interior
  [40.655, -73.985], // South Brooklyn
  [40.66, -74.018], // Gowanus / Red Hook base
];

export const ROOSEVELT_ISLAND = [
  [40.749, -73.9585],
  [40.761, -73.951],
  [40.7695, -73.9455],
  [40.767, -73.943],
  [40.757, -73.9505],
  [40.747, -73.957],
];

export const JERSEY = [
  [40.694, -74.044], // Liberty State Park
  [40.711, -74.038], // Jersey City
  [40.728, -74.0335], // Hoboken S
  [40.748, -74.0265], // Hoboken N
  [40.77, -74.012], // Weehawken
  [40.792, -73.998], // top
  [40.804, -74.07], // top-left frame
  [40.69, -74.07], // bottom-left frame
];

// Harbor islands (drawn as ellipses elsewhere via center+radius)
export const HARBOR_ISLANDS = [
  { name: "Governors Island", lat: 40.6895, lng: -74.0185, rLat: 0.0055, rLng: 0.0055 },
  { name: "Liberty Island", lat: 40.6892, lng: -74.0445, rLat: 0.0016, rLng: 0.0016 },
  { name: "Ellis Island", lat: 40.6995, lng: -74.0395, rLat: 0.0018, rLng: 0.0022 },
];

// ---- Parks ----------------------------------------------------------------

export const CENTRAL_PARK = [
  [40.7681, -73.9819], // SW (Columbus Circle)
  [40.7644, -73.9737], // SE (Grand Army Plaza)
  [40.7969, -73.9582], // NE (110 & 5th)
  [40.8006, -73.9654], // NW (110 & CPW)
];

// Water + lawns inside Central Park: {center, rLat, rLng, kind}
export const CENTRAL_PARK_FEATURES = [
  { lat: 40.7857, lng: -73.9625, rLat: 0.0052, rLng: 0.004, kind: "water" }, // Reservoir
  { lat: 40.7762, lng: -73.9722, rLat: 0.0024, rLng: 0.0036, kind: "water" }, // The Lake
  { lat: 40.7669, lng: -73.9743, rLat: 0.0013, rLng: 0.0016, kind: "water" }, // The Pond
  { lat: 40.7972, lng: -73.9565, rLat: 0.0014, rLng: 0.0018, kind: "water" }, // Harlem Meer
  { lat: 40.7812, lng: -73.9665, rLat: 0.0026, rLng: 0.0022, kind: "lawn" }, // Great Lawn
  { lat: 40.7715, lng: -73.9745, rLat: 0.0022, rLng: 0.0026, kind: "lawn" }, // Sheep Meadow
];

// Smaller named green spaces: closed polygons
export const PARKS = [
  // Battery Park
  [
    [40.7005, -74.0175],
    [40.7042, -74.0193],
    [40.7058, -74.0162],
    [40.702, -74.0145],
  ],
  // Bryant Park
  [
    [40.7528, -73.9846],
    [40.7544, -73.9839],
    [40.7538, -73.9822],
    [40.7522, -73.9829],
  ],
  // Madison Square Park
  [
    [40.7416, -73.9885],
    [40.7434, -73.9878],
    [40.7427, -73.9866],
    [40.7409, -73.9873],
  ],
  // Union Square
  [
    [40.7352, -73.9918],
    [40.7366, -73.9911],
    [40.7359, -73.99],
    [40.7345, -73.9907],
  ],
  // Washington Square Park
  [
    [40.7301, -73.9982],
    [40.7316, -73.9974],
    [40.7308, -73.9962],
    [40.7293, -73.997],
  ],
  // Tompkins Square
  [
    [40.7258, -73.9826],
    [40.7272, -73.9819],
    [40.7264, -73.9806],
    [40.725, -73.9813],
  ],
  // Stuyvesant / East River Park strip
  [
    [40.7155, -73.972],
    [40.7235, -73.9695],
    [40.7245, -73.9678],
    [40.7165, -73.9703],
  ],
  // Hudson River Park strip (Chelsea/Village greenway)
  [
    [40.722, -74.0118],
    [40.745, -74.0085],
    [40.7455, -74.0068],
    [40.7225, -74.0102],
  ],
  // Fort Greene Park (Brooklyn)
  [
    [40.6905, -73.9755],
    [40.6925, -73.9745],
    [40.6915, -73.9728],
    [40.6895, -73.9738],
  ],
  // McCarren Park (Williamsburg/Greenpoint)
  [
    [40.7195, -73.953],
    [40.7225, -73.9515],
    [40.7212, -73.949],
    [40.7182, -73.9505],
  ],
  // Brooklyn Bridge Park strip
  [
    [40.695, -73.9995],
    [40.7025, -73.9925],
    [40.7035, -73.9912],
    [40.696, -73.998],
  ],
  // Randalls Island (NE)
  [
    [40.788, -73.925],
    [40.797, -73.918],
    [40.793, -73.905],
    [40.785, -73.915],
  ],
];

// ---- Districts (for building height + density) ----------------------------
// Each district scatters buildings inside MANHATTAN/BK clipped to the polygon.
// Heights in world units; ~1 unit ≈ 90m. Empire State ≈ 4.2, One WTC ≈ 5.9.
export const DISTRICTS = [
  { name: "FiDi", bbox: [40.701, 40.718, -74.017, -73.998], count: 150, h: [0.6, 3.0], tall: 0.28 },
  { name: "Tribeca/SoHo", bbox: [40.716, 40.728, -74.012, -73.997], count: 120, h: [0.4, 1.1], tall: 0.04 },
  { name: "LES/Chinatown", bbox: [40.71, 40.724, -73.998, -73.976], count: 120, h: [0.35, 1.0], tall: 0.03 },
  { name: "Village/Chelsea", bbox: [40.728, 40.748, -74.011, -73.99], count: 200, h: [0.4, 1.4], tall: 0.06 },
  { name: "Flatiron/Gramercy", bbox: [40.733, 40.746, -73.997, -73.978], count: 150, h: [0.5, 1.9], tall: 0.13 },
  { name: "Midtown", bbox: [40.745, 40.764, -74.0, -73.965], count: 320, h: [0.7, 3.2], tall: 0.32 },
  { name: "UWS/UES", bbox: [40.764, 40.8, -73.99, -73.943], count: 260, h: [0.5, 1.7], tall: 0.1 },
  { name: "Harlem", bbox: [40.8, 40.814, -73.97, -73.936], count: 90, h: [0.4, 1.2], tall: 0.05 },
  // Outer boroughs are intentionally sparse + faded (see `faded`): the map is
  // "complete" for Manhattan and only sketches the edges where companies sit.
  { name: "Brooklyn-N", bbox: [40.696, 40.736, -73.998, -73.952], count: 110, h: [0.25, 0.62], tall: 0, faded: true },
  { name: "Brooklyn-S", bbox: [40.66, 40.696, -74.005, -73.93], count: 90, h: [0.22, 0.5], tall: 0, faded: true },
  { name: "LIC/Queens", bbox: [40.74, 40.78, -73.96, -73.91], count: 70, h: [0.25, 0.6], tall: 0, faded: true },
  { name: "JerseyCity", bbox: [40.69, 40.79, -74.07, -74.025], count: 90, h: [0.25, 0.58], tall: 0, faded: true },
];

// ---- Subway lines ---------------------------------------------------------
// Stylized but plausible. {color, name, stops:[[lat,lng],...]}
export const SUBWAY_LINES = [
  {
    name: "456",
    color: 0x00933c, // green (Lexington Ave)
    stops: [
      [40.7026, -74.0119], // Brooklyn Bridge
      [40.7124, -74.004], // City Hall area approach
      [40.7203, -73.9933], // Spring
      [40.7283, -73.9903], // Astor Pl
      [40.7356, -73.9906], // Union Sq (14)
      [40.7396, -73.9862], // 23
      [40.7459, -73.9817], // 33
      [40.7527, -73.9772], // Grand Central (42)
      [40.7577, -73.9719], // 51
      [40.7625, -73.9679], // 59
      [40.7685, -73.9618], // 68 Hunter
      [40.7793, -73.9518], // 86
      [40.7911, -73.9419], // 110
    ],
  },
  {
    name: "NQRW",
    color: 0xfccc0a, // yellow (Broadway)
    stops: [
      [40.7041, -74.0136], // Whitehall
      [40.7077, -74.0114], // Rector
      [40.7138, -74.0079], // City Hall
      [40.7227, -73.9976], // Prince
      [40.7286, -73.9966], // 8 St NYU
      [40.7356, -73.9906], // Union Sq
      [40.7411, -73.9897], // 23
      [40.7484, -73.9876], // 34 Herald Sq
      [40.7544, -73.9869], // Times Sq (42)
      [40.7615, -73.9799], // 57-7
      [40.7646, -73.973], // 5 Av/59
      [40.7681, -73.9659], // Lexington/59
    ],
  },
  {
    name: "ACE",
    color: 0x0039a6, // blue (8th Ave)
    stops: [
      [40.7108, -74.0093], // Fulton
      [40.7203, -74.0053], // Canal
      [40.7263, -74.0051], // Spring
      [40.7341, -74.0029], // W4
      [40.7402, -74.0021], // 14 St
      [40.7457, -73.9981], // 23
      [40.7522, -73.9939], // 34 Penn
      [40.7572, -73.9899], // 42 Port Authority
      [40.7681, -73.9819], // Columbus Circle (59)
      [40.7777, -73.9762], // 81 Museum
      [40.7905, -73.9647], // 110 Cathedral
    ],
  },
  {
    name: "L",
    color: 0xa7a9ac, // grey (14th St crosstown)
    stops: [
      [40.7396, -74.0021], // 8 Av
      [40.7374, -73.9966], // 6 Av
      [40.7356, -73.9906], // Union Sq
      [40.7322, -73.9817], // 1 Av
      [40.7171, -73.9568], // Bedford Av (Brooklyn)
      [40.7142, -73.9504], // Lorimer
    ],
  },
];

// ---- Landmarks ------------------------------------------------------------
export const LANDMARKS = {
  empireState: { lat: 40.7484, lng: -73.9857 },
  chrysler: { lat: 40.7516, lng: -73.9755 },
  oneWTC: { lat: 40.7127, lng: -74.0134 },
  flatiron: { lat: 40.7411, lng: -73.9897 },
  grandCentral: { lat: 40.7527, lng: -73.9772 },
  metLife: { lat: 40.7537, lng: -73.9762 },
  timesSquare: { lat: 40.758, lng: -73.9855 },
  rockefeller: { lat: 40.7587, lng: -73.9787 },
  bryantLibrary: { lat: 40.7532, lng: -73.9822 },
  un: { lat: 40.7489, lng: -73.968 },
  vessel: { lat: 40.7538, lng: -74.0022 },
  hudsonYards: { lat: 40.7536, lng: -74.0011 },
  statueLiberty: { lat: 40.6892, lng: -74.0445 },
  oculus: { lat: 40.7115, lng: -74.0111 },
  woolworth: { lat: 40.7124, lng: -74.0083 },
  madisonSquareGarden: { lat: 40.7505, lng: -73.9934 },
};

// Bridges: pairs of anchor points (Manhattan side -> opposite side)
export const BRIDGES = [
  {
    name: "Brooklyn Bridge",
    deck: [
      [40.7061, -73.9969],
      [40.706, -73.9925],
      [40.7035, -73.9905],
      [40.7018, -73.9897],
    ],
    towers: [
      [40.7058, -73.9963],
      [40.7032, -73.9908],
    ],
    type: "suspension",
  },
  {
    name: "Manhattan Bridge",
    deck: [
      [40.7106, -73.9907],
      [40.7075, -73.9876],
      [40.7037, -73.9853],
      [40.7016, -73.9842],
    ],
    towers: [
      [40.7088, -73.9892],
      [40.7035, -73.9851],
    ],
    type: "suspension",
  },
  {
    name: "Williamsburg Bridge",
    deck: [
      [40.7137, -73.9718],
      [40.7115, -73.9658],
      [40.7095, -73.9603],
      [40.708, -73.9568],
    ],
    towers: [
      [40.7126, -73.969],
      [40.7092, -73.9598],
    ],
    type: "suspension",
  },
  {
    name: "Queensboro Bridge",
    deck: [
      [40.7588, -73.9588],
      [40.7565, -73.9528],
      [40.7546, -73.9472],
      [40.7531, -73.9425],
    ],
    towers: [
      [40.7572, -73.9548],
      [40.7544, -73.9466],
    ],
    type: "cantilever",
  },
];

// ---- Helpers --------------------------------------------------------------

// Ray-casting point-in-polygon, coords as [lat, lng].
export function pointInPoly(lat, lng, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function inEllipse(lat, lng, c) {
  const dy = (lat - c.lat) / c.rLat;
  const dx = (lng - c.lng) / c.rLng;
  return dx * dx + dy * dy <= 1;
}
