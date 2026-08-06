// Boots src/main.js against a stubbed DOM + WebGL so init() runs for real.
// Catches undefined vars and bad city config that the bundler can't see.
// Stops at rasterisation — no fake GL context survives shader compilation, so
// a failure with no repo frames in the stack counts as a pass.
//
// npm run smoke [-- --city=sf]

import { loadAllCities } from "../src/cities/index.js";

const CITIES = await loadAllCities();

const arg = process.argv.slice(2).find((a) => a.startsWith("--city="));
const only = arg ? arg.split("=")[1] : null;
const targets = only ? CITIES.filter((c) => c.id === only) : CITIES;

if (!targets.length) {
  console.error(`No such city "${only}". Known: ${CITIES.map((c) => c.id).join(", ")}`);
  process.exit(1);
}

// ------------------- WebGL stub -------------------
// Three touches a wide, shifting surface of the GL API; a Proxy answers all of
// it without enumerating. Only the few calls Three reads back as strings or
// booleans need real answers.
const GL_ENUM = { VENDOR: 0x1f00, RENDERER: 0x1f01, VERSION: 0x1f02, SHADING_LANGUAGE_VERSION: 0x8b8c };
const GL_STRINGS = {
  [GL_ENUM.VENDOR]: "stub",
  [GL_ENUM.RENDERER]: "stub-renderer",
  [GL_ENUM.VERSION]: "WebGL 2.0 (stub)",
  [GL_ENUM.SHADING_LANGUAGE_VERSION]: "WebGL GLSL ES 3.00 (stub)",
};

function makeGL(canvas) {
  const handle = { __stub: true };
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "canvas") return canvas;
        if (prop === "drawingBufferWidth") return 1280;
        if (prop === "drawingBufferHeight") return 720;
        if (prop === Symbol.toPrimitive || prop === "then") return undefined;
        if (typeof prop === "string" && /^[A-Z0-9_]+$/.test(prop)) return GL_ENUM[prop] ?? 1;
        return (...args) => {
          const name = String(prop);
          if (name === "getParameter") return GL_STRINGS[args[0]] ?? 4096;
          if (name.endsWith("InfoLog") || name === "getShaderSource") return "";
          if (name === "getShaderParameter" || name === "getProgramParameter") return true;
          if (name === "getShaderPrecisionFormat") return { rangeMin: 127, rangeMax: 127, precision: 23 };
          if (name === "getSupportedExtensions") return [];
          if (name === "getContextAttributes") return { alpha: false };
          if (name === "getUniformLocation" || name === "getAttribLocation") return 0;
          if (name === "checkFramebufferStatus") return 36053;
          if (name.startsWith("create") || name.startsWith("get")) return handle;
          return undefined;
        };
      },
    },
  );
}

// ------------------- DOM stub -------------------
const noopEvents = () => ({ addEventListener() {}, removeEventListener() {}, dispatchEvent() {} });

function make2dContext() {
  const gradient = { addColorStop() {} };
  return {
    canvas: { width: 16, height: 16 },
    fillRect() {}, clearRect() {}, drawImage() {}, save() {}, restore() {},
    translate() {}, rotate() {}, scale() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, arc() {}, ellipse() {}, fill() {}, stroke() {},
    fillText() {}, putImageData() {},
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => ({}),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    measureText: () => ({ width: 10 }),
    set fillStyle(v) {}, get fillStyle() { return "#000"; },
    set strokeStyle(v) {}, get strokeStyle() { return "#000"; },
    set globalAlpha(v) {}, get globalAlpha() { return 1; },
    set font(v) {}, get font() { return "10px sans-serif"; },
    set lineWidth(v) {}, get lineWidth() { return 1; },
  };
}

function makeElement(tag = "div") {
  const classes = new Set();
  const el = {
    ...noopEvents(),
    tagName: String(tag).toUpperCase(),
    style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => "" },
    dataset: {},
    children: [],
    textContent: "",
    open: false,
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)),
      contains: (c) => classes.has(c),
    },
    set innerHTML(v) { this._html = v; },
    get innerHTML() { return this._html ?? ""; },
    appendChild(c) { this.children.push(c); return c; },
    insertBefore(c) { this.children.push(c); return c; },
    removeChild(c) { return c; },
    remove() {},
    insertAdjacentElement(_pos, c) { return c; },
    setAttribute() {}, setAttributeNS() {},
    getAttribute: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    focus() {}, blur() {}, click() {}, showModal() {}, close() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20 }),
  };
  if (tag === "canvas") {
    Object.assign(el, {
      width: 1280,
      height: 720,
      clientWidth: 1280,
      clientHeight: 720,
      getContext: (kind) => (kind === "2d" ? make2dContext() : makeGL(el)),
      toDataURL: () => "data:,",
      getRootNode: () => globalThis.document,
      setPointerCapture() {}, releasePointerCapture() {},
      get ownerDocument() { return globalThis.document; },
    });
  }
  return el;
}

// Selectors main.js resolves at module scope or during init().
const SELECTORS = [
  "#scene", "#labelsLayer", "#areaList", "#detailCard", "#miniMapPoints",
  "#companySearch", "#searchResults", "#searchTrigger", "#searchModal",
  "#pinLegend", "#miniMapSvg", "#brandTitle", "#brandSub", "#railCredit",
  "#citySwitcher", ".brand", ".mini-map p",
];

function installDom(hash) {
  const store = new Map(SELECTORS.map((s) => [s, makeElement(s === "#scene" ? "canvas" : "div")]));

  globalThis.document = {
    ...noopEvents(),
    title: "",
    body: makeElement("body"),
    documentElement: makeElement("html"),
    fonts: { ready: Promise.resolve() },
    createElement: makeElement,
    createElementNS: (_ns, tag) => makeElement(tag),
    querySelector: (sel) => store.get(sel) ?? null,
    querySelectorAll: () => [],
    getElementById: (id) => store.get(`#${id}`) ?? null,
    activeElement: null,
  };

  globalThis.window = {
    ...noopEvents(),
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    location: { hash, origin: "http://localhost", pathname: "/", reload() {} },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: () => 0, // one frame; we never loop
    cancelAnimationFrame() {},
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    navigator: { clipboard: null, userAgent: "node" },
  };
  globalThis.location = globalThis.window.location;
  globalThis.requestAnimationFrame = globalThis.window.requestAnimationFrame;
  globalThis.matchMedia = globalThis.window.matchMedia;
  globalThis.HTMLCanvasElement = function () {};
  globalThis.self = globalThis;
  // Node 24 exposes navigator as a getter-only global.
  Object.defineProperty(globalThis, "navigator", { value: globalThis.window.navigator, configurable: true });
}

// ------------------- Run -------------------
let failures = 0;

for (const [index, city] of targets.entries()) {
  installDom(city.id === CITIES[0].id ? "#/" : `#/city/${city.id}`);

  // ESM caches by URL, so re-importing main.js for a second city would be a
  // no-op. A query suffix forces a fresh evaluation against the new stubs.
  const url = new URL("../src/main.js", import.meta.url).href + `?smoke=${index}`;
  const started = Date.now();

  try {
    await import(url);
    console.log(`PASS  ${city.id}: init() completed in ${Date.now() - started}ms`);
  } catch (error) {
    const stack = error.stack ?? "";
    const appFrames = stack
      .split("\n")
      .slice(1)
      .filter((l) => /[\\/]src[\\/]/.test(l) && !l.includes("node_modules"));

    if (!appFrames.length && stack.includes("three")) {
      console.log(`PASS  ${city.id}: every builder ran in ${Date.now() - started}ms (stopped in the GPU path, as expected)`);
    } else {
      failures += 1;
      console.error(`FAIL  ${city.id}: ${error.constructor.name}: ${error.message}`);
      appFrames.slice(0, 8).forEach((f) => console.error(`      ${f.trim()}`));
      continue;
    }
  }

  console.log(`      title "${globalThis.document.title}", ${city.startups.length} startups, ${city.areas.length} areas`);
}

console.log(`\n${targets.length - failures}/${targets.length} cities booted\n`);
process.exitCode = failures ? 1 : 0;
