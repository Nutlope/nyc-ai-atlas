import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { AREAS, CONTEXT_POINTS, DATA_SOURCES, STARTUPS } from "./data.js";

const CENTER = { lat: 40.7294, lng: -73.9957 };
const SCALE = { lat: 1180, lng: 900 };
const AREA_BY_ID = Object.fromEntries(AREAS.map((area) => [area.id, area]));

const state = {
  activeAreaId: "all",
  selectedId: null,
  labelsMode: window.matchMedia("(max-width: 54rem)").matches ? "key" : "all",
  trafficLive: true,
  tourLive: false,
  tourIndex: 0,
  flight: null,
};

const canvas = document.querySelector("#scene");
const labelsLayer = document.querySelector("#labelsLayer");
const areaList = document.querySelector("#areaList");
const detailCard = document.querySelector("#detailCard");
const progressRail = document.querySelector("#progressRail");
const miniMapPoints = document.querySelector("#miniMapPoints");
const searchInput = document.querySelector("#companySearch");
const searchResults = document.querySelector("#searchResults");
const tourToggle = document.querySelector("#tourToggle");
const labelToggle = document.querySelector("#labelToggle");
const trafficToggle = document.querySelector("#trafficToggle");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a3454);
scene.fog = new THREE.FogExp2(0x0a3454, 0.012);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 18;
controls.maxDistance = 140;
controls.maxPolarAngle = Math.PI * 0.47;
controls.screenSpacePanning = false;

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const UP = new THREE.Vector3(0, 1, 0);

const markerMeshes = [];
const startupMarkers = new Map();
const labelElements = new Map();
const contextLabelElements = [];
const landmarkLabelElements = [];
const waterSurfaces = [];
const vehicleFleet = [];
const ferryFleet = [];
const planeFleet = [];
const subwayFleet = [];
let tourTimer = null;
let hoverCandidate = null;

const colors = {
  accent: new THREE.Color(0x2664ff),
  cyan: new THREE.Color(0x33d6c7),
  green: new THREE.Color(0x32bd7b),
  yellow: new THREE.Color(0xffcc4d),
  red: new THREE.Color(0xe54c42),
  graphite: new THREE.Color(0x19202b),
  land: new THREE.Color(0xd6d0ad),
  land2: new THREE.Color(0xc8d89a),
  road: new THREE.Color(0x2b2f38),
  building: new THREE.Color(0xd9d6ca),
  buildingDark: new THREE.Color(0x8e9899),
};

const materials = {
  water: new THREE.MeshStandardMaterial({
    color: 0x11608e,
    roughness: 0.45,
    metalness: 0.08,
  }),
  land: new THREE.MeshStandardMaterial({
    color: colors.land,
    roughness: 0.82,
    side: THREE.DoubleSide,
  }),
  landAlt: new THREE.MeshStandardMaterial({
    color: colors.land2,
    roughness: 0.9,
    side: THREE.DoubleSide,
  }),
  park: new THREE.MeshStandardMaterial({
    color: 0x74b85c,
    roughness: 0.9,
    side: THREE.DoubleSide,
  }),
  parkLight: new THREE.MeshStandardMaterial({
    color: 0x9bcf78,
    roughness: 0.92,
    side: THREE.DoubleSide,
  }),
  parkDark: new THREE.MeshStandardMaterial({
    color: 0x4f9652,
    roughness: 0.95,
    side: THREE.DoubleSide,
  }),
  path: new THREE.MeshStandardMaterial({
    color: 0xd8cfaa,
    roughness: 0.86,
  }),
  pond: new THREE.MeshStandardMaterial({
    color: 0x2f8fb2,
    roughness: 0.46,
    metalness: 0.04,
    side: THREE.DoubleSide,
  }),
  road: new THREE.MeshStandardMaterial({
    color: colors.road,
    roughness: 0.7,
  }),
  street: new THREE.MeshStandardMaterial({
    color: 0x3b4047,
    roughness: 0.75,
  }),
  rail: new THREE.MeshStandardMaterial({
    color: 0xb7c0c6,
    roughness: 0.6,
  }),
  bridge: new THREE.MeshStandardMaterial({
    color: 0xd6c9a8,
    roughness: 0.65,
  }),
  seawall: new THREE.MeshStandardMaterial({
    color: 0xcfc6a8,
    roughness: 0.8,
  }),
  building: new THREE.MeshStandardMaterial({
    color: colors.building,
    roughness: 0.72,
  }),
  roof: new THREE.MeshStandardMaterial({
    color: 0x657071,
    roughness: 0.7,
  }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x8fb4bd,
    roughness: 0.26,
    metalness: 0.1,
    transparent: true,
    opacity: 0.9,
  }),
  landmark: new THREE.MeshStandardMaterial({
    color: 0xcfc8b8,
    roughness: 0.55,
  }),
  copper: new THREE.MeshStandardMaterial({
    color: 0x5fac85,
    roughness: 0.62,
    metalness: 0.04,
  }),
  subway: new THREE.MeshStandardMaterial({
    color: 0x169b62,
    roughness: 0.44,
    emissive: new THREE.Color(0x072b19),
  }),
  ferry: new THREE.MeshStandardMaterial({
    color: 0xf4f1e8,
    roughness: 0.48,
  }),
  plane: new THREE.MeshStandardMaterial({
    color: 0xf0f4f6,
    roughness: 0.4,
  }),
  window: new THREE.MeshStandardMaterial({
    color: 0x36495c,
    roughness: 0.38,
    metalness: 0.08,
    emissive: new THREE.Color(0x07121b),
  }),
  context: new THREE.MeshStandardMaterial({
    color: 0xe8b500,
    roughness: 0.62,
    emissive: new THREE.Color(0x211600),
  }),
};

function project(lat, lng, y = 0) {
  return new THREE.Vector3((lng - CENTER.lng) * SCALE.lng, y, -(lat - CENTER.lat) * SCALE.lat);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function logoPath(item) {
  return `/logos/${item.id}.svg`;
}

function sourceLabel(item) {
  if (item.source === "felt+airtable") return "Airtable matched";
  if (item.source === "user") return "User supplied";
  return "Felt mapped";
}

function areaItems(areaId) {
  if (areaId === "all") return STARTUPS;
  if (areaId === "capital") return CONTEXT_POINTS;
  return STARTUPS.filter((startup) => startup.area === areaId);
}

function stageColor(stage) {
  if (stage === "Public") return colors.yellow;
  if (stage === "Late-Stage") return colors.cyan;
  if (stage === "Early-Stage") return colors.green;
  return colors.accent;
}

function seededRandom(seed) {
  let t = seed + 0x6d2b79f5;
  return function random() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function makeShape(coords, material, y = 0, shadow = false) {
  const shape = new THREE.Shape();
  coords.forEach(([lat, lng], index) => {
    const p = project(lat, lng);
    if (index === 0) shape.moveTo(p.x, p.z);
    else shape.lineTo(p.x, p.z);
  });
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = y;
  mesh.receiveShadow = shadow;
  scene.add(mesh);
  return mesh;
}

function makeTube(coords, radius, material, y = 0.05, segments = 80) {
  const points = coords.map(([lat, lng]) => project(lat, lng, y));
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, segments, radius, 8, false);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return { mesh, points };
}

function makeCurveTube(points, radius, material, segments = 48) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, segments, radius, 8, false);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function createLights() {
  const hemi = new THREE.HemisphereLight(0xdbefff, 0x3c3424, 2.4);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2d6, 3.2);
  sun.position.set(-36, 70, 42);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 180;
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  scene.add(sun);
}

function createShoreline(coords) {
  makeTube([...coords, coords[0]], 0.045, materials.seawall, 0.12, Math.max(48, coords.length * 14));
}

function createPier(lat, lng, width, depth, rotation = 0) {
  const p = project(lat, lng, 0.08);
  const group = new THREE.Group();
  group.position.copy(p);
  group.rotation.y = rotation;

  const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, depth), materials.seawall);
  deck.position.y = 0.1;
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  const postGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.42, 8);
  for (const x of [-width * 0.38, width * 0.38]) {
    for (const z of [-depth * 0.36, depth * 0.36]) {
      const post = new THREE.Mesh(postGeo, materials.bridge);
      post.position.set(x, -0.04, z);
      post.castShadow = true;
      group.add(post);
    }
  }
  scene.add(group);
}

function ellipseCoords(lat, lng, latRadius, lngRadius, steps = 28) {
  return Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2;
    return [lat + Math.sin(angle) * latRadius, lng + Math.cos(angle) * lngRadius];
  });
}

function createBlockAt(lat, lng, width, depth, height, material, rotation = 0, y = 0) {
  const p = project(lat, lng, y);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(p.x, y + height / 2, p.z);
  mesh.rotation.y = rotation;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addLandmarkLabel(name, lat, lng, y = 3) {
  const el = document.createElement("div");
  el.className = "landmark-label";
  el.textContent = name;
  labelsLayer.appendChild(el);
  landmarkLabelElements.push({ el, point: { lat, lng, y } });
}

function createCentralParkDetails() {
  makeShape(ellipseCoords(40.7852, -73.9636, 0.0068, 0.0046, 36), materials.pond, 0.075, true);
  makeShape(ellipseCoords(40.7754, -73.9727, 0.0028, 0.0038, 28), materials.pond, 0.08, true);
  makeShape(ellipseCoords(40.7674, -73.9738, 0.0016, 0.0022, 22), materials.pond, 0.08, true);
  makeShape(
    [
      [40.779, -73.966],
      [40.784, -73.962],
      [40.782, -73.957],
      [40.777, -73.961],
    ],
    materials.parkLight,
    0.082,
    true,
  );
  makeShape(
    [
      [40.769, -73.978],
      [40.774, -73.974],
      [40.772, -73.969],
      [40.767, -73.972],
    ],
    materials.parkDark,
    0.083,
    true,
  );

  const paths = [
    [
      [40.765, -73.973],
      [40.772, -73.969],
      [40.781, -73.963],
      [40.794, -73.954],
      [40.801, -73.949],
    ],
    [
      [40.768, -73.981],
      [40.775, -73.974],
      [40.785, -73.966],
      [40.797, -73.957],
    ],
    [
      [40.771, -73.979],
      [40.773, -73.973],
      [40.776, -73.969],
      [40.778, -73.963],
    ],
  ];
  paths.forEach((path) => makeTube(path, 0.028, materials.path, 0.16, 42));

  const random = seededRandom(930);
  const treeGeo = new THREE.ConeGeometry(0.16, 0.55, 7);
  const treeMesh = new THREE.InstancedMesh(treeGeo, materials.parkDark, 150);
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();
  for (let i = 0; i < 150; i += 1) {
    const lat = 40.766 + random() * 0.034;
    const lng = -73.981 + random() * 0.032;
    const p = project(lat, lng);
    pos.set(p.x, 0.36, p.z);
    quat.setFromAxisAngle(UP, random() * Math.PI);
    scale.setScalar(0.75 + random() * 0.9);
    matrix.compose(pos, quat, scale);
    treeMesh.setMatrixAt(i, matrix);
  }
  treeMesh.castShadow = true;
  scene.add(treeMesh);
}

function createOuterBoroughDetails() {
  const extraParks = [
    [
      [40.697, -74.003],
      [40.704, -73.997],
      [40.705, -73.991],
      [40.696, -73.988],
      [40.692, -73.994],
    ],
    [
      [40.713, -73.972],
      [40.718, -73.967],
      [40.716, -73.963],
      [40.711, -73.968],
    ],
    [
      [40.744, -73.963],
      [40.749, -73.958],
      [40.747, -73.953],
      [40.741, -73.957],
    ],
    [
      [40.692, -74.06],
      [40.718, -74.055],
      [40.713, -74.036],
      [40.693, -74.034],
    ],
  ];
  extraParks.forEach((coords) => makeShape(coords, materials.park, 0.065, true));

  for (let i = 0; i < 18; i += 1) {
    const lat = 40.688 + i * 0.0048;
    makeTube(
      [
        [lat, -74.006],
        [lat + 0.003, -73.956],
        [lat + 0.012, -73.92],
      ],
      0.018,
      materials.street,
      0.14,
      20,
    );
  }
  for (let i = 0; i < 13; i += 1) {
    const lng = -74.0 + i * 0.006;
    makeTube(
      [
        [40.688, lng],
        [40.72, lng + 0.014],
        [40.753, lng + 0.035],
      ],
      0.018,
      materials.street,
      0.14,
      20,
    );
  }
  for (let i = 0; i < 12; i += 1) {
    const lat = 40.705 + i * 0.0065;
    makeTube(
      [
        [lat, -74.052],
        [lat + 0.002, -74.018],
      ],
      0.019,
      materials.street,
      0.14,
      12,
    );
  }
  for (let i = 0; i < 7; i += 1) {
    const lng = -74.055 + i * 0.006;
    makeTube(
      [
        [40.702, lng],
        [40.78, lng + 0.01],
      ],
      0.019,
      materials.street,
      0.14,
      18,
    );
  }

  const towers = [
    [40.744, -73.957, 0.9, 0.8, 8],
    [40.748, -73.94, 0.85, 0.8, 7],
    [40.692, -73.986, 0.8, 0.8, 6],
    [40.706, -74.04, 0.9, 0.9, 8],
    [40.718, -74.035, 0.85, 0.75, 7],
    [40.728, -74.033, 0.75, 0.75, 6],
  ];
  towers.forEach(([lat, lng, w, d, h], index) => {
    createBlockAt(lat, lng, w, d, h, index % 2 ? materials.glass : materials.building, 0.28);
  });

  createPier(40.701, -73.995, 2.5, 0.48, -0.62);
  createPier(40.716, -73.969, 2.1, 0.45, -0.56);
  createPier(40.745, -73.958, 2.4, 0.45, -0.46);
  createPier(40.713, -74.043, 2.8, 0.5, 0.18);
}

function createBaseMap() {
  const waterGeo = new THREE.PlaneGeometry(240, 210, 72, 64);
  const water = new THREE.Mesh(waterGeo, materials.water);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.24;
  water.receiveShadow = true;
  scene.add(water);

  const manhattan = [
      [40.698, -74.021],
      [40.707, -74.016],
      [40.721, -74.012],
      [40.747, -74.006],
      [40.782, -73.987],
      [40.811, -73.957],
      [40.823, -73.938],
      [40.814, -73.928],
      [40.777, -73.953],
      [40.742, -73.974],
      [40.713, -73.991],
      [40.700, -74.006],
    ];
  makeShape(
    manhattan,
    materials.land,
    0,
    true,
  );
  createShoreline(manhattan);

  const brooklynQueens = [
      [40.686, -74.033],
      [40.695, -74.004],
      [40.710, -73.988],
      [40.722, -73.966],
      [40.748, -73.938],
      [40.770, -73.920],
      [40.786, -73.902],
      [40.707, -73.898],
      [40.676, -73.946],
      [40.678, -74.010],
    ];
  makeShape(
    brooklynQueens,
    materials.landAlt,
    0,
    true,
  );
  createShoreline(brooklynQueens);

  const jersey = [
      [40.694, -74.074],
      [40.803, -74.063],
      [40.819, -74.015],
      [40.748, -74.014],
      [40.699, -74.033],
    ];
  makeShape(
    jersey,
    materials.land,
    0,
    true,
  );
  createShoreline(jersey);

  const roosevelt = [
      [40.742, -73.965],
      [40.765, -73.952],
      [40.772, -73.942],
      [40.757, -73.94],
      [40.742, -73.954],
    ];
  makeShape(
    roosevelt,
    materials.land,
    0.02,
    true,
  );
  createShoreline(roosevelt);

  makeShape(
    [
      [40.694, -74.019],
      [40.700, -74.017],
      [40.704, -74.012],
      [40.700, -74.006],
      [40.693, -74.009],
    ],
    materials.park,
    0.03,
    true,
  );

  makeShape(
    [
      [40.768, -73.981],
      [40.800, -73.958],
      [40.797, -73.949],
      [40.764, -73.973],
    ],
    materials.park,
    0.04,
    true,
  );

  const pocketParks = [
    [
      [40.734, -73.992],
      [40.738, -73.988],
      [40.736, -73.984],
      [40.732, -73.988],
    ],
    [
      [40.729, -73.997],
      [40.733, -73.993],
      [40.731, -73.99],
      [40.727, -73.994],
    ],
    [
      [40.711, -74.016],
      [40.714, -74.012],
      [40.711, -74.009],
      [40.708, -74.012],
    ],
    [
      [40.701, -73.991],
      [40.706, -73.986],
      [40.703, -73.982],
      [40.699, -73.987],
    ],
  ];
  pocketParks.forEach((coords) => makeShape(coords, materials.park, 0.05, true));
  createCentralParkDetails();
  createOuterBoroughDetails();

  createPier(40.715, -74.016, 2.6, 0.55, 0.34);
  createPier(40.723, -74.014, 2.1, 0.48, 0.34);
  createPier(40.735, -74.012, 2.4, 0.5, 0.34);
  createPier(40.704, -73.989, 1.9, 0.45, -0.76);
  createPier(40.710, -73.982, 2.2, 0.5, -0.76);
}

function createStreetGrid() {
  const streets = [];
  for (let i = 0; i < 22; i += 1) {
    const lat = 40.704 + i * 0.0036;
    streets.push([
      [lat, -74.014 + i * 0.00042],
      [lat + 0.007, -73.975 + i * 0.00038],
    ]);
  }
  for (let i = 0; i < 9; i += 1) {
    const lng = -74.012 + i * 0.0043;
    streets.push([
      [40.706 + i * 0.001, lng],
      [40.779, lng + 0.029],
    ]);
  }
  for (let i = 0; i < 12; i += 1) {
    const lng = -74.001 + i * 0.0042;
    streets.push([
      [40.690, lng],
      [40.721, lng + 0.018],
    ]);
  }

  streets.forEach((street) => makeTube(street, 0.024, materials.street, 0.145, 14));
}

function createBridgeDetails() {
  const bridges = [
    {
      towers: [
        [40.706, -74.006],
        [40.702, -73.992],
      ],
      spans: [
        [
          [40.706, -74.006],
          [40.704, -74.004],
          [40.702, -73.992],
        ],
        [
          [40.708, -74.01],
          [40.705, -74.004],
          [40.700, -73.985],
        ],
      ],
    },
    {
      towers: [
        [40.716, -74.006],
        [40.706, -73.99],
      ],
      spans: [
        [
          [40.718, -74.01],
          [40.711, -73.997],
          [40.704, -73.986],
        ],
      ],
    },
    {
      towers: [
        [40.756, -73.959],
        [40.758, -73.948],
      ],
      spans: [
        [
          [40.758, -73.966],
          [40.756, -73.959],
          [40.758, -73.948],
          [40.762, -73.936],
        ],
      ],
    },
    {
      towers: [
        [40.713, -73.969],
        [40.718, -73.963],
      ],
      spans: [
        [
          [40.713, -73.979],
          [40.715, -73.971],
          [40.718, -73.963],
          [40.723, -73.954],
        ],
      ],
    },
  ];
  const towerGeo = new THREE.BoxGeometry(0.28, 2.4, 0.28);
  bridges.forEach((bridge) => {
    bridge.towers.forEach(([lat, lng]) => {
      const p = project(lat, lng);
      for (const offset of [-0.28, 0.28]) {
        const tower = new THREE.Mesh(towerGeo, materials.bridge);
        tower.position.set(p.x + offset, 1.32, p.z);
        tower.castShadow = true;
        tower.receiveShadow = true;
        scene.add(tower);
      }
    });

    bridge.spans.forEach((span) => {
      const points = span.map(([lat, lng], index) => {
        const p = project(lat, lng, index === 1 ? 1.78 : 0.78);
        return p;
      });
      makeCurveTube(points, 0.018, materials.bridge, 42);
    });
  });
}

function createSubwayTrainMesh() {
  const group = new THREE.Group();
  const carMaterial = new THREE.MeshStandardMaterial({ color: 0xdfe5e7, roughness: 0.36, metalness: 0.08 });
  const stripeMaterial = materials.subway;
  for (let i = 0; i < 3; i += 1) {
    const car = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.68), carMaterial);
    car.position.z = (i - 1) * 0.74;
    car.position.y = 0.16;
    car.castShadow = true;
    group.add(car);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.56), stripeMaterial);
    stripe.position.set(0, 0.22, (i - 1) * 0.74);
    group.add(stripe);
  }
  group.scale.setScalar(0.78);
  return group;
}

function createSubwayLayer() {
  const sixLine = [
    [40.711, -74.006],
    [40.724, -73.996],
    [40.734, -73.989],
    [40.748, -73.978],
    [40.7546, -73.9716],
    [40.762, -73.967],
    [40.781, -73.951],
  ];
  const { points } = makeTube(sixLine, 0.052, materials.subway, 0.25, 90);

  const stationMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5f7f2,
    roughness: 0.4,
    emissive: new THREE.Color(0x0b2a1d),
  });
  const stations = [
    ["City Hall", 40.713, -74.004],
    ["Astor Place", 40.7301, -73.9911],
    ["Union Sq", 40.7356, -73.9906],
    ["33 St", 40.746, -73.982],
    ["Grand Central", 40.7527, -73.9772],
    ["51 St", 40.7571, -73.9719],
    ["59 St", 40.7626, -73.9679],
  ];
  stations.forEach(([name, lat, lng]) => {
    const p = project(lat, lng, 0.31);
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 22), stationMaterial);
    disk.position.copy(p);
    disk.castShadow = true;
    scene.add(disk);
    if (name === "Grand Central") addLandmarkLabel("Grand Central", lat, lng, 2.7);
  });

  const train = createSubwayTrainMesh();
  scene.add(train);
  subwayFleet.push({ mesh: train, path: points, t: 0.12, speed: 0.018 });
}

function createFerryMesh(accent = 0x2e6cff) {
  const group = new THREE.Group();
  const hullMaterial = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.42 });
  const cabinMaterial = materials.ferry;
  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 1.3), hullMaterial);
  hull.position.y = 0.12;
  hull.castShadow = true;
  group.add(hull);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.6), cabinMaterial);
  cabin.position.y = 0.34;
  cabin.castShadow = true;
  group.add(cabin);

  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.42, 4), hullMaterial);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.z = Math.PI / 4;
  bow.position.set(0, 0.12, 0.82);
  group.add(bow);
  group.scale.setScalar(0.86);
  return group;
}

function createFerries() {
  const routes = [
    {
      color: 0x2e6cff,
      path: [
        [40.695, -74.01],
        [40.704, -74.003],
        [40.716, -73.994],
        [40.731, -73.982],
        [40.748, -73.964],
      ],
    },
    {
      color: 0xffcc4d,
      path: [
        [40.703, -74.028],
        [40.718, -74.022],
        [40.735, -74.014],
        [40.756, -74.008],
      ],
    },
  ];
  routes.forEach((route, index) => {
    const points = route.path.map(([lat, lng]) => project(lat, lng, 0.1));
    const mesh = createFerryMesh(route.color);
    scene.add(mesh);
    ferryFleet.push({ mesh, path: points, t: index * 0.43, speed: 0.013 + index * 0.004, lane: 0 });
  });
}

function createPlaneMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 1.6), materials.plane);
  body.castShadow = true;
  group.add(body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.05, 0.34), materials.plane);
  wing.position.z = -0.08;
  group.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.05, 0.22), materials.plane);
  tail.position.z = -0.66;
  tail.position.y = 0.16;
  group.add(tail);
  group.scale.setScalar(0.9);
  return group;
}

function createPlanes() {
  const flightPaths = [
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
  ];
  flightPaths.forEach((path, index) => {
    const mesh = createPlaneMesh();
    scene.add(mesh);
    planeFleet.push({
      mesh,
      path: path.map(([lat, lng, y]) => project(lat, lng, y)),
      t: index * 0.48,
      speed: 0.01 + index * 0.003,
    });
  });
}

function createRoadsAndRails() {
  const roadRoutes = [
    [
      [40.704, -74.012],
      [40.721, -74.005],
      [40.736, -73.996],
      [40.753, -73.986],
      [40.771, -73.973],
      [40.792, -73.957],
    ],
    [
      [40.709, -74.006],
      [40.726, -73.998],
      [40.743, -73.989],
      [40.764, -73.977],
    ],
    [
      [40.719, -74.01],
      [40.733, -74.006],
      [40.744, -74.001],
      [40.759, -73.993],
    ],
    [
      [40.696, -73.988],
      [40.704, -73.981],
      [40.715, -73.969],
      [40.728, -73.956],
    ],
    [
      [40.704, -74.015],
      [40.706, -74.006],
      [40.708, -73.996],
      [40.715, -73.985],
    ],
  ];

  const roadPaths = roadRoutes.map((route) => makeTube(route, 0.16, materials.road, 0.13, 80));
  createStreetGrid();

  makeTube(
    [
      [40.705, -74.004],
      [40.714, -74.003],
      [40.724, -74.001],
      [40.739, -73.995],
      [40.755, -73.986],
    ],
    0.055,
    materials.rail,
    0.18,
    100,
  );
  makeTube(
    [
      [40.706, -74.011],
      [40.704, -74.004],
      [40.702, -73.995],
      [40.700, -73.985],
    ],
    0.08,
    materials.bridge,
    0.28,
    48,
  );
  makeTube(
    [
      [40.718, -74.01],
      [40.711, -73.997],
      [40.704, -73.986],
    ],
    0.08,
    materials.bridge,
    0.28,
    48,
  );

  createBridgeDetails();

  return roadPaths;
}

function createBuildings() {
  const random = seededRandom(43);
  const instances = [];
  const clusters = [
    { lat: [40.706, 40.757], lng: [-74.011, -73.976], count: 360, h: [0.6, 6.5] },
    { lat: [40.693, 40.722], lng: [-74.004, -73.962], count: 260, h: [0.35, 3.8] },
    { lat: [40.727, 40.768], lng: [-73.974, -73.93], count: 180, h: [0.4, 5.2] },
    { lat: [40.71, 40.775], lng: [-74.058, -74.018], count: 200, h: [0.35, 4.2] },
  ];

  for (const cluster of clusters) {
    for (let i = 0; i < cluster.count; i += 1) {
      const lat = cluster.lat[0] + random() * (cluster.lat[1] - cluster.lat[0]);
      const lng = cluster.lng[0] + random() * (cluster.lng[1] - cluster.lng[0]);
      const p = project(lat, lng);
      const h = cluster.h[0] + random() * (cluster.h[1] - cluster.h[0]);
      const w = 0.35 + random() * 0.9;
      const d = 0.35 + random() * 1.1;
      instances.push({
        x: p.x,
        z: p.z,
        h,
        w,
        d,
        rot: random() * Math.PI,
        shade: random(),
        roof: random(),
      });
    }
  }

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geometry, materials.building, instances.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const facadeA = new THREE.Color(0xe0dccd);
  const facadeB = new THREE.Color(0xaeb8b6);
  const facadeC = new THREE.Color(0xc9b7a0);
  const color = new THREE.Color();

  const roofMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), materials.roof, instances.length);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  let roofCount = 0;

  const windowMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), materials.window, instances.length * 8);
  windowMesh.castShadow = false;
  windowMesh.receiveShadow = true;
  let windowCount = 0;

  instances.forEach((box, index) => {
    pos.set(box.x, box.h / 2, box.z);
    quat.setFromAxisAngle(UP, box.rot);
    scale.set(box.w, box.h, box.d);
    matrix.compose(pos, quat, scale);
    mesh.setMatrixAt(index, matrix);
    color.copy(facadeA).lerp(box.shade > 0.55 ? facadeB : facadeC, Math.min(0.55, box.shade));
    mesh.setColorAt(index, color);

    if (box.roof > 0.5 || box.h > 4.4) {
      pos.set(box.x, box.h + 0.08, box.z);
      scale.set(box.w * (0.46 + box.roof * 0.28), 0.12, box.d * (0.44 + box.roof * 0.26));
      matrix.compose(pos, quat, scale);
      roofMesh.setMatrixAt(roofCount, matrix);
      roofCount += 1;
    }

    if (box.h > 1.7) {
      const floors = Math.min(4, Math.floor(box.h / 1.2));
      const front = new THREE.Vector3(Math.sin(box.rot), 0, Math.cos(box.rot));
      const side = new THREE.Vector3(Math.cos(box.rot), 0, -Math.sin(box.rot));
      for (let floor = 1; floor <= floors; floor += 1) {
        const y = Math.min(box.h - 0.35, floor * (box.h / (floors + 1)));
        pos.set(box.x, y, box.z).addScaledVector(front, box.d / 2 + 0.018);
        scale.set(box.w * 0.72, 0.035, 0.02);
        matrix.compose(pos, quat, scale);
        windowMesh.setMatrixAt(windowCount, matrix);
        windowCount += 1;

        pos.set(box.x, y + 0.1, box.z).addScaledVector(side, box.w / 2 + 0.018);
        scale.set(0.02, 0.035, box.d * 0.7);
        matrix.compose(pos, quat, scale);
        windowMesh.setMatrixAt(windowCount, matrix);
        windowCount += 1;
      }
    }
  });
  scene.add(mesh);
  roofMesh.count = roofCount;
  scene.add(roofMesh);
  windowMesh.count = windowCount;
  scene.add(windowMesh);

  const towerMaterial = new THREE.MeshStandardMaterial({
    color: colors.buildingDark,
    roughness: 0.55,
    metalness: 0.02,
  });
  const towers = [
    { name: "Empire State", lat: 40.7484, lng: -73.9857, h: 14 },
    { name: "One WTC", lat: 40.7127, lng: -74.0134, h: 18 },
    { name: "Vessel", lat: 40.7538, lng: -74.0022, h: 7 },
    { name: "Flatiron", lat: 40.7411, lng: -73.9897, h: 8 },
  ];
  towers.forEach((tower) => {
    const p = project(tower.lat, tower.lng);
    const geo = new THREE.CylinderGeometry(0.55, 0.82, tower.h, 6);
    const meshTower = new THREE.Mesh(geo, towerMaterial);
    meshTower.position.set(p.x, tower.h / 2, p.z);
    meshTower.castShadow = true;
    scene.add(meshTower);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.3, 6), materials.roof);
    cap.position.set(p.x, tower.h + 0.16, p.z);
    cap.castShadow = true;
    scene.add(cap);

    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.9, 8), materials.window);
    spire.position.set(p.x, tower.h + 1.22, p.z);
    spire.castShadow = true;
    scene.add(spire);
  });
}

function createLandmarks() {
  createBlockAt(40.7527, -73.9772, 1.9, 1.15, 1.15, materials.landmark, 0.52);
  const grandCentralDome = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.75, 16, 1, false, 0, Math.PI), materials.landmark);
  const grandCentralPoint = project(40.7527, -73.9772);
  grandCentralDome.rotation.z = Math.PI / 2;
  grandCentralDome.rotation.y = 0.52;
  grandCentralDome.position.set(grandCentralPoint.x, 1.38, grandCentralPoint.z);
  grandCentralDome.castShadow = true;
  scene.add(grandCentralDome);

  createBlockAt(40.7538, -73.9765, 1.55, 0.62, 8.8, materials.glass, 0.52);
  addLandmarkLabel("MetLife", 40.7538, -73.9765, 9.4);

  const chryslerPoint = project(40.7516, -73.9755);
  const chrysler = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.48, 11.4, 12), materials.glass);
  chrysler.position.set(chryslerPoint.x, 5.7, chryslerPoint.z);
  chrysler.castShadow = true;
  scene.add(chrysler);
  const chryslerCrown = new THREE.Mesh(new THREE.ConeGeometry(0.52, 2.6, 12), materials.landmark);
  chryslerCrown.position.set(chryslerPoint.x, 12.7, chryslerPoint.z);
  chryslerCrown.castShadow = true;
  scene.add(chryslerCrown);
  addLandmarkLabel("Chrysler", 40.7516, -73.9755, 14.2);

  const unPoint = project(40.7493, -73.9678);
  const unTower = new THREE.Mesh(new THREE.BoxGeometry(0.62, 6.2, 1.75), materials.glass);
  unTower.position.set(unPoint.x, 3.1, unPoint.z);
  unTower.rotation.y = 0.58;
  unTower.castShadow = true;
  scene.add(unTower);
  addLandmarkLabel("UN", 40.7493, -73.9678, 6.7);

  const libraryPoint = project(40.7532, -73.9822);
  createBlockAt(40.7532, -73.9822, 1.35, 1.1, 1.15, materials.landmark, 0.52);
  const libraryLionGeo = new THREE.BoxGeometry(0.18, 0.16, 0.34);
  [-0.36, 0.36].forEach((offset) => {
    const lion = new THREE.Mesh(libraryLionGeo, materials.landmark);
    lion.position.set(libraryPoint.x + offset, 0.24, libraryPoint.z + 0.68);
    lion.castShadow = true;
    scene.add(lion);
  });
  addLandmarkLabel("NYPL", 40.7532, -73.9822, 1.7);

  const statuePoint = project(40.6892, -74.0445);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 1.3, 8), materials.landmark);
  pedestal.position.set(statuePoint.x, 0.78, statuePoint.z);
  pedestal.castShadow = true;
  scene.add(pedestal);
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.5, 7), materials.copper);
  robe.position.set(statuePoint.x, 2.15, statuePoint.z);
  robe.castShadow = true;
  scene.add(robe);
  const torch = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), materials.copper);
  torch.position.set(statuePoint.x + 0.36, 3.0, statuePoint.z - 0.16);
  torch.castShadow = true;
  scene.add(torch);
  addLandmarkLabel("Liberty", 40.6892, -74.0445, 3.4);

  addLandmarkLabel("Empire State", 40.7484, -73.9857, 15.8);
  addLandmarkLabel("One WTC", 40.7127, -74.0134, 19.8);
  addLandmarkLabel("Flatiron", 40.7411, -73.9897, 9.6);
}

function createMarker(item) {
  const color = stageColor(item.stage);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.36,
    emissive: color.clone().multiplyScalar(0.12),
  });
  const p = project(item.lat, item.lng);
  const group = new THREE.Group();
  group.position.set(p.x, 0.18, p.z);
  group.userData.item = item;

  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 1.05, 10), material);
  pin.position.y = 0.52;
  pin.castShadow = true;
  pin.userData.item = item;
  group.add(pin);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 12), material);
  head.position.y = 1.12;
  head.castShadow = true;
  head.userData.item = item;
  group.add(head);

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.44, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.34, side: THREE.DoubleSide }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.08;
  halo.userData.item = item;
  group.add(halo);

  const hitArea = new THREE.Mesh(
    new THREE.SphereGeometry(0.48, 12, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  hitArea.position.y = 1.05;
  hitArea.userData.item = item;
  hitArea.userData.hitArea = true;
  group.add(hitArea);

  scene.add(group);
  markerMeshes.push(pin, head, halo, hitArea);
  startupMarkers.set(item.id, { group, item, halo });
}

function createContextMarker(item) {
  const color =
    item.category === "VCs / Events"
      ? 0xe8b500
      : item.category === "Higher Education"
        ? 0xd74a3d
        : item.category === "Coworking"
          ? 0x71c97f
          : 0xb9c7cf;
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.48,
    emissive: new THREE.Color(color).multiplyScalar(0.06),
  });
  const p = project(item.lat, item.lng);
  const geometry = item.category === "VCs / Events" ? new THREE.OctahedronGeometry(0.56) : new THREE.BoxGeometry(0.82, 0.82, 0.82);
  const marker = new THREE.Mesh(geometry, material);
  marker.position.set(p.x, 0.72, p.z);
  marker.castShadow = true;
  marker.userData.context = item;
  scene.add(marker);
}

function createMarkers() {
  STARTUPS.forEach(createMarker);
  CONTEXT_POINTS.forEach(createContextMarker);
}

function createCarMesh(color) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.02 });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x9ec6d4,
    roughness: 0.18,
    metalness: 0.04,
    transparent: true,
    opacity: 0.88,
  });
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x171a1f, roughness: 0.72 });
  const lightMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff4c8,
    emissive: new THREE.Color(0xffd56f).multiplyScalar(0.45),
    roughness: 0.3,
  });
  const tailMaterial = new THREE.MeshStandardMaterial({
    color: 0xe13c36,
    emissive: new THREE.Color(0xe13c36).multiplyScalar(0.25),
    roughness: 0.4,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.18, 0.72), bodyMaterial);
  body.position.y = 0.16;
  body.castShadow = true;
  group.add(body);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.24), bodyMaterial);
  hood.position.set(0, 0.22, 0.24);
  hood.castShadow = true;
  group.add(hood);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.18, 0.34), glassMaterial);
  cabin.position.set(0, 0.32, -0.05);
  cabin.castShadow = true;
  group.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.075, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const x of [-0.26, 0.26]) {
    for (const z of [-0.24, 0.24]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMaterial);
      wheel.position.set(x, 0.08, z);
      wheel.castShadow = true;
      group.add(wheel);
    }
  }

  const headLightGeo = new THREE.BoxGeometry(0.08, 0.045, 0.025);
  for (const x of [-0.12, 0.12]) {
    const headlight = new THREE.Mesh(headLightGeo, lightMaterial);
    headlight.position.set(x, 0.17, 0.374);
    group.add(headlight);

    const tail = new THREE.Mesh(headLightGeo, tailMaterial);
    tail.position.set(x, 0.17, -0.374);
    group.add(tail);
  }

  group.scale.setScalar(0.92);
  return group;
}

function createVehicles(roadPaths) {
  const carColors = [0xe54c42, 0x2e6cff, 0xf2c14e, 0x30b37c, 0xf4f1e8];
  const random = seededRandom(700);
  for (let i = 0; i < 34; i += 1) {
    const mesh = createCarMesh(carColors[i % carColors.length]);
    scene.add(mesh);
    const path = roadPaths[i % roadPaths.length].points;
    vehicleFleet.push({
      mesh,
      path,
      t: random(),
      speed: 0.018 + random() * 0.026,
      lane: (random() - 0.5) * 0.32,
    });
  }
}

function samplePath(path, t) {
  const wrapped = ((t % 1) + 1) % 1;
  const scaled = wrapped * (path.length - 1);
  const index = Math.floor(scaled);
  const frac = scaled - index;
  const a = path[index];
  const b = path[Math.min(index + 1, path.length - 1)];
  const point = new THREE.Vector3().lerpVectors(a, b, frac);
  const tangent = new THREE.Vector3().subVectors(b, a).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
  return { point, tangent, normal };
}

function updateVehicles(delta) {
  vehicleFleet.forEach((vehicle) => {
    if (state.trafficLive) vehicle.t += delta * vehicle.speed;
    const { point, tangent, normal } = samplePath(vehicle.path, vehicle.t);
    vehicle.mesh.position.copy(point).addScaledVector(normal, vehicle.lane);
    vehicle.mesh.position.y = 0.24;
    vehicle.mesh.rotation.y = Math.atan2(tangent.x, tangent.z);
  });
}

function updateTransit(delta) {
  subwayFleet.forEach((vehicle) => {
    if (state.trafficLive) vehicle.t += delta * vehicle.speed;
    const { point, tangent } = samplePath(vehicle.path, vehicle.t);
    vehicle.mesh.position.copy(point);
    vehicle.mesh.position.y = 0.36;
    vehicle.mesh.rotation.y = Math.atan2(tangent.x, tangent.z);
  });

  ferryFleet.forEach((vehicle) => {
    if (state.trafficLive) vehicle.t += delta * vehicle.speed;
    const { point, tangent } = samplePath(vehicle.path, vehicle.t);
    vehicle.mesh.position.copy(point);
    vehicle.mesh.position.y = 0.16;
    vehicle.mesh.rotation.y = Math.atan2(tangent.x, tangent.z);
  });

  planeFleet.forEach((vehicle) => {
    if (state.trafficLive) vehicle.t += delta * vehicle.speed;
    const { point, tangent } = samplePath(vehicle.path, vehicle.t);
    vehicle.mesh.position.copy(point);
    vehicle.mesh.rotation.y = Math.atan2(tangent.x, tangent.z);
    vehicle.mesh.rotation.z = Math.sin(vehicle.t * Math.PI * 2) * 0.08;
  });
}

function createClouds() {
  const material = new THREE.MeshStandardMaterial({
    color: 0xf4f1e8,
    roughness: 0.92,
    transparent: true,
    opacity: 0.72,
  });
  const random = seededRandom(12);
  for (let i = 0; i < 8; i += 1) {
    const group = new THREE.Group();
    const parts = 3 + Math.floor(random() * 4);
    for (let j = 0; j < parts; j += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.2 + random() * 1.5, 12, 8), material);
      puff.scale.y = 0.38;
      puff.position.set((random() - 0.5) * 5, (random() - 0.5) * 0.6, (random() - 0.5) * 2);
      group.add(puff);
    }
    group.position.set(-62 + random() * 130, 26 + random() * 12, -70 + random() * 55);
    group.userData.speed = 0.45 + random() * 0.5;
    scene.add(group);
  }
}

function updateClouds(delta) {
  scene.children.forEach((child) => {
    if (!child.userData.speed) return;
    child.position.x += delta * child.userData.speed;
    if (child.position.x > 78) child.position.x = -78;
  });
}

function updateWater(elapsed) {
  void elapsed;
}

function createLabels() {
  STARTUPS.forEach((startup) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "marker-label";
    button.dataset.id = startup.id;
    button.dataset.stage = startup.stage ?? "";
    button.style.setProperty("--label-color", startup.stage === "Public" ? "var(--color-warning)" : startup.stage === "Late-Stage" ? "var(--color-accent-2)" : "var(--color-success)");
    button.innerHTML = `
      <img class="marker-label__logo" src="${escapeHtml(logoPath(startup))}" alt="" loading="lazy" decoding="async">
      <span>${escapeHtml(startup.name)}</span>
      ${startup.stage ? `<small>${escapeHtml(startup.stage.replace("-Stage", ""))}</small>` : ""}
    `;
    button.addEventListener("click", () => selectStartup(startup.id));
    labelsLayer.appendChild(button);
    labelElements.set(startup.id, button);
  });

  CONTEXT_POINTS.filter((point) => point.category !== "Coffee").forEach((point) => {
    const el = document.createElement("div");
    el.className = "context-label";
    el.textContent = point.name;
    labelsLayer.appendChild(el);
    contextLabelElements.push({ el, point });
  });
}

function updateLabels() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const activeItems = new Set(areaItems(state.activeAreaId).map((item) => item.id));
  const activeArea = state.activeAreaId;
  const keyNames = new Set(["Eleven Labs", "Together AI", "Pinecone", "Runway", "Hebbia", "Cohere", "Hugging Face", "Norm AI", "Modal", "Datadog", "Wiz", "Lux Capital"]);

  STARTUPS.forEach((startup) => {
    const marker = startupMarkers.get(startup.id);
    const label = labelElements.get(startup.id);
    if (!marker || !label) return;
    const world = marker.group.position.clone();
    world.y += 1.55;
    const projected = world.project(camera);
    const visibleOnScreen =
      projected.z > -1 &&
      projected.z < 1 &&
      projected.x > -1.08 &&
      projected.x < 1.08 &&
      projected.y > -1.08 &&
      projected.y < 1.08;
    const inArea = activeArea === "all" || activeItems.has(startup.id);
    const isKey = keyNames.has(startup.name) || startup.stage === "Public" || startup.stage === "Late-Stage";
    const showByMode = state.labelsMode === "all" ? inArea : inArea && (isKey || state.selectedId === startup.id);
    label.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
    label.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
    label.classList.toggle("is-hidden", !visibleOnScreen || !showByMode);
    label.classList.toggle("is-muted", activeArea !== "all" && !activeItems.has(startup.id));
    label.classList.toggle("is-selected", state.selectedId === startup.id);
  });

  contextLabelElements.forEach(({ el, point }) => {
    const world = project(point.lat, point.lng, 2.1);
    const projected = world.project(camera);
    const visibleOnScreen =
      projected.z > -1 &&
      projected.z < 1 &&
      projected.x > -1.08 &&
      projected.x < 1.08 &&
      projected.y > -1.08 &&
      projected.y < 1.08;
    const show = state.activeAreaId === "capital" && visibleOnScreen;
    el.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
    el.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
    el.style.opacity = show ? "1" : "0";
  });

  landmarkLabelElements.forEach(({ el, point }) => {
    const world = project(point.lat, point.lng, point.y);
    const projected = world.project(camera);
    const visibleOnScreen =
      projected.z > -1 &&
      projected.z < 1 &&
      projected.x > -1.08 &&
      projected.x < 1.08 &&
      projected.y > -1.08 &&
      projected.y < 1.08;
    const show = visibleOnScreen && (state.activeAreaId === "all" || state.activeAreaId === "capital" || state.labelsMode === "all");
    el.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
    el.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
    el.style.opacity = show ? "1" : "0";
  });
}

function renderAreaList() {
  areaList.innerHTML = "";
  AREAS.forEach((area) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "area-button";
    button.dataset.area = area.id;
    const count = areaItems(area.id).length;
    button.innerHTML = `<span class="area-button__number">${area.number}</span><span class="area-button__label">${escapeHtml(area.label)}</span><span class="area-button__count">${count}</span>`;
    button.addEventListener("click", () => setActiveArea(area.id));
    areaList.appendChild(button);
  });
}

function renderProgressRail() {
  progressRail.innerHTML = "";
  AREAS.forEach((area) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "progress-dot";
    button.dataset.area = area.id;
    button.setAttribute("aria-label", area.label);
    button.addEventListener("click", () => setActiveArea(area.id));
    progressRail.appendChild(button);
  });
}

function miniMapPosition(item) {
  const x = 12 + ((item.lng + 74.028) / 0.082) * 96;
  const y = 10 + ((40.765 - item.lat) / 0.082) * 135;
  return { x: Math.max(5, Math.min(115, x)), y: Math.max(5, Math.min(155, y)) };
}

function renderMiniMap() {
  miniMapPoints.innerHTML = "";
  STARTUPS.forEach((startup) => {
    const point = miniMapPosition(startup);
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", point.x);
    circle.setAttribute("cy", point.y);
    circle.setAttribute("r", startup.stage === "Late-Stage" || startup.stage === "Public" ? "2.4" : "1.6");
    circle.classList.add("mini-point");
    circle.dataset.id = startup.id;
    miniMapPoints.appendChild(circle);
  });
}

function updateUiState() {
  document.querySelectorAll(".area-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.area === state.activeAreaId);
  });
  document.querySelectorAll(".progress-dot").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.area === state.activeAreaId);
  });
  document.querySelectorAll(".mini-point").forEach((point) => {
    const item = STARTUPS.find((startup) => startup.id === point.dataset.id);
    point.classList.toggle("is-active", item?.area === state.activeAreaId || state.activeAreaId === "all");
  });
  labelToggle.querySelector("strong").textContent = state.labelsMode === "all" ? "All" : "Key";
  trafficToggle.querySelector("strong").textContent = state.trafficLive ? "Live" : "Paused";
  trafficToggle.classList.toggle("is-paused", !state.trafficLive);
  tourToggle.querySelector("strong").textContent = state.tourLive ? "Stop" : "Tour";
}

function setActiveArea(areaId, { keepSelection = false } = {}) {
  state.activeAreaId = areaId;
  state.tourIndex = Math.max(0, AREAS.findIndex((area) => area.id === areaId));
  if (!keepSelection) state.selectedId = null;
  const area = AREA_BY_ID[areaId];
  flyTo(area.focus);
  renderAreaDetail(area);
  updateUiState();
}

function selectStartup(id) {
  const startup = STARTUPS.find((item) => item.id === id);
  if (!startup) return;
  state.selectedId = id;
  state.activeAreaId = startup.area;
  flyTo({ lat: startup.lat, lng: startup.lng, distance: 18, height: 16, rotation: 0.72 });
  renderStartupDetail(startup);
  updateUiState();
}

function renderAreaDetail(area) {
  const items = areaItems(area.id);
  const topSectors =
    area.id === "capital"
      ? [...new Set(items.map((item) => item.category))].slice(0, 4)
      : [...new Set(items.map((item) => item.sector).filter(Boolean))].slice(0, 4);
  detailCard.classList.remove("is-hidden");
  detailCard.innerHTML = `
    <p class="detail-card__kicker">${escapeHtml(area.number)} / ${escapeHtml(area.shortLabel)}</p>
    <h2>${escapeHtml(area.label)}</h2>
    <p>${escapeHtml(area.description)}</p>
    <div class="detail-card__meta">
      <span class="detail-chip">${items.length} points</span>
      ${area.tags.map((tag) => `<span class="detail-chip">${escapeHtml(tag)}</span>`).join("")}
      ${topSectors.map((sector) => `<span class="detail-chip">${escapeHtml(sector)}</span>`).join("")}
    </div>
  `;
}

function renderStartupDetail(startup) {
  const url = safeUrl(startup.website);
  const meta = [startup.stage, startup.sector, startup.office, sourceLabel(startup)].filter(Boolean);
  detailCard.classList.remove("is-hidden");
  detailCard.innerHTML = `
    <p class="detail-card__kicker">${escapeHtml(AREA_BY_ID[startup.area]?.shortLabel ?? "Mapped")}</p>
    <div class="detail-card__title">
      <img class="detail-card__logo" src="${escapeHtml(logoPath(startup))}" alt="" loading="lazy" decoding="async">
      <h2>${escapeHtml(startup.name)}</h2>
    </div>
    <p>${escapeHtml(startup.notes || `${startup.sector || "AI company"} point from ${startup.source === "user" ? "the user-supplied address layer" : "Lux's NYC map"}. Click the source links in the top bar for the underlying public data.`)}</p>
    <div class="detail-card__meta">
      ${meta.map((item) => `<span class="detail-chip">${escapeHtml(item)}</span>`).join("")}
    </div>
    ${url ? `<a class="detail-card__link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Open company site</a>` : ""}
  `;
}

function cameraDestination(focus) {
  const target = project(focus.lat, focus.lng, 0.8);
  const rotation = focus.rotation ?? 0.66;
  const distance = focus.distance ?? 40;
  const height = focus.height ?? 28;
  const position = new THREE.Vector3(
    target.x + Math.sin(rotation) * distance,
    height,
    target.z + Math.cos(rotation) * distance,
  );
  return { target, position };
}

function flyTo(focus) {
  const destination = cameraDestination(focus);
  state.flight = {
    startTime: performance.now(),
    duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 120 : 1300,
    fromPos: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPos: destination.position,
    toTarget: destination.target,
  };
}

function updateFlight() {
  if (!state.flight) return;
  const elapsed = performance.now() - state.flight.startTime;
  const raw = Math.min(1, elapsed / state.flight.duration);
  const t = 1 - Math.pow(1 - raw, 3);
  camera.position.lerpVectors(state.flight.fromPos, state.flight.toPos, t);
  controls.target.lerpVectors(state.flight.fromTarget, state.flight.toTarget, t);
  if (raw >= 1) state.flight = null;
}

function updateMarkerScale(time) {
  const activeItems = new Set(areaItems(state.activeAreaId).map((item) => item.id));
  startupMarkers.forEach(({ group, halo, item }) => {
    const active = state.activeAreaId === "all" || activeItems.has(item.id);
    const selected = state.selectedId === item.id;
    const pulse = 1 + Math.sin(time * 3.2 + item.lat) * 0.04;
    const scale = selected ? 1.24 * pulse : active ? 0.92 : 0.58;
    group.scale.setScalar(scale);
    group.children.forEach((child) => {
      if (child.userData.hitArea) {
        child.material.opacity = 0;
        return;
      }
      if (child.material?.opacity !== undefined) {
        child.material.transparent = !active;
        child.material.opacity = active ? 1 : 0.32;
      }
    });
    halo.rotation.z += 0.01;
  });
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(markerMeshes, false);
  const item = hits[0]?.object?.userData?.item;
  hoverCandidate = item || null;
  canvas.style.cursor = item ? "pointer" : "grab";
}

function onPointerDown(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(markerMeshes, false);
  const item = hits[0]?.object?.userData?.item || hoverCandidate;
  if (item) selectStartup(item.id);
}

function renderSearchResults(query) {
  const value = query.trim().toLowerCase();
  if (!value) {
    searchResults.hidden = true;
    searchResults.innerHTML = "";
    return;
  }
  const results = STARTUPS.filter((startup) => {
    const haystack = `${startup.name} ${startup.sector ?? ""} ${startup.stage ?? ""} ${AREA_BY_ID[startup.area]?.label ?? ""}`.toLowerCase();
    return haystack.includes(value);
  }).slice(0, 8);

  if (!results.length) {
    searchResults.hidden = false;
    searchResults.innerHTML = `<button class="search-result" type="button" disabled><strong>No matches</strong><span>Try sector, stage, or company name.</span></button>`;
    return;
  }

  searchResults.hidden = false;
  searchResults.innerHTML = results
    .map(
      (startup) => `
        <button class="search-result" type="button" data-id="${startup.id}">
          <img class="search-result__logo" src="${escapeHtml(logoPath(startup))}" alt="" loading="lazy" decoding="async">
          <span class="search-result__body">
            <strong>${escapeHtml(startup.name)}</strong>
            <span>${escapeHtml(startup.sector || "Mapped startup")} · ${escapeHtml(AREA_BY_ID[startup.area]?.shortLabel ?? "")}</span>
          </span>
        </button>
      `,
    )
    .join("");
}

function bindEvents() {
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);

  searchInput.addEventListener("input", () => renderSearchResults(searchInput.value));
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const first = searchResults.querySelector(".search-result[data-id]");
      if (first) selectStartup(first.dataset.id);
      searchResults.hidden = true;
      searchInput.blur();
    }
    if (event.key === "Escape") {
      searchResults.hidden = true;
      searchInput.blur();
    }
  });

  searchResults.addEventListener("click", (event) => {
    const button = event.target.closest(".search-result[data-id]");
    if (!button) return;
    selectStartup(button.dataset.id);
    searchResults.hidden = true;
    searchInput.value = "";
  });

  window.addEventListener("keydown", (event) => {
    const isSearchShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
    if (isSearchShortcut) {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  labelToggle.addEventListener("click", () => {
    state.labelsMode = state.labelsMode === "all" ? "key" : "all";
    updateUiState();
  });

  trafficToggle.addEventListener("click", () => {
    state.trafficLive = !state.trafficLive;
    updateUiState();
  });

  tourToggle.addEventListener("click", () => {
    state.tourLive = !state.tourLive;
    if (state.tourLive) startTour();
    else stopTour();
    updateUiState();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-wrap")) {
      searchResults.hidden = true;
    }
  });
}

function startTour() {
  stopTour();
  state.tourIndex = Math.max(0, AREAS.findIndex((area) => area.id === state.activeAreaId));
  tourTimer = window.setInterval(() => {
    state.tourIndex = (state.tourIndex + 1) % AREAS.length;
    setActiveArea(AREAS[state.tourIndex].id);
  }, 4200);
}

function stopTour() {
  if (tourTimer) window.clearInterval(tourTimer);
  tourTimer = null;
  state.tourLive = false;
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.04);
  const elapsed = clock.elapsedTime;
  updateFlight();
  updateWater(elapsed);
  updateVehicles(delta);
  updateTransit(delta);
  updateClouds(delta);
  updateMarkerScale(elapsed);
  controls.update();
  renderer.render(scene, camera);
  updateLabels();
  window.requestAnimationFrame(animate);
}

function init() {
  createLights();
  createBaseMap();
  const roadPaths = createRoadsAndRails();
  createSubwayLayer();
  createBuildings();
  createLandmarks();
  createMarkers();
  createVehicles(roadPaths);
  createFerries();
  createPlanes();
  createClouds();
  createLabels();
  renderAreaList();
  renderProgressRail();
  renderMiniMap();
  bindEvents();
  const initial = cameraDestination(AREA_BY_ID.all.focus);
  camera.position.copy(initial.position);
  controls.target.copy(initial.target);
  renderAreaDetail(AREA_BY_ID.all);
  updateUiState();
  animate();
}

init();

window.NYCAIAtlas = {
  startups: STARTUPS.length,
  sources: DATA_SOURCES,
  flyToArea: setActiveArea,
};
