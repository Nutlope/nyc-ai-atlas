import { CENTRAL_PARK, CENTRAL_PARK_FEATURES, LANDMARKS } from "./geo.js";

// =================== Central Park ===================
// The only park on the map with real interior modelling: hills, water, the
// drive loop, the Mall allée and two patches of woodland.

export function createBigParkDetails(kit) {
  const {
    makeShape, makeTube, materials, createHill, ellipseCoords, addTree,
    scatterTreesInPoly, seededRandom,
  } = kit;
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

// =================== Hand-modelled New York landmarks ===================
// These are the silhouettes that make the map read as New York rather than a
// grid of boxes, so each one is built by hand instead of scattered.
// `kit` carries the scene helpers main.js owns: see buildLandmarkKit there.

export function createLandmarks(kit) {
  const { THREE, scene, project, materials, createBlockAt, stackTower, addLandmarkLabel, UP } = kit;
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
    const torchMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd671,
      emissive: new THREE.Color(0xffb020).multiplyScalar(0.55),
      roughness: 0.3,
    });
    const torch = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 8), torchMaterial);
    torch.position.set(sp.x + 0.3, 2.25, sp.z);
    scene.add(torch);
    // Crown: a ring of seven copper spikes.
    for (let i = 0; i < 7; i += 1) {
      const angle = -Math.PI * 0.75 + (i / 6) * Math.PI * 1.5;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.11, 5), materials.copper);
      spike.position.set(sp.x + Math.cos(angle) * 0.08, 2.12, sp.z + Math.sin(angle) * 0.08);
      spike.rotation.z = Math.cos(angle) * 0.55;
      spike.rotation.x = -Math.sin(angle) * 0.55;
      scene.add(spike);
    }
    addLandmarkLabel("Statue of Liberty", LANDMARKS.statueLiberty.lat, LANDMARKS.statueLiberty.lng, 2.6);
  }

  // --- Washington Square Arch ---
  {
    const ap = project(40.731, -73.9973);
    for (const dx of [-0.14, 0.14]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.34, 0.09), stone);
      leg.position.set(ap.x + dx, 0.17, ap.z);
      leg.castShadow = true;
      scene.add(leg);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.13, 0.12), stone);
    lintel.position.set(ap.x, 0.4, ap.z);
    lintel.castShadow = true;
    scene.add(lintel);
  }

  // --- Guggenheim: the inverted-ziggurat rotunda ---
  {
    const gp = project(40.783, -73.959);
    let gy = 0;
    for (let i = 0; i < 4; i += 1) {
      const r = 0.15 + i * 0.045;
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.93, 0.13, 20), stone);
      drum.position.set(gp.x, gy + 0.065, gp.z);
      drum.castShadow = true;
      scene.add(drum);
      gy += 0.13;
    }
    addLandmarkLabel("Guggenheim", 40.783, -73.959, 1.0);
  }

  // --- St. Patrick's Cathedral: nave + twin spires facing Fifth Avenue ---
  {
    const cp2 = project(40.7585, -73.976);
    const nave = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.68), stone);
    nave.position.set(cp2.x, 0.15, cp2.z);
    nave.rotation.y = 0.5;
    nave.castShadow = true;
    scene.add(nave);
    for (const off of [-0.11, 0.11]) {
      const anchor = new THREE.Vector3(off, 0, 0.3).applyAxisAngle(UP, 0.5);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 6), stone);
      spire.position.set(cp2.x + anchor.x, 0.52, cp2.z + anchor.z);
      spire.castShadow = true;
      scene.add(spire);
    }
    addLandmarkLabel("St. Patrick's", 40.7585, -73.976, 1.1);
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
