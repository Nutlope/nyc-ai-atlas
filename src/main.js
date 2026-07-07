import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { AREAS, CONTEXT_POINTS, COMPANY_INFO, DATA_SOURCES, STARTUPS } from "./data.js";
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
  pointInPoly,
  inEllipse,
} from "./geo.js";

const CENTER = { lat: 40.7294, lng: -73.9957 };
const SCALE = { lat: 1180, lng: 900 };
const AREA_BY_ID = Object.fromEntries(AREAS.map((area) => [area.id, area]));

const state = {
  activeAreaId: "all",
  selectedId: null,
  labelsMode: window.matchMedia("(max-width: 54rem)").matches ? "key" : "all",
  flight: null,
};

const canvas = document.querySelector("#scene");
const labelsLayer = document.querySelector("#labelsLayer");
const areaList = document.querySelector("#areaList");
const detailCard = document.querySelector("#detailCard");
const miniMapPoints = document.querySelector("#miniMapPoints");
const searchInput = document.querySelector("#companySearch");
const searchResults = document.querySelector("#searchResults");
const searchTrigger = document.querySelector("#searchTrigger");
const searchModal = document.querySelector("#searchModal");
let searchActiveIndex = -1;
const labelToggle = document.querySelector("#labelToggle");
const pinLegend = document.querySelector("#pinLegend");

// Active-area description, moved under the selected row in the rail.
const areaDescEl = document.createElement("p");
areaDescEl.className = "area-desc";

const HORIZON = 0xcfe6f2; // pale sky at the horizon; fog fades toward this

function makeSkyTexture() {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 256;
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#6fa8d6"); // zenith
  grad.addColorStop(0.45, "#9cc7e6");
  grad.addColorStop(0.8, "#cfe6f2"); // horizon
  grad.addColorStop(1, "#e4f0f6");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const scene = new THREE.Scene();
scene.background = makeSkyTexture();
scene.fog = new THREE.FogExp2(HORIZON, 0.0052);

// Phones get a lighter GPU budget: capped pixel ratio and a smaller shadow map.
const smallScreen = window.matchMedia("(max-width: 54rem)").matches;

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, smallScreen ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
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
const labelDims = new Map();
const contextLabelElements = [];
const landmarkLabelElements = [];
const waterSurfaces = [];
const vehicleFleet = [];
const ferryFleet = [];
const planeFleet = [];
const subwayFleet = [];
const birdFleet = [];
let birdMesh = null;
const treeBuffer = []; // { x, z, type: "conifer"|"round", scale, rot, colorIndex }
let hoverCandidate = null;

// Greenery palette: a spread of NYC park greens for per-instance tree color.
const GREEN_PALETTE = [
  0x3d6b39, 0x4a7d45, 0x557f42, 0x5e8a4c, 0x6d9a58, 0x7fa866, 0x4f7237,
].map((c) => new THREE.Color(c));

const colors = {
  accent: new THREE.Color(0x2664ff),
  cyan: new THREE.Color(0x33d6c7),
  green: new THREE.Color(0x32bd7b),
  yellow: new THREE.Color(0xffcc4d),
  red: new THREE.Color(0xe54c42),
  graphite: new THREE.Color(0x19202b),
  land: new THREE.Color(0xd2cec2),
  land2: new THREE.Color(0xc7c2b2),
  road: new THREE.Color(0x2b2f38),
  building: new THREE.Color(0xd9d6ca),
  buildingDark: new THREE.Color(0x8e9899),
};

// Near-white concrete mottle multiplied over the land fills: block-scale
// tonal blotches plus fine speckle, so the ground stops reading as one
// flat sheet of beige. Generated once; zero per-frame cost.
function makeGroundTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 512, 512);
  const rand = seededRandom(4242);
  for (let i = 0; i < 70; i += 1) {
    const r = 36 + rand() * 96;
    const x = rand() * 512;
    const y = rand() * 512;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const warm = rand() > 0.5;
    g.addColorStop(0, warm ? "rgba(150, 138, 116, 0.05)" : "rgba(96, 104, 116, 0.05)");
    g.addColorStop(1, "rgba(120, 120, 120, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 2400; i += 1) {
    ctx.fillStyle = `rgba(72, 78, 88, ${0.012 + rand() * 0.03})`;
    const s = 1 + rand() * 2.4;
    ctx.fillRect(rand() * 512, rand() * 512, s, s);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(0.22, 0.22);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const groundTexture = makeGroundTexture();

const materials = {
  water: new THREE.MeshStandardMaterial({
    color: 0x2e6d92,
    roughness: 0.4,
    metalness: 0.18,
  }),
  land: new THREE.MeshStandardMaterial({
    color: colors.land,
    map: groundTexture,
    roughness: 0.82,
    side: THREE.DoubleSide,
  }),
  landAlt: new THREE.MeshStandardMaterial({
    color: colors.land2,
    map: groundTexture,
    roughness: 0.9,
    side: THREE.DoubleSide,
  }),
  park: new THREE.MeshStandardMaterial({
    color: 0x679c58,
    roughness: 0.9,
    side: THREE.DoubleSide,
  }),
  parkLight: new THREE.MeshStandardMaterial({
    color: 0x86ad6c,
    roughness: 0.92,
    side: THREE.DoubleSide,
  }),
  parkDark: new THREE.MeshStandardMaterial({
    color: 0x4c7847,
    roughness: 0.95,
    side: THREE.DoubleSide,
  }),
  path: new THREE.MeshStandardMaterial({
    color: 0xd8cfaa,
    roughness: 0.86,
  }),
  pond: new THREE.MeshStandardMaterial({
    color: 0x467f9b,
    roughness: 0.46,
    metalness: 0.04,
    side: THREE.DoubleSide,
  }),
  road: new THREE.MeshStandardMaterial({
    color: 0x5b6068,
    roughness: 0.82,
  }),
  street: new THREE.MeshStandardMaterial({
    color: 0x767b82,
    roughness: 0.86,
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
  roofColored: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.74,
  }),
  treeLeaf: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    flatShading: true,
  }),
  treeTrunk: new THREE.MeshStandardMaterial({
    color: 0x6b4f33,
    roughness: 0.9,
  }),
  hill: new THREE.MeshStandardMaterial({
    color: 0x63904f,
    roughness: 0.96,
    flatShading: true,
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
  ghost: new THREE.MeshStandardMaterial({
    color: 0xd8d4c9,
    roughness: 0.95,
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
  const hemi = new THREE.HemisphereLight(0xdbefff, 0x4a4335, 2.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffedc9, 3.45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(smallScreen ? 1024 : 2048, smallScreen ? 1024 : 2048);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 220;
  // The city footprint spans roughly x [-45, 55], z [-110, 45], so the shadow
  // box is recentered on it (the old origin-centered box cut Harlem off).
  // The bias pair removes acne/peter-panning on the box facades.
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.02;
  sun.target.position.set(5, 0, -32);
  sun.position.set(5 - 52, 46, -32 + 40);
  scene.add(sun.target);
  scene.add(sun);

  createSunGlow();
}

// A single additive glow sprite hanging in the sun's direction: gives the
// sky a light source and the haze a reason, for the cost of one sprite.
function createSunGlow() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255, 247, 224, 0.95)");
  g.addColorStop(0.22, "rgba(255, 238, 200, 0.5)");
  g.addColorStop(0.55, "rgba(255, 228, 184, 0.16)");
  g.addColorStop(1, "rgba(255, 228, 184, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  // Same azimuth as the sun light, dropped near the horizon so orbiting
  // cameras actually catch it over the Hudson.
  sprite.position.set(-200, 82, 128);
  sprite.scale.setScalar(170);
  scene.add(sprite);
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

// Queue a tree to be built later in one batched instanced draw.
function addTree(lat, lng, random, { type, scaleBase = 1 } = {}) {
  const p = project(lat, lng);
  treeBuffer.push({
    x: p.x,
    z: p.z,
    type: type || (random() < 0.42 ? "conifer" : "round"),
    scale: scaleBase * (0.62 + random() * 0.7),
    rot: random() * Math.PI,
    colorIndex: Math.floor(random() * GREEN_PALETTE.length),
  });
}

// Fill a polygon with trees at a given target count; optional water exclusion.
function scatterTreesInPoly(poly, count, random, opts = {}) {
  const lats = poly.map((c) => c[0]);
  const lngs = poly.map((c) => c[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  let placed = 0;
  let guard = 0;
  const cap = count * 20;
  while (placed < count && guard < cap) {
    guard += 1;
    const lat = minLat + random() * (maxLat - minLat);
    const lng = minLng + random() * (maxLng - minLng);
    if (!pointInPoly(lat, lng, poly)) continue;
    if (opts.avoidWater && CENTRAL_PARK_FEATURES.some((f) => f.kind === "water" && inEllipse(lat, lng, f))) continue;
    addTree(lat, lng, random, opts);
    placed += 1;
  }
}

// Build every queued tree into three instanced meshes (cones, blobs, trunks).
// Street-tree rows along the avenues New Yorkers would expect them:
// the Park Avenue median plus the Hudson and East River esplanades.
function createStreetTrees() {
  const rows = [
    { from: [40.7365, -73.9885], to: [40.7825, -73.955], step: 0.8 },
    { from: [40.7205, -74.0125], to: [40.7575, -73.9985], step: 0.95 },
    { from: [40.708, -73.996], to: [40.7345, -73.9728], step: 1.05 },
  ];
  const random = seededRandom(9001);
  rows.forEach((row) => {
    const a = project(row.from[0], row.from[1]);
    const b = project(row.to[0], row.to[1]);
    const count = Math.max(2, Math.floor(a.distanceTo(b) / row.step));
    for (let i = 0; i <= count; i += 1) {
      const t = i / count;
      const lat = row.from[0] + (row.to[0] - row.from[0]) * t;
      const lng = row.from[1] + (row.to[1] - row.from[1]) * t;
      if (!pointInPoly(lat, lng, MANHATTAN)) continue;
      if (pointInPoly(lat, lng, CENTRAL_PARK)) continue;
      const p = project(lat, lng);
      treeBuffer.push({
        x: p.x + (random() - 0.5) * 0.16,
        z: p.z + (random() - 0.5) * 0.16,
        type: "round",
        scale: 0.48 + random() * 0.24,
        rot: random() * Math.PI,
        colorIndex: Math.floor(random() * GREEN_PALETTE.length),
      });
    }
  });
}

function buildTrees() {
  if (!treeBuffer.length) return;
  const conifers = treeBuffer.filter((t) => t.type === "conifer");
  const rounds = treeBuffer.filter((t) => t.type === "round");

  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const col = new THREE.Color();

  if (conifers.length) {
    const geo = new THREE.ConeGeometry(0.16, 0.62, 6);
    const mesh = new THREE.InstancedMesh(geo, materials.treeLeaf, conifers.length);
    mesh.castShadow = true;
    conifers.forEach((t, i) => {
      pos.set(t.x, 0.31 * t.scale + 0.05, t.z);
      quat.setFromAxisAngle(UP, t.rot);
      scl.setScalar(t.scale);
      matrix.compose(pos, quat, scl);
      mesh.setMatrixAt(i, matrix);
      col.copy(GREEN_PALETTE[t.colorIndex]);
      mesh.setColorAt(i, col);
    });
    scene.add(mesh);
  }

  if (rounds.length) {
    const leafGeo = new THREE.IcosahedronGeometry(0.24, 0);
    const leafMesh = new THREE.InstancedMesh(leafGeo, materials.treeLeaf, rounds.length);
    leafMesh.castShadow = true;
    const trunkGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.22, 5);
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, materials.treeTrunk, rounds.length);
    trunkMesh.castShadow = true;
    rounds.forEach((t, i) => {
      const trunkH = 0.2 * t.scale;
      pos.set(t.x, trunkH / 2 + 0.05, t.z);
      quat.setFromAxisAngle(UP, 0);
      scl.set(t.scale, t.scale, t.scale);
      matrix.compose(pos, quat, scl);
      trunkMesh.setMatrixAt(i, matrix);

      pos.set(t.x, trunkH + 0.2 * t.scale + 0.05, t.z);
      quat.setFromAxisAngle(UP, t.rot);
      scl.set(t.scale, t.scale * 0.92, t.scale);
      matrix.compose(pos, quat, scl);
      leafMesh.setMatrixAt(i, matrix);
      col.copy(GREEN_PALETTE[t.colorIndex]);
      leafMesh.setColorAt(i, col);
    });
    scene.add(trunkMesh);
    scene.add(leafMesh);
  }
}

// Low-poly faceted grass mound for gentle, rolling terrain.
function createHill(lat, lng, radius, height, tint = 0) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const mat = materials.hill.clone();
  if (tint) mat.color.offsetHSL(0, 0, tint);
  const mesh = new THREE.Mesh(geo, mat);
  const p = project(lat, lng);
  mesh.scale.set(radius, height, radius);
  mesh.position.set(p.x, 0.05, p.z); // equator at the grass plane; cap forms the hill
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function createCentralParkDetails() {
  const random = seededRandom(930);

  // Green base.
  makeShape(CENTRAL_PARK, materials.park, 0.045, true);

  // Rolling hills (Great Hill, the West Side rise, Cedar Hill, etc.).
  const hills = [
    [40.7965, -73.9628, 3.2, 0.5, 0.04],
    [40.7745, -73.9745, 2.8, 0.42, 0.0],
    [40.7805, -73.9705, 3.0, 0.46, -0.03],
    [40.7715, -73.9685, 2.4, 0.36, 0.05],
    [40.7885, -73.9605, 2.6, 0.4, 0.02],
    [40.7672, -73.9762, 2.2, 0.34, 0.03],
  ];
  hills.forEach(([lat, lng, r, h, tint]) => createHill(lat, lng, r, h, tint));

  // Lawns + water sit on the flat ground (the hills are placed away from them).
  CENTRAL_PARK_FEATURES.forEach((f) => {
    const coords = ellipseCoords(f.lat, f.lng, f.rLat, f.rLng, 30);
    if (f.kind === "water") makeShape(coords, materials.pond, 0.085, true);
    else makeShape(coords, materials.parkLight, 0.07, true);
  });

  // Park drive loop.
  makeTube(
    [
      [40.7672, -73.9745],
      [40.772, -73.971],
      [40.7785, -73.9665],
      [40.7855, -73.9615],
      [40.7945, -73.9555],
      [40.7985, -73.9605],
      [40.79, -73.967],
      [40.781, -73.9735],
      [40.7725, -73.9788],
      [40.7685, -73.9805],
      [40.7672, -73.9745],
    ],
    0.02,
    materials.path,
    0.06,
    90,
  );

  // The Mall: a straight allée lined with two rows of big trees.
  const mallA = [40.7685, -73.9735];
  const mallB = [40.7725, -73.9715];
  for (let i = 0; i <= 9; i += 1) {
    const t = i / 9;
    const lat = mallA[0] + (mallB[0] - mallA[0]) * t;
    const lng = mallA[1] + (mallB[1] - mallA[1]) * t;
    addTree(lat - 0.0004, lng - 0.00055, random, { type: "round", scaleBase: 1.25 });
    addTree(lat + 0.0004, lng + 0.00055, random, { type: "round", scaleBase: 1.25 });
  }

  // General canopy across the park (avoid the water bodies).
  scatterTreesInPoly(CENTRAL_PARK, 360, random, { avoidWater: true });

  // Dense woodland in the Ramble and North Woods.
  const ramble = ellipseCoords(40.7775, -73.9695, 0.0026, 0.0032, 12);
  scatterTreesInPoly(ramble, 90, random, { type: "round", scaleBase: 1.1 });
  const northWoods = ellipseCoords(40.7965, -73.9585, 0.003, 0.0028, 12);
  scatterTreesInPoly(northWoods, 80, random, { type: "conifer", scaleBase: 1.15 });
}

function createParks() {
  PARKS.forEach((coords) => makeShape(coords, materials.park, 0.05, true));

  const random = seededRandom(311);
  PARKS.filter((p) => p.length >= 4).forEach((poly) => scatterTreesInPoly(poly, 16, random));
}

function createHarborIslands() {
  HARBOR_ISLANDS.forEach((isle) => {
    const coords = ellipseCoords(isle.lat, isle.lng, isle.rLat, isle.rLng, 24);
    makeShape(coords, materials.landAlt, 0.01, true);
    createShoreline(coords);
    if (isle.name === "Governors Island") {
      makeShape(ellipseCoords(isle.lat, isle.lng, isle.rLat * 0.6, isle.rLng * 0.6, 18), materials.park, 0.05, true);
    }
  });
}

function createBaseMap() {
  const waterGeo = new THREE.PlaneGeometry(260, 230, 80, 72);
  const water = new THREE.Mesh(waterGeo, materials.water);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.18;
  water.receiveShadow = true;
  water.userData.baseZ = waterGeo.attributes.position.array.slice();
  scene.add(water);
  waterSurfaces.push(water);

  makeShape(MANHATTAN, materials.land, 0, true);
  createShoreline(MANHATTAN);

  makeShape(BROOKLYN_QUEENS, materials.landAlt, 0, true);
  createShoreline(BROOKLYN_QUEENS);

  makeShape(JERSEY, materials.land, 0, true);
  createShoreline(JERSEY);

  makeShape(ROOSEVELT_ISLAND, materials.landAlt, 0.01, true);
  createShoreline(ROOSEVELT_ISLAND);

  createHarborIslands();
  createParks();
  createCentralParkDetails();

  // Hudson River piers (Manhattan west side)
  createPier(40.7228, -74.0125, 2.4, 0.5, 0.4);
  createPier(40.7322, -74.0112, 2.4, 0.5, 0.4);
  createPier(40.7425, -74.0098, 2.6, 0.52, 0.4);
  // East River / Seaport piers
  createPier(40.7055, -74.0005, 1.8, 0.42, -0.7);
  createPier(40.7015, -73.9965, 1.8, 0.42, -0.7);
}

// Manhattan's grid is rotated ~29° E of N. Build it in a local frame and clip
// every segment to the island so streets never run out over the water.
const GRID = (() => {
  const theta = (29 * Math.PI) / 180;
  const k = Math.cos((40.75 * Math.PI) / 180); // lng compression
  // unit vectors (in lat/lng degrees) for "uptown" and "crosstown-east"
  const av = { dlat: Math.cos(theta), dlng: Math.sin(theta) / k }; // along avenues
  const st = { dlat: Math.cos(theta + Math.PI / 2), dlng: Math.sin(theta + Math.PI / 2) / k };
  const origin = { lat: 40.7359, lng: -73.9911 }; // Union Square
  return { av, st, origin };
})();

function gridSegments(lines, instanceWidth, material, y) {
  const segs = [];
  for (const pts of lines) {
    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = pts[i];
      const b = pts[i + 1];
      const midLat = (a[0] + b[0]) / 2;
      const midLng = (a[1] + b[1]) / 2;
      if (!pointInPoly(midLat, midLng, MANHATTAN)) continue;
      if (pointInPoly(midLat, midLng, CENTRAL_PARK)) continue;
      segs.push([a, b]);
    }
  }
  if (!segs.length) return;
  const geo = new THREE.BoxGeometry(1, 0.04, 1);
  const mesh = new THREE.InstancedMesh(geo, material, segs.length);
  mesh.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();
  segs.forEach((seg, idx) => {
    const pa = project(seg[0][0], seg[0][1]);
    const pb = project(seg[1][0], seg[1][1]);
    const dx = pb.x - pa.x;
    const dz = pb.z - pa.z;
    const len = Math.hypot(dx, dz) + instanceWidth;
    const angle = Math.atan2(dx, dz);
    pos.set((pa.x + pb.x) / 2, y, (pa.z + pb.z) / 2);
    quat.setFromAxisAngle(UP, angle);
    scale.set(instanceWidth, 1, len);
    matrix.compose(pos, quat, scale);
    mesh.setMatrixAt(idx, matrix);
  });
  scene.add(mesh);
}

function gridLine(centerStepAv, centerStepSt, alongAv, halfLen, count) {
  const { av, st, origin } = GRID;
  const cLat = origin.lat + centerStepAv * av.dlat + centerStepSt * st.dlat;
  const cLng = origin.lng + centerStepAv * av.dlng + centerStepSt * st.dlng;
  const dir = alongAv ? av : st;
  const pts = [];
  for (let s = 0; s <= count; s += 1) {
    const t = -halfLen + (s / count) * (halfLen * 2);
    pts.push([cLat + t * dir.dlat, cLng + t * dir.dlng]);
  }
  return pts;
}

function createStreetGrid() {
  const { av, st } = GRID;
  void av;
  void st;
  // Avenues: long lines along the island axis, spaced crosstown.
  const avenues = [];
  for (let j = -7; j <= 7; j += 1) {
    avenues.push(gridLine(0, j * 0.0026, true, 0.075, 90));
  }
  // Cross streets: spaced uptown, shorter spans.
  const streets = [];
  for (let i = -48; i <= 60; i += 1) {
    streets.push(gridLine(i * 0.00094, 0, false, 0.028, 36));
  }
  gridSegments(streets, 0.036, materials.street, 0.03);
  gridSegments(avenues, 0.085, materials.road, 0.032);
}

function createBridgeDetails() {
  const deckHeight = 0.62;
  const towerHeight = 2.2;
  BRIDGES.forEach((bridge) => {
    // Roadway deck
    const deckPts = bridge.deck.map(([lat, lng]) => project(lat, lng, deckHeight));
    makeCurveTube(deckPts, 0.07, materials.bridge, 60);

    // Towers
    const towerW = bridge.type === "suspension" ? 0.22 : 0.26;
    bridge.towers.forEach(([lat, lng]) => {
      const p = project(lat, lng);
      const tStruct = new THREE.Group();
      for (const offset of [-0.22, 0.22]) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(towerW, towerHeight, towerW),
          materials.bridge,
        );
        leg.position.set(p.x + offset, deckHeight + towerHeight / 2, p.z);
        leg.castShadow = true;
        tStruct.add(leg);
      }
      // Cross beam
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.16, towerW),
        materials.bridge,
      );
      beam.position.set(p.x, deckHeight + towerHeight - 0.2, p.z);
      tStruct.add(beam);
      scene.add(tStruct);
    });

    // Suspension cables: catenary from tower tops sagging to mid-deck
    if (bridge.type === "suspension" && bridge.towers.length === 2) {
      const t0 = bridge.towers[0];
      const t1 = bridge.towers[1];
      const p0 = project(t0[0], t0[1], deckHeight + towerHeight);
      const p1 = project(t1[0], t1[1], deckHeight + towerHeight);
      for (const side of [-0.22, 0.22]) {
        const mid = new THREE.Vector3()
          .addVectors(p0, p1)
          .multiplyScalar(0.5);
        mid.y = deckHeight + 0.5;
        const a = p0.clone();
        const b = p1.clone();
        a.x += side;
        b.x += side;
        mid.x += side;
        makeCurveTube([a, mid, b], 0.015, materials.bridge, 40);
      }
    }
  });
}

function createSubwayTrainMesh(color = 0x169b62) {
  const group = new THREE.Group();
  const carMaterial = new THREE.MeshStandardMaterial({ color: 0xe6eaec, roughness: 0.34, metalness: 0.1 });
  const stripeMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    emissive: new THREE.Color(color).multiplyScalar(0.2),
  });
  for (let i = 0; i < 3; i += 1) {
    const car = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.62), carMaterial);
    car.position.z = (i - 1) * 0.66;
    car.position.y = 0.14;
    car.castShadow = true;
    group.add(car);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.035, 0.5), stripeMaterial);
    stripe.position.set(0, 0.2, (i - 1) * 0.66);
    group.add(stripe);
  }
  group.scale.setScalar(0.7);
  return group;
}

function createSubwayLayer() {
  const stationMaterial = new THREE.MeshStandardMaterial({
    color: 0xf6f7f4,
    roughness: 0.4,
    emissive: new THREE.Color(0x1a1a1a),
  });
  const stationGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.04, 16);

  SUBWAY_LINES.forEach((line, lineIndex) => {
    const lineMaterial = new THREE.MeshStandardMaterial({
      color: line.color,
      roughness: 0.45,
      emissive: new THREE.Color(line.color).multiplyScalar(0.18),
    });
    const y = 0.045 + lineIndex * 0.008; // tiny stagger so overlapping lines don't z-fight
    const { points } = makeTube(line.stops, 0.022, lineMaterial, y, line.stops.length * 12);

    line.stops.forEach(([lat, lng]) => {
      const p = project(lat, lng, y + 0.04);
      const disk = new THREE.Mesh(stationGeo, stationMaterial);
      disk.position.copy(p);
      scene.add(disk);
    });

    // One train per line
    const train = createSubwayTrainMesh(line.color);
    scene.add(train);
    subwayFleet.push({
      mesh: train,
      path: points,
      t: lineIndex * 0.27,
      speed: 0.016 + lineIndex * 0.002,
      y: y + 0.14,
    });
  });

  addLandmarkLabel("Grand Central", 40.7527, -73.9772, 2.7);
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
  ];
  routes.forEach((route, index) => {
    const points = route.path.map(([lat, lng]) => project(lat, lng, 0.1));
    const mesh = createFerryMesh(route.color);
    mesh.add(createWake());
    scene.add(mesh);
    ferryFleet.push({ mesh, path: points, t: index * 0.43, speed: 0.013 + index * 0.004, lane: 0 });
  });
}

// A soft white trail that rides behind each ferry; static texture, no
// per-frame updates, it just travels with its parent.
function createWake() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext("2d");
  // After the plane is laid flat (rotation.x = -PI/2) the canvas bottom edge
  // faces the stern, so the bright end of the trail lives at y = 128.
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.65, "rgba(255,255,255,0.3)");
  grad.addColorStop(1, "rgba(255,255,255,0.75)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 128);
  const tex = new THREE.CanvasTexture(c);
  const wake = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 1.7),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  wake.rotation.x = -Math.PI / 2;
  wake.position.set(0, -0.05, -1.25);
  return wake;
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

  // Hidden smooth paths that the traffic drives along (the visible grid is
  // rendered separately). Kept invisible so cars appear to follow streets.
  const roadPaths = roadRoutes.map((route) => makeTube(route, 0.042, materials.road, 0.05, 80));
  createStreetGrid();
  createBridgeDetails();

  return roadPaths;
}

function buildingAllowed(lat, lng) {
  // Must be on a real landmass...
  const onLand =
    pointInPoly(lat, lng, MANHATTAN) ||
    pointInPoly(lat, lng, BROOKLYN_QUEENS) ||
    pointInPoly(lat, lng, JERSEY) ||
    pointInPoly(lat, lng, ROOSEVELT_ISLAND);
  if (!onLand) return false;
  // ...and not inside a park or Central Park.
  if (pointInPoly(lat, lng, CENTRAL_PARK)) return false;
  for (const park of PARKS) {
    if (pointInPoly(lat, lng, park)) return false;
  }
  return true;
}

// Bake a "street canyon" gradient into a unit box: vertices near the base get
// darker vertex colors, which multiply with per-instance colors for free
// ambient-occlusion-style grounding (no per-frame cost).
function bakeBaseShade(geometry, floor = 0.78) {
  const pos = geometry.attributes.position;
  const shades = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) + 0.5) / 0.45));
    const shade = floor + (1 - floor) * t;
    shades[i * 3] = shade;
    shades[i * 3 + 1] = shade;
    shades[i * 3 + 2] = shade;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(shades, 3));
  return geometry;
}

function createBuildings() {
  const random = seededRandom(43);
  const instances = [];

  // Manhattan buildings live INSIDE street blocks, aligned to the same
  // lattice the visible grid draws. Shared block placement is what makes the
  // city read as a real city instead of scattered boxes.
  const CELL_U = 0.00094; // street-to-street spacing (degree units along av)
  const CELL_V = 0.0026; // avenue-to-avenue spacing (degree units along st)
  const gridOrigin = project(GRID.origin.lat, GRID.origin.lng);
  const uVec = project(
    GRID.origin.lat + GRID.av.dlat * CELL_U,
    GRID.origin.lng + GRID.av.dlng * CELL_U,
  ).sub(gridOrigin); // short block side (street to street)
  const vVec = project(
    GRID.origin.lat + GRID.st.dlat * CELL_V,
    GRID.origin.lng + GRID.st.dlng * CELL_V,
  ).sub(gridOrigin); // long block side (avenue to avenue)
  const uLen = uVec.length();
  const vLen = vVec.length();
  const gridRot = Math.atan2(uVec.x, uVec.z); // building depth spans street-to-street

  const filledCells = new Set();
  DISTRICTS.filter((district) => !district.faded).forEach((district) => {
    const [latMin, latMax, lngMin, lngMax] = district.bbox;
    for (let i = -52; i <= 64; i += 1) {
      for (let j = -8; j <= 8; j += 1) {
        const u = (i + 0.5) * CELL_U;
        const v = (j + 0.5) * CELL_V;
        const lat = GRID.origin.lat + GRID.av.dlat * u + GRID.st.dlat * v;
        const lng = GRID.origin.lng + GRID.av.dlng * u + GRID.st.dlng * v;
        if (lat < latMin || lat > latMax || lng < lngMin || lng > lngMax) continue;
        const key = `${i}:${j}`;
        if (filledCells.has(key)) continue;
        if (!buildingAllowed(lat, lng)) continue;
        filledCells.add(key);
        const center = project(lat, lng);
        // 2-3 lots along the long side of each block; a few stay vacant.
        const lots = random() < 0.3 ? 3 : 2;
        for (let slot = 0; slot < lots; slot += 1) {
          if (random() < 0.09) continue;
          const tall = random() < district.tall;
          const base = district.h[0];
          const span = district.h[1] - district.h[0];
          // Bias toward shorter buildings; only "tall" picks reach the top.
          const h = tall ? base + (0.55 + random() * 0.45) * span : base + Math.pow(random(), 1.7) * span * 0.7;
          const slotT = (slot + 0.5) / lots - 0.5;
          const p = center
            .clone()
            .addScaledVector(vVec, slotT * 0.8)
            .addScaledVector(uVec, (random() - 0.5) * 0.08);
          const grow = tall ? 1.12 : 1;
          const w = Math.min(vLen * 0.42, ((vLen * 0.78) / lots) * (0.68 + random() * 0.24) * grow);
          const d = uLen * (0.5 + random() * 0.15) * grow;
          instances.push({ x: p.x, z: p.z, h, w, d, rot: gridRot, shade: random(), roof: random(), faded: false });
        }
      }
    }
  });

  // Outer boroughs keep loose placement, but each borough shares one street
  // orientation (with a whisper of jitter) and buildings never interpenetrate.
  const boroughRot = {
    "Brooklyn-N": gridRot + 0.9,
    "Brooklyn-S": gridRot + 0.55,
    "LIC/Queens": gridRot + 0.2,
    JerseyCity: gridRot + 0.12,
  };
  DISTRICTS.filter((district) => district.faded).forEach((district) => {
    const [latMin, latMax, lngMin, lngMax] = district.bbox;
    const placedSpots = [];
    let count = 0;
    let guard = 0;
    const cap = district.count * 16;
    while (count < district.count && guard < cap) {
      guard += 1;
      const lat = latMin + random() * (latMax - latMin);
      const lng = lngMin + random() * (lngMax - lngMin);
      if (!buildingAllowed(lat, lng)) continue;
      const p = project(lat, lng);
      const w = 0.34 + random() * 0.6;
      const d = 0.34 + random() * 0.66;
      const r = Math.max(w, d) * 0.72;
      if (
        placedSpots.some(
          (q) => (q.x - p.x) * (q.x - p.x) + (q.z - p.z) * (q.z - p.z) < (q.r + r) * (q.r + r) * 0.62,
        )
      )
        continue;
      placedSpots.push({ x: p.x, z: p.z, r });
      const base = district.h[0];
      const span = district.h[1] - district.h[0];
      const h = base + Math.pow(random(), 1.6) * span;
      instances.push({
        x: p.x,
        z: p.z,
        h,
        w,
        d,
        rot: (boroughRot[district.name] ?? gridRot) + (random() - 0.5) * 0.1,
        shade: random(),
        roof: random(),
        faded: true,
      });
      count += 1;
    }
  });

  // Faded outer-borough buildings render as flat, pale "ghost" blocks.
  const fadedBoxes = instances.filter((b) => b.faded);
  const solidBoxes = instances.filter((b) => !b.faded);
  if (fadedBoxes.length) {
    const ghostGeo = bakeBaseShade(new THREE.BoxGeometry(1, 1, 1), 0.88);
    // Clone: landmark blocks reuse these materials with plain geometry, and
    // vertexColors on a geometry without a color attribute renders black.
    const ghostMaterial = materials.ghost.clone();
    ghostMaterial.vertexColors = true;
    const ghostMesh = new THREE.InstancedMesh(ghostGeo, ghostMaterial, fadedBoxes.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const pp = new THREE.Vector3();
    fadedBoxes.forEach((box, i) => {
      pp.set(box.x, box.h / 2, box.z);
      q.setFromAxisAngle(UP, box.rot);
      s.set(box.w, box.h, box.d);
      m.compose(pp, q, s);
      ghostMesh.setMatrixAt(i, m);
    });
    ghostMesh.renderOrder = 1;
    scene.add(ghostMesh);
  }

  // Solid (Manhattan) buildings keep full detail: palette, roofs, windows.
  instances.length = 0;
  instances.push(...solidBoxes);

  const geometry = bakeBaseShade(new THREE.BoxGeometry(1, 1, 1));
  const buildingMaterial = materials.building.clone();
  buildingMaterial.vertexColors = true;
  const mesh = new THREE.InstancedMesh(geometry, buildingMaterial, instances.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();
  // A small palette of NYC facade tones: warm stone, concrete, brick, glass.
  const palette = [
    new THREE.Color(0xe3ded0), // limestone
    new THREE.Color(0xcfc5af), // sandstone
    new THREE.Color(0xb7b9b3), // concrete
    new THREE.Color(0xb28a70), // brick / terracotta
    new THREE.Color(0xa6b4bf), // cool glass
    new THREE.Color(0xd8d2c4), // pale stone
  ];
  const color = new THREE.Color();
  // Roof tones add pops of color across the otherwise stone city.
  const roofPalette = [
    new THREE.Color(0x646c75), // slate
    new THREE.Color(0x565e66), // dark slate
    new THREE.Color(0x9c6a4e), // terracotta
    new THREE.Color(0x74524a), // oxide red
    new THREE.Color(0x5f6a5a), // weathered green
    new THREE.Color(0x968e7d), // tar/gravel
  ];
  const roofColor = new THREE.Color();

  const roofMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), materials.roofColored, instances.length);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  let roofCount = 0;

  const windowMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), materials.window, instances.length * 8);
  windowMesh.castShadow = false;
  windowMesh.receiveShadow = true;
  let windowCount = 0;

  // Rooftop detail collected during the main pass, instanced afterwards:
  // wedding-cake setback tiers, wooden water tanks, and AC units.
  const tiers = [];
  const tanks = [];
  const acUnits = [];
  const rooftopOffset = new THREE.Vector3();

  instances.forEach((box, index) => {
    pos.set(box.x, box.h / 2, box.z);
    quat.setFromAxisAngle(UP, box.rot);
    scale.set(box.w, box.h, box.d);
    matrix.compose(pos, quat, scale);
    mesh.setMatrixAt(index, matrix);
    // Tall buildings skew glassy/cool; low/mid skew stone & brick.
    let tone;
    if (box.h > 2.4) tone = box.shade < 0.5 ? palette[4] : palette[2];
    else if (box.h > 1.3) tone = palette[[2, 4, 0, 5][Math.floor(box.shade * 4) % 4]];
    else tone = palette[[0, 1, 3, 5][Math.floor(box.shade * 4) % 4]];
    color.copy(tone).offsetHSL(0, 0, (box.shade - 0.5) * 0.06);
    mesh.setColorAt(index, color);

    // Classic NYC setback: taller towers step in for their top section.
    const tiered = box.h > 2.6 && box.roof > 0.35;
    if (tiered) {
      tiers.push({
        x: box.x,
        z: box.z,
        rot: box.rot,
        w: box.w * 0.62,
        d: box.d * 0.62,
        y: box.h,
        h: Math.min(1.6, box.h * 0.28),
        color: color.clone().offsetHSL(0, 0, 0.03),
      });
    }
    const roofTopY = tiered ? box.h + tiers[tiers.length - 1].h : box.h;
    const roofW = tiered ? box.w * 0.62 : box.w;
    const roofD = tiered ? box.d * 0.62 : box.d;

    if (box.roof > 0.5 || box.h > 4.4) {
      pos.set(box.x, roofTopY + 0.08, box.z);
      scale.set(roofW * (0.46 + box.roof * 0.28), 0.12, roofD * (0.44 + box.roof * 0.26));
      matrix.compose(pos, quat, scale);
      roofMesh.setMatrixAt(roofCount, matrix);
      // Mostly muted slate/gravel; ~30% get a warmer terracotta/red/green pop.
      const warm = box.shade > 0.84 && box.h < 2.2;
      roofColor.copy(roofPalette[warm ? 2 + (Math.floor(box.roof * 3) % 3) : box.roof > 0.5 ? 0 : 5]);
      roofMesh.setColorAt(roofCount, roofColor);
      roofCount += 1;
    }

    // Wooden water tanks on a share of the mid-rise stock, AC boxes on most
    // roofs: the two props that make aerial NYC read as NYC.
    if (!tiered && box.h > 1.05 && box.h <= 2.6 && box.roof > 0.58) {
      rooftopOffset.set(box.w * 0.2, 0, box.d * 0.16).applyAxisAngle(UP, box.rot);
      tanks.push({ x: box.x + rooftopOffset.x, z: box.z + rooftopOffset.z, y: box.h, s: 0.8 + box.shade * 0.5 });
    }
    if (box.h > 0.85 && box.shade > 0.42) {
      rooftopOffset.set(-box.w * 0.21, 0, box.d * 0.2).applyAxisAngle(UP, box.rot);
      acUnits.push({ x: box.x + rooftopOffset.x, z: box.z + rooftopOffset.z, y: roofTopY, rot: box.rot });
      if (box.shade > 0.78 && !tiered) {
        rooftopOffset.set(box.w * 0.24, 0, -box.d * 0.18).applyAxisAngle(UP, box.rot);
        acUnits.push({ x: box.x + rooftopOffset.x, z: box.z + rooftopOffset.z, y: box.h, rot: box.rot + 0.5 });
      }
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

  if (tiers.length) {
    const tierMesh = new THREE.InstancedMesh(geometry, buildingMaterial, tiers.length);
    tierMesh.castShadow = true;
    tierMesh.receiveShadow = true;
    tiers.forEach((tier, i) => {
      pos.set(tier.x, tier.y + tier.h / 2, tier.z);
      quat.setFromAxisAngle(UP, tier.rot);
      scale.set(tier.w, tier.h, tier.d);
      matrix.compose(pos, quat, scale);
      tierMesh.setMatrixAt(i, matrix);
      tierMesh.setColorAt(i, tier.color);
    });
    scene.add(tierMesh);
  }

  if (tanks.length) {
    const barrelMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.075, 0.088, 0.17, 8),
      new THREE.MeshStandardMaterial({ color: 0x82603f, roughness: 0.85 }),
      tanks.length,
    );
    const lidMesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.09, 0.075, 8),
      new THREE.MeshStandardMaterial({ color: 0x54402c, roughness: 0.8 }),
      tanks.length,
    );
    barrelMesh.castShadow = true;
    lidMesh.castShadow = true;
    quat.identity();
    tanks.forEach((tank, i) => {
      scale.setScalar(tank.s);
      pos.set(tank.x, tank.y + 0.085 * tank.s, tank.z);
      matrix.compose(pos, quat, scale);
      barrelMesh.setMatrixAt(i, matrix);
      pos.set(tank.x, tank.y + (0.17 + 0.037) * tank.s, tank.z);
      matrix.compose(pos, quat, scale);
      lidMesh.setMatrixAt(i, matrix);
    });
    scene.add(barrelMesh);
    scene.add(lidMesh);
  }

  if (acUnits.length) {
    const acMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.095, 0.05, 0.075),
      new THREE.MeshStandardMaterial({ color: 0xc3c8ce, roughness: 0.7 }),
      acUnits.length,
    );
    acUnits.forEach((unit, i) => {
      pos.set(unit.x, unit.y + 0.025, unit.z);
      quat.setFromAxisAngle(UP, unit.rot);
      scale.setScalar(1);
      matrix.compose(pos, quat, scale);
      acMesh.setMatrixAt(i, matrix);
    });
    scene.add(acMesh);
  }
}

// Helper: a tapered tower with optional setbacks. Returns top Y.
function stackTower(lat, lng, levels, material, rotation = 0) {
  const p = project(lat, lng);
  let y = 0;
  levels.forEach((lvl) => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(lvl.w, lvl.h, lvl.d), lvl.material || material);
    box.position.set(p.x, y + lvl.h / 2, p.z);
    box.rotation.y = rotation;
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);
    y += lvl.h;
  });
  return { p, top: y };
}

function createLandmarks() {
  const stone = materials.landmark;
  const glass = materials.glass;

  // --- Empire State Building: stepped Art-Deco setbacks + antenna ---
  {
    const { p, top } = stackTower(LANDMARKS.empireState.lat, LANDMARKS.empireState.lng, [
      { w: 1.05, h: 0.5, d: 1.25 },
      { w: 0.8, h: 2.4, d: 0.95 },
      { w: 0.5, h: 1.1, d: 0.62 },
    ], stone, 0.5);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.9, 8), materials.window);
    antenna.position.set(p.x, top + 0.45, p.z);
    antenna.castShadow = true;
    scene.add(antenna);
    addLandmarkLabel("Empire State", LANDMARKS.empireState.lat, LANDMARKS.empireState.lng, top + 1.1);
  }

  // --- Chrysler Building: tapered shaft + iconic stepped crown ---
  {
    const cp = project(LANDMARKS.chrysler.lat, LANDMARKS.chrysler.lng);
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.62, 3.0, 0.62), stone);
    shaft.position.set(cp.x, 1.5, cp.z);
    shaft.rotation.y = 0.5;
    shaft.castShadow = true;
    scene.add(shaft);
    // Crown: stack of shrinking discs, then spire
    let cy = 3.0;
    for (let i = 0; i < 4; i += 1) {
      const r = 0.34 - i * 0.07;
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.06, 0.26, 16), materials.copper);
      disc.position.set(cp.x, cy + 0.13, cp.z);
      disc.castShadow = true;
      scene.add(disc);
      cy += 0.26;
    }
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.07, 1.1, 10), materials.window);
    spire.position.set(cp.x, cy + 0.55, cp.z);
    spire.castShadow = true;
    scene.add(spire);
    addLandmarkLabel("Chrysler", LANDMARKS.chrysler.lat, LANDMARKS.chrysler.lng, cy + 1.2);
  }

  // --- One World Trade Center: tapered glass obelisk + spire ---
  {
    const wp = project(LANDMARKS.oneWTC.lat, LANDMARKS.oneWTC.lng);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 4.6, 4), glass);
    tower.position.set(wp.x, 2.3, wp.z);
    tower.rotation.y = Math.PI / 4;
    tower.castShadow = true;
    scene.add(tower);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 1.5, 8), materials.window);
    spire.position.set(wp.x, 4.6 + 0.75, wp.z);
    spire.castShadow = true;
    scene.add(spire);
    addLandmarkLabel("One WTC", LANDMARKS.oneWTC.lat, LANDMARKS.oneWTC.lng, 6.6);
  }

  // --- Flatiron Building: triangular wedge ---
  {
    const fp = project(LANDMARKS.flatiron.lat, LANDMARKS.flatiron.lng);
    const tri = new THREE.Shape();
    tri.moveTo(0, 0.9);
    tri.lineTo(-0.4, -0.5);
    tri.lineTo(0.4, -0.5);
    tri.closePath();
    const geo = new THREE.ExtrudeGeometry(tri, { depth: 1.7, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, stone);
    mesh.position.set(fp.x, 0, fp.z);
    mesh.rotation.y = 0.5;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    addLandmarkLabel("Flatiron", LANDMARKS.flatiron.lat, LANDMARKS.flatiron.lng, 2.1);
  }

  // --- Grand Central + adjacent MetLife slab ---
  {
    createBlockAt(LANDMARKS.grandCentral.lat, LANDMARKS.grandCentral.lng, 1.7, 1.0, 0.7, stone, 0.5);
    const gp = project(LANDMARKS.grandCentral.lat, LANDMARKS.grandCentral.lng);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), stone);
    dome.position.set(gp.x, 0.7, gp.z);
    dome.castShadow = true;
    scene.add(dome);
    createBlockAt(LANDMARKS.metLife.lat, LANDMARKS.metLife.lng, 1.4, 0.6, 3.0, materials.building, 0.5);
    addLandmarkLabel("Grand Central", LANDMARKS.grandCentral.lat, LANDMARKS.grandCentral.lng, 1.4);
  }

  // --- Rockefeller Center (slab) + Times Square sliver ---
  createBlockAt(LANDMARKS.rockefeller.lat, LANDMARKS.rockefeller.lng, 0.7, 1.5, 2.9, materials.building, 0.5);
  addLandmarkLabel("Rockefeller", LANDMARKS.rockefeller.lat, LANDMARKS.rockefeller.lng, 3.2);
  addLandmarkLabel("Times Sq", LANDMARKS.timesSquare.lat, LANDMARKS.timesSquare.lng, 1.4);

  // --- Madison Square Garden (round drum) ---
  {
    const mp = project(LANDMARKS.madisonSquareGarden.lat, LANDMARKS.madisonSquareGarden.lng);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.7, 24), stone);
    drum.position.set(mp.x, 0.35, mp.z);
    drum.castShadow = true;
    scene.add(drum);
  }

  // --- The Vessel (Hudson Yards): copper honeycomb cone ---
  {
    const vp = project(LANDMARKS.vessel.lat, LANDMARKS.vessel.lng);
    const vessel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.28, 0.9, 12, 1, true), materials.copper);
    vessel.position.set(vp.x, 0.45, vp.z);
    vessel.castShadow = true;
    scene.add(vessel);
    createBlockAt(LANDMARKS.hudsonYards.lat, LANDMARKS.hudsonYards.lng, 0.7, 0.7, 2.6, glass, 0.5);
    addLandmarkLabel("Hudson Yards", LANDMARKS.hudsonYards.lat, LANDMARKS.hudsonYards.lng, 3.0);
  }

  // --- UN Secretariat (thin glass slab) ---
  {
    const up = project(LANDMARKS.un.lat, LANDMARKS.un.lng);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.32), glass);
    slab.position.set(up.x, 1.2, up.z);
    slab.castShadow = true;
    scene.add(slab);
    addLandmarkLabel("UN", LANDMARKS.un.lat, LANDMARKS.un.lng, 2.8);
  }

  // --- NY Public Library + Bryant Park edge ---
  createBlockAt(LANDMARKS.bryantLibrary.lat, LANDMARKS.bryantLibrary.lng, 1.2, 0.9, 0.55, stone, 0.5);

  // --- Statue of Liberty ---
  {
    const sp = project(LANDMARKS.statueLiberty.lat, LANDMARKS.statueLiberty.lng);
    const star = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.4, 8), stone);
    star.position.set(sp.x, 0.2, sp.z);
    star.castShadow = true;
    scene.add(star);
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.7, 0.28), stone);
    pedestal.position.set(sp.x, 0.75, sp.z);
    pedestal.castShadow = true;
    scene.add(pedestal);
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.85, 8), materials.copper);
    robe.position.set(sp.x, 1.52, sp.z);
    robe.castShadow = true;
    scene.add(robe);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), materials.copper);
    head.position.set(sp.x, 2.02, sp.z);
    scene.add(head);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 6), materials.copper);
    arm.position.set(sp.x + 0.16, 1.95, sp.z);
    arm.rotation.z = -0.5;
    scene.add(arm);
    const torch = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 8), materials.yellowGlow || materials.copper);
    torch.position.set(sp.x + 0.3, 2.25, sp.z);
    scene.add(torch);
    addLandmarkLabel("Statue of Liberty", LANDMARKS.statueLiberty.lat, LANDMARKS.statueLiberty.lng, 2.6);
  }

  // --- Oculus (WTC transit hub): ribbed white ellipsoid ---
  {
    const op = project(LANDMARKS.oculus.lat, LANDMARKS.oculus.lng);
    const oculus = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 8), stone);
    oculus.scale.set(1.4, 0.34, 0.7);
    oculus.position.set(op.x, 0.18, op.z);
    oculus.rotation.y = 0.5;
    oculus.castShadow = true;
    scene.add(oculus);
  }
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

/* ---------------------------------------------------------------- */
/* Cinematic selection: spotlight beam, pulse rings, focus easing    */
/* ---------------------------------------------------------------- */

const FOG_BASE = scene.fog.density;
const FOG_FOCUS = FOG_BASE * 1.38;
const FOV_BASE = camera.fov;
const FOV_FOCUS = FOV_BASE - 3;
const FOCUS_COLOR = 0x3a6bff;
let fogTarget = FOG_BASE;
let fovTarget = FOV_BASE;
let focusFx = null;

function makeBeamTexture() {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 128;
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 128, 0, 0);
  grad.addColorStop(0, "rgba(255,255,255,0.85)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.26)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
}

function ensureFocusFx() {
  if (focusFx) return focusFx;
  const group = new THREE.Group();
  group.visible = false;

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.4, 7.5, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: FOCUS_COLOR,
      map: makeBeamTexture(),
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  beam.position.y = 3.75;
  group.add(beam);

  // Two expanding ground rings, half a cycle apart, for a continuous pulse.
  const rings = [0, 1].map((i) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.6, 40),
      new THREE.MeshBasicMaterial({
        color: FOCUS_COLOR,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    ring.userData.phase = i * 0.5;
    group.add(ring);
    return ring;
  });

  scene.add(group);
  focusFx = { group, beam, rings };
  return focusFx;
}

function engageFocus(startup) {
  const fx = ensureFocusFx();
  const p = project(startup.lat, startup.lng);
  fx.group.position.set(p.x, 0.05, p.z);
  fx.group.visible = true;
  fogTarget = FOG_FOCUS;
  fovTarget = FOV_FOCUS;
}

function releaseFocus() {
  if (focusFx) focusFx.group.visible = false;
  fogTarget = FOG_BASE;
  fovTarget = FOV_BASE;
}

function updateFocusFx(elapsed, delta) {
  // Ease fog density and FOV toward their targets for a soft push-in.
  scene.fog.density += (fogTarget - scene.fog.density) * Math.min(1, delta * 2.6);
  const fovStep = (fovTarget - camera.fov) * Math.min(1, delta * 3);
  if (Math.abs(fovStep) > 0.0004) {
    camera.fov += fovStep;
    camera.updateProjectionMatrix();
  }

  if (!focusFx || !focusFx.group.visible) return;
  focusFx.beam.material.opacity = 0.42 + Math.sin(elapsed * 2.1) * 0.1;
  focusFx.beam.rotation.y = elapsed * 0.4;
  focusFx.rings.forEach((ring) => {
    const t = (elapsed * 0.62 + ring.userData.phase) % 1;
    const scale = 1 + t * 2.3;
    ring.scale.setScalar(scale);
    ring.material.opacity = 0.5 * (1 - t) * (1 - t);
  });
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
  // Weighted toward taxi yellow: roughly 4 in 10 cars read as NYC cabs.
  const carColors = [0xf7b500, 0xe54c42, 0xf7b500, 0x2e6cff, 0xf7b500, 0x30b37c, 0xf4f1e8, 0xf7b500, 0x3c414b, 0x2e6cff];
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
    vehicle.t += delta * vehicle.speed;
    const { point, tangent, normal } = samplePath(vehicle.path, vehicle.t);
    vehicle.mesh.position.copy(point).addScaledVector(normal, vehicle.lane);
    vehicle.mesh.position.y = 0.24;
    vehicle.mesh.rotation.y = Math.atan2(tangent.x, tangent.z);
  });
}

function updateTransit(delta) {
  subwayFleet.forEach((vehicle) => {
    vehicle.t += delta * vehicle.speed;
    const { point, tangent } = samplePath(vehicle.path, vehicle.t);
    vehicle.mesh.position.copy(point);
    vehicle.mesh.position.y = vehicle.y ?? 0.36;
    vehicle.mesh.rotation.y = Math.atan2(tangent.x, tangent.z);
  });

  ferryFleet.forEach((vehicle) => {
    vehicle.t += delta * vehicle.speed;
    const { point, tangent } = samplePath(vehicle.path, vehicle.t);
    vehicle.mesh.position.copy(point);
    vehicle.mesh.position.y = 0.16;
    vehicle.mesh.rotation.y = Math.atan2(tangent.x, tangent.z);
  });

  planeFleet.forEach((vehicle) => {
    vehicle.t += delta * vehicle.speed;
    const { point, tangent } = samplePath(vehicle.path, vehicle.t);
    vehicle.mesh.position.copy(point);
    vehicle.mesh.rotation.y = Math.atan2(tangent.x, tangent.z);
    vehicle.mesh.rotation.z = Math.sin(vehicle.t * Math.PI * 2) * 0.08;
  });
}

// A dozen gulls circling the parks and the harbor: one instanced chevron
// mesh, one draw call, a handful of matrix updates per frame.
function createBirds() {
  const wing = new Float32Array([
    // left wing
    0, 0, 0.16, -0.5, 0.12, -0.12, -0.05, 0, -0.06,
    // right wing
    0, 0, 0.16, 0.05, 0, -0.06, 0.5, 0.12, -0.12,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(wing, 3));
  const material = new THREE.MeshBasicMaterial({ color: 0x2b3038, side: THREE.DoubleSide });

  const flocks = [
    { lat: 40.781, lng: -73.9665, alt: 6.4, radius: 4.6, count: 5 }, // Central Park
    { lat: 40.696, lng: -74.021, alt: 4.6, radius: 5.2, count: 4 }, // the harbor
    { lat: 40.7003, lng: -73.9955, alt: 5.2, radius: 3.4, count: 3 }, // Brooklyn Bridge
  ];
  const random = seededRandom(77);
  flocks.forEach((flock) => {
    const center = project(flock.lat, flock.lng, flock.alt);
    for (let i = 0; i < flock.count; i += 1) {
      birdFleet.push({
        center,
        radius: flock.radius * (0.72 + random() * 0.5),
        alt: flock.alt + (random() - 0.5) * 1.6,
        speed: (0.24 + random() * 0.2) * (random() < 0.5 ? 1 : -1),
        phase: random() * Math.PI * 2,
        flapHz: 5 + random() * 2.5,
        size: 0.44 + random() * 0.22,
      });
    }
  });

  birdMesh = new THREE.InstancedMesh(geo, material, birdFleet.length);
  birdMesh.frustumCulled = false;
  scene.add(birdMesh);
}

const birdMatrix = new THREE.Matrix4();
const birdQuat = new THREE.Quaternion();
const birdEuler = new THREE.Euler();
const birdPos = new THREE.Vector3();
const birdScale = new THREE.Vector3();

function updateBirds(elapsed) {
  if (!birdMesh) return;
  birdFleet.forEach((bird, i) => {
    const dir = Math.sign(bird.speed);
    const theta = bird.phase + elapsed * Math.abs(bird.speed) * dir;
    birdPos.set(
      bird.center.x + Math.cos(theta) * bird.radius,
      bird.alt + Math.sin(elapsed * 1.1 + bird.phase) * 0.5,
      bird.center.z + Math.sin(theta) * bird.radius,
    );
    // Face along the circle's tangent, banked gently into the turn.
    const heading = Math.atan2(-Math.sin(theta) * dir, Math.cos(theta) * dir) + Math.PI / 2;
    birdEuler.set(0, heading, 0.3 * dir, "YXZ");
    birdQuat.setFromEuler(birdEuler);
    // Wing flap: squash/stretch the chevron height.
    const flap = 0.25 + Math.abs(Math.sin(elapsed * bird.flapHz + bird.phase)) * 1.35;
    birdScale.set(bird.size, bird.size * flap, bird.size);
    birdMatrix.compose(birdPos, birdQuat, birdScale);
    birdMesh.setMatrixAt(i, birdMatrix);
  });
  birdMesh.instanceMatrix.needsUpdate = true;
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
  for (const water of waterSurfaces) {
    const geo = water.geometry;
    const pos = geo.attributes.position;
    const base = water.userData.baseZ;
    if (!base) continue;
    for (let i = 0; i < pos.count; i += 1) {
      const ix = i * 3;
      const x = base[ix];
      const y = base[ix + 1];
      const wave =
        Math.sin(x * 0.18 + elapsed * 0.6) * 0.08 +
        Math.cos(y * 0.22 - elapsed * 0.45) * 0.06;
      pos.array[ix + 2] = base[ix + 2] + wave;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }
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
      <img class="marker-label__logo" src="${escapeHtml(logoPath(startup))}" alt="" loading="lazy" decoding="async" draggable="false">
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

  // Phase 1: figure out which labels are visible and where their pins land.
  const candidates = [];
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
    const selected = state.selectedId === startup.id;

    label.classList.toggle("is-muted", activeArea !== "all" && !activeItems.has(startup.id));
    label.classList.toggle("is-dimmed", Boolean(state.selectedId) && !selected);
    label.classList.toggle("is-selected", selected);

    const show = visibleOnScreen && showByMode;
    if (!show) {
      label.classList.add("is-hidden");
      label.classList.remove("has-leader");
      return;
    }

    const ax = (projected.x * 0.5 + 0.5) * width;
    const ay = (-projected.y * 0.5 + 0.5) * height;
    let w = labelDims.get(startup.id)?.w;
    let h = labelDims.get(startup.id)?.h;
    if (!w) {
      w = label.offsetWidth || 120;
      h = label.offsetHeight || 28;
      labelDims.set(startup.id, { w, h });
    }
    candidates.push({
      label,
      ax,
      ay,
      w,
      h,
      depth: projected.z,
      priority: selected ? 3 : isKey ? 2 : 1,
    });
  });

  // Phase 2: greedy declutter. Higher priority places first; later labels that
  // collide get pushed straight up, with a leader line back down to their pin.
  candidates.sort((a, b) => b.priority - a.priority || a.ay - b.ay);
  const placed = [];
  const PAD = 3;
  const STEP = 5;
  const MAX_SHIFT = 150;
  candidates.forEach((c) => {
    let shift = 0;
    const rectAt = (s) => ({
      left: c.ax - c.w / 2 - PAD,
      right: c.ax + c.w / 2 + PAD,
      top: c.ay - s - 1.1 * c.h - PAD,
      bottom: c.ay - s - 0.1 * c.h + PAD,
    });
    const hits = (r) =>
      placed.some(
        (p) => r.left < p.right && r.right > p.left && r.top < p.bottom && r.bottom > p.top,
      );
    let rect = rectAt(shift);
    while (hits(rect) && shift < MAX_SHIFT) {
      shift += STEP;
      rect = rectAt(shift);
    }
    // Lowest-priority labels that still can't fit step aside (hidden) to keep it tidy.
    if (hits(rect) && c.priority === 1) {
      c.label.classList.add("is-hidden");
      c.label.classList.remove("has-leader");
      return;
    }
    placed.push(rect);
    c.label.classList.remove("is-hidden");
    c.label.style.left = `${c.ax}px`;
    c.label.style.top = `${c.ay - shift}px`;
    c.label.style.setProperty("--leader", `${shift + 4}px`);
    c.label.classList.toggle("has-leader", shift > 6);
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

// Static legend explaining the stage colors used by pins and label tags.
function renderPinLegend() {
  const entries = [
    { label: "Early", css: "var(--color-success)" },
    { label: "Late", css: "var(--color-accent-2)" },
    { label: "Public", css: "var(--color-warning)" },
  ];
  pinLegend.innerHTML = entries
    .map(
      (entry) =>
        `<span class="pin-legend__item"><i style="background:${entry.css}"></i>${escapeHtml(entry.label)}</span>`,
    )
    .join("");
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
  document.querySelectorAll(".mini-point").forEach((point) => {
    const item = STARTUPS.find((startup) => startup.id === point.dataset.id);
    point.classList.toggle("is-active", item?.area === state.activeAreaId || state.activeAreaId === "all");
  });
  labelToggle.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === state.labelsMode);
  });
  document.body.classList.toggle("is-focused", Boolean(state.selectedId));

  // Slide the active area's description in right below its row.
  const activeButton = areaList.querySelector(`.area-button[data-area="${state.activeAreaId}"]`);
  const area = AREA_BY_ID[state.activeAreaId];
  if (activeButton && area) {
    areaDescEl.textContent = area.description;
    activeButton.insertAdjacentElement("afterend", areaDescEl);
  } else {
    areaDescEl.remove();
  }
}

/* ---------------------------------------------------------------- */
/* Deep links: #/company/:id and #/area/:id, with back/forward       */
/* ---------------------------------------------------------------- */

const BASE_TITLE = "NYC AI Atlas";
let suppressHashEvent = false;

function writeHash(hash) {
  if (location.hash === hash) return;
  suppressHashEvent = true;
  location.hash = hash;
}

function shareUrl(hash) {
  return `${location.origin}${location.pathname}${hash}`;
}

function applyHashFromLocation() {
  const hash = location.hash || "#/";
  const company = hash.match(/^#\/company\/([\w-]+)$/);
  if (company && STARTUPS.some((s) => s.id === company[1])) {
    selectStartup(company[1]);
    return;
  }
  const area = hash.match(/^#\/area\/([\w-]+)$/);
  if (area && AREA_BY_ID[area[1]]) {
    setActiveArea(area[1]);
    return;
  }
  if (hash === "#/" || hash === "#") setActiveArea("all");
}

function setActiveArea(areaId, { keepSelection = false } = {}) {
  state.activeAreaId = areaId;
  if (!keepSelection) {
    state.selectedId = null;
    releaseFocus();
  }
  const area = AREA_BY_ID[areaId];
  flyTo(area.focus);
  renderAreaDetail(area);
  updateUiState();
  if (!keepSelection) {
    writeHash(areaId === "all" ? "#/" : `#/area/${areaId}`);
    document.title = areaId === "all" ? BASE_TITLE : `${area.label} · ${BASE_TITLE}`;
  }
}

function selectStartup(id) {
  const startup = STARTUPS.find((item) => item.id === id);
  if (!startup) return;
  state.selectedId = id;
  state.activeAreaId = startup.area;
  flyTo({ lat: startup.lat, lng: startup.lng, distance: 18, height: 16, rotation: 0.72 }, { cinematic: true });
  engageFocus(startup);
  renderStartupDetail(startup);
  updateUiState();
  writeHash(`#/company/${id}`);
  document.title = `${startup.name} · ${BASE_TITLE}`;
}

function renderAreaDetail() {
  // Area context lives inline in the rail now; the floating card is for companies only.
  detailCard.classList.add("is-hidden");
}

function renderStartupDetail(startup) {
  const url = safeUrl(startup.website);
  const info = COMPANY_INFO[startup.id] || {};
  const blurb =
    info.blurb ||
    startup.notes ||
    `${startup.sector || "An AI company"} on the New York City map.`;
  const loc = info.loc || AREA_BY_ID[startup.area]?.shortLabel || "New York City";

  let host = "";
  if (url) {
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      host = "";
    }
  }

  const meta = [startup.stage ? startup.stage.replace("-Stage", " stage") : null, startup.office, loc]
    .filter(Boolean)
    .join(" · ");
  // Optional enrichment fields; rendered only when the data actually has them.
  const facts = [
    startup.founded ? `Founded ${startup.founded}` : null,
    startup.team ? `~${startup.team} people` : null,
    startup.raised ? `Raised ${startup.raised}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const jobsUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(startup.name)}&location=New%20York`;

  detailCard.classList.remove("is-hidden");
  detailCard.innerHTML = `
    <button class="detail-card__close" type="button" aria-label="Close">&times;</button>
    <div class="detail-card__head">
      <img class="detail-card__logo" src="${escapeHtml(logoPath(startup))}" alt="" loading="lazy" decoding="async" draggable="false">
      <div class="detail-card__heading">
        <h2>${escapeHtml(startup.name)}</h2>
        ${startup.sector && startup.sector !== "Mapped startup" ? `<p class="detail-card__sector">${escapeHtml(startup.sector)}</p>` : ""}
      </div>
    </div>
    <p class="detail-card__blurb">${escapeHtml(blurb)}</p>
    ${meta ? `<p class="detail-card__meta">${escapeHtml(meta)}</p>` : ""}
    ${facts ? `<p class="detail-card__meta">${escapeHtml(facts)}</p>` : ""}
    <div class="detail-card__actions">
      ${url ? `<a class="detail-card__link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(host || "Visit website")} ↗</a>` : ""}
      <a class="detail-card__ghost" href="${escapeHtml(jobsUrl)}" target="_blank" rel="noreferrer">Jobs ↗</a>
      <button class="detail-card__ghost" type="button" data-copy>Copy link</button>
    </div>
  `;
  const closeBtn = detailCard.querySelector(".detail-card__close");
  if (closeBtn) closeBtn.addEventListener("click", () => clearSelection());
  const copyBtn = detailCard.querySelector("[data-copy]");
  if (copyBtn)
    copyBtn.addEventListener("click", async () => {
      copyBtn.textContent = (await copyText(shareUrl(`#/company/${startup.id}`))) ? "Copied" : "Copy failed";
      setTimeout(() => {
        copyBtn.textContent = "Copy link";
      }, 1400);
    });
}

// Clipboard API first, hidden-textarea execCommand as the fallback.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

function clearSelection() {
  state.selectedId = null;
  releaseFocus();
  const area = AREA_BY_ID[state.activeAreaId] || AREA_BY_ID.all;
  renderAreaDetail(area);
  updateUiState();
  writeHash(area.id === "all" ? "#/" : `#/area/${area.id}`);
  document.title = area.id === "all" ? BASE_TITLE : `${area.label} · ${BASE_TITLE}`;
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

function flyTo(focus, { cinematic = false } = {}) {
  const destination = cameraDestination(focus);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const flight = {
    startTime: performance.now(),
    duration: reduced ? 120 : cinematic ? 1900 : 1300,
    fromPos: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPos: destination.position,
    toTarget: destination.target,
  };

  // Startup selections dolly along a lift -> arc -> settle curve instead of a
  // straight lerp, so flying across the city reads like a camera move.
  if (cinematic && !reduced) {
    const from = flight.fromPos.clone();
    const to = flight.toPos.clone();
    const dist = from.distanceTo(to);
    const lift = Math.min(30, 8 + dist * 0.34);
    const mid1 = from.clone().lerp(to, 0.28);
    mid1.y = Math.max(from.y, to.y) + lift;
    const mid2 = from.clone().lerp(to, 0.8);
    mid2.y = to.y + lift * 0.42;
    flight.path = new THREE.CatmullRomCurve3([from, mid1, mid2, to], false, "centripetal");
  }
  state.flight = flight;
}

function updateFlight() {
  if (!state.flight) return;
  const elapsed = performance.now() - state.flight.startTime;
  const raw = Math.min(1, elapsed / state.flight.duration);
  const t = 1 - Math.pow(1 - raw, 3);
  if (state.flight.path) camera.position.copy(state.flight.path.getPointAt(t));
  else camera.position.lerpVectors(state.flight.fromPos, state.flight.toPos, t);
  controls.target.lerpVectors(state.flight.fromTarget, state.flight.toTarget, t);
  if (raw >= 1) state.flight = null;
}

function updateMarkerScale(time) {
  const activeItems = new Set(areaItems(state.activeAreaId).map((item) => item.id));
  const hasSelection = Boolean(state.selectedId);
  startupMarkers.forEach(({ group, halo, item }) => {
    const active = state.activeAreaId === "all" || activeItems.has(item.id);
    const selected = state.selectedId === item.id;
    const pulse = 1 + Math.sin(time * 3.2 + item.lat) * 0.04;
    const scale = selected ? 1.24 * pulse : active ? (hasSelection ? 0.8 : 0.92) : 0.58;
    group.scale.setScalar(scale);
    // With a company in focus, every other pin steps back into the haze.
    const targetOpacity = selected ? 1 : active ? (hasSelection ? 0.45 : 1) : hasSelection ? 0.18 : 0.32;
    group.children.forEach((child) => {
      if (child.userData.hitArea) {
        child.material.opacity = 0;
        return;
      }
      if (child.material?.opacity !== undefined) {
        child.material.transparent = targetOpacity < 1;
        child.material.opacity = targetOpacity;
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
  searchActiveIndex = -1;

  // No query: show a few suggested companies so the modal is never empty.
  let results;
  if (!value) {
    const featured = ["Together AI", "Runway", "Cohere", "Hugging Face", "Cognition", "Hebbia"];
    results = featured
      .map((name) => STARTUPS.find((s) => s.name === name))
      .filter(Boolean)
      .slice(0, 6);
  } else {
    results = STARTUPS.filter((startup) => {
      const info = COMPANY_INFO[startup.id] || {};
      const haystack =
        `${startup.name} ${startup.sector ?? ""} ${startup.stage ?? ""} ${AREA_BY_ID[startup.area]?.label ?? ""} ${info.loc ?? ""} ${info.blurb ?? ""}`.toLowerCase();
      return haystack.includes(value);
    }).slice(0, 8);
  }

  if (!results.length) {
    searchResults.innerHTML = `<div class="search-result" aria-disabled="true"><span class="search-result__body"><strong>No matches</strong><span>Try a company name, sector, stage, or neighborhood.</span></span></div>`;
    return;
  }

  searchResults.innerHTML = results
    .map((startup) => {
      const info = COMPANY_INFO[startup.id] || {};
      const sub = [startup.sector && startup.sector !== "Mapped startup" ? startup.sector : null, info.loc]
        .filter(Boolean)
        .join(" · ");
      return `
        <button class="search-result" type="button" role="option" data-id="${startup.id}">
          <img class="search-result__logo" src="${escapeHtml(logoPath(startup))}" alt="" loading="lazy" decoding="async">
          <span class="search-result__body">
            <strong>${escapeHtml(startup.name)}</strong>
            <span>${escapeHtml(sub || "AI startup")}</span>
          </span>
        </button>
      `;
    })
    .join("");
}

function searchResultButtons() {
  return [...searchResults.querySelectorAll(".search-result[data-id]")];
}

function setSearchActive(index) {
  const buttons = searchResultButtons();
  if (!buttons.length) return;
  searchActiveIndex = (index + buttons.length) % buttons.length;
  buttons.forEach((b, i) => b.classList.toggle("is-active", i === searchActiveIndex));
  buttons[searchActiveIndex].scrollIntoView({ block: "nearest" });
}

function openSearch() {
  if (searchModal.open) return;
  searchInput.value = "";
  renderSearchResults("");
  searchModal.showModal();
  requestAnimationFrame(() => searchInput.focus());
}

function closeSearch() {
  if (searchModal.open) searchModal.close();
}

function bindEvents() {
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);

  searchTrigger.addEventListener("click", openSearch);

  searchInput.addEventListener("input", () => renderSearchResults(searchInput.value));
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSearchActive(searchActiveIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSearchActive(searchActiveIndex - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const buttons = searchResultButtons();
      const choice = buttons[searchActiveIndex] || buttons[0];
      if (choice) {
        selectStartup(choice.dataset.id);
        closeSearch();
      }
    }
  });

  searchResults.addEventListener("click", (event) => {
    const button = event.target.closest(".search-result[data-id]");
    if (!button) return;
    selectStartup(button.dataset.id);
    closeSearch();
  });

  // Click on the backdrop (outside the content) closes the dialog.
  searchModal.addEventListener("click", (event) => {
    if (event.target === searchModal) closeSearch();
  });

  window.addEventListener("keydown", (event) => {
    const isSearchShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
    if (isSearchShortcut) {
      event.preventDefault();
      if (searchModal.open) closeSearch();
      else openSearch();
      return;
    }

    // Don't hijack typing or the open search dialog.
    if (searchModal.open) return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    // ↑ / ↓ step through neighborhoods.
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const current = Math.max(0, AREAS.findIndex((a) => a.id === state.activeAreaId));
      const next = event.key === "ArrowDown" ? current + 1 : current - 1;
      const clamped = Math.min(AREAS.length - 1, Math.max(0, next));
      if (clamped !== current) setActiveArea(AREAS[clamped].id);
    }
  });

  const brand = document.querySelector(".brand");
  if (brand)
    brand.addEventListener("click", (event) => {
      event.preventDefault();
      setActiveArea("all");
    });

  // Browser back/forward re-applies the hash route.
  window.addEventListener("hashchange", () => {
    if (suppressHashEvent) {
      suppressHashEvent = false;
      return;
    }
    applyHashFromLocation();
  });

  labelToggle.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mode]");
    if (!button) return;
    state.labelsMode = button.dataset.mode;
    updateUiState();
  });

}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.04);
  const elapsed = clock.elapsedTime;
  updateFlight();
  updateWater(elapsed);
  updateVehicles(delta);
  updateTransit(delta);
  updateClouds(delta);
  updateBirds(elapsed);
  updateMarkerScale(elapsed);
  updateFocusFx(elapsed, delta);
  controls.update();
  renderer.render(scene, camera);
  updateLabels();
  window.requestAnimationFrame(animate);
}

function init() {
  createLights();
  createBaseMap();
  createStreetTrees();
  buildTrees();
  const roadPaths = createRoadsAndRails();
  createSubwayLayer();
  createBuildings();
  createLandmarks();
  createMarkers();
  createVehicles(roadPaths);
  createFerries();
  createPlanes();
  createClouds();
  createBirds();
  createLabels();
  renderAreaList();
  renderMiniMap();
  renderPinLegend();
  bindEvents();
  // Label sizes are cached for the declutter pass; re-measure once the pixel font lands.
  if (document.fonts?.ready) document.fonts.ready.then(() => labelDims.clear());
  const initial = cameraDestination(AREA_BY_ID.all.focus);
  camera.position.copy(initial.position);
  controls.target.copy(initial.target);
  renderAreaDetail(AREA_BY_ID.all);
  updateUiState();
  // Deep links: land directly on a shared company or area.
  if (location.hash && location.hash !== "#/") applyHashFromLocation();
  animate();
}

init();

window.NYCAIAtlas = {
  startups: STARTUPS.length,
  sources: DATA_SOURCES,
  flyToArea: setActiveArea,
};

window.__atlas = { scene, camera, controls, project, THREE, selectStartup };
