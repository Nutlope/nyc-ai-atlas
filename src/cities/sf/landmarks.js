// =================== Hand-modelled San Francisco landmarks ===================
// The imported OSM footprints already give every building its real outline and
// height, but the silhouettes people actually recognise need shaping by hand.
// One world unit is ~90m, matching the NYC city.

export const LANDMARKS = {
  salesforceTower: { lat: 37.789774, lng: -122.396932 }, // 326m
  transamerica: { lat: 37.795188, lng: -122.40279 }, // 260m
  ferryBuilding: { lat: 37.795549, lng: -122.393475 },
  coitTower: { lat: 37.802276, lng: -122.406298 },
  oraclePark: { lat: 37.778606, lng: -122.389472 },
  chaseCenter: { lat: 37.7679, lng: -122.387422 },
  paintedLadies: { lat: 37.776068, lng: -122.432707 },
  cityHall: { lat: 37.7793, lng: -122.4193 },
};

export function createLandmarks(kit) {
  const { THREE, scene, project, materials, createBlockAt, addLandmarkLabel } = kit;
  const stone = materials.landmark;
  const glass = materials.glass;

  // --- Salesforce Tower: tapered obelisk, rounded crown, the city's high point ---
  {
    const p = project(LANDMARKS.salesforceTower.lat, LANDMARKS.salesforceTower.lng);
    // 24 sides reads as the real building's softened square at this scale.
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.52, 3.4, 24), glass);
    tower.position.set(p.x, 1.7, p.z);
    tower.castShadow = true;
    scene.add(tower);
    // The crown is a glowing lantern after dark; here just a paler cap.
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 0.42, 24), materials.window);
    crown.position.set(p.x, 3.6, p.z);
    crown.castShadow = true;
    scene.add(crown);
    addLandmarkLabel("Salesforce Tower", LANDMARKS.salesforceTower.lat, LANDMARKS.salesforceTower.lng, 4.2);
  }

  // --- Transamerica Pyramid: four-sided spire with the two service wings ---
  {
    const p = project(LANDMARKS.transamerica.lat, LANDMARKS.transamerica.lng);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.35, 0.52), stone);
    base.position.set(p.x, 0.17, p.z);
    base.rotation.y = Math.PI / 4;
    base.castShadow = true;
    scene.add(base);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.45, 4), stone);
    spire.position.set(p.x, 1.57, p.z);
    spire.rotation.y = Math.PI / 4;
    spire.castShadow = true;
    scene.add(spire);
    // Wings: the two blank shafts that carry the lifts and stairs.
    for (const dx of [-0.2, 0.2]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 0.14), stone);
      wing.position.set(p.x + dx, 0.65, p.z);
      wing.castShadow = true;
      scene.add(wing);
    }
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.5, 6), materials.window);
    tip.position.set(p.x, 3.0, p.z);
    scene.add(tip);
    addLandmarkLabel("Transamerica", LANDMARKS.transamerica.lat, LANDMARKS.transamerica.lng, 3.4);
  }

  // --- Ferry Building: long arcade under a clock tower ---
  {
    const p = project(LANDMARKS.ferryBuilding.lat, LANDMARKS.ferryBuilding.lng);
    createBlockAt(
      LANDMARKS.ferryBuilding.lat,
      LANDMARKS.ferryBuilding.lng,
      0.24,
      1.7,
      0.28,
      stone,
      0.15,
    );
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.16), stone);
    shaft.position.set(p.x, 0.42, p.z);
    shaft.rotation.y = 0.15;
    shaft.castShadow = true;
    scene.add(shaft);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.2, 4), stone);
    cap.position.set(p.x, 0.83, p.z);
    cap.rotation.y = Math.PI / 4;
    scene.add(cap);
    addLandmarkLabel("Ferry Building", LANDMARKS.ferryBuilding.lat, LANDMARKS.ferryBuilding.lng, 1.1);
  }

  // --- Coit Tower: a plain white column on Telegraph Hill ---
  {
    const p = project(LANDMARKS.coitTower.lat, LANDMARKS.coitTower.lng);
    // The hill first, so the tower reads as standing above the city.
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), materials.hill);
    hill.scale.set(2.6, 0.55, 2.6);
    hill.position.set(p.x, 0.02, p.z);
    hill.receiveShadow = true;
    hill.castShadow = true;
    scene.add(hill);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.72, 16), stone);
    column.position.set(p.x, 0.92, p.z);
    column.castShadow = true;
    scene.add(column);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.1, 16), stone);
    crown.position.set(p.x, 1.33, p.z);
    scene.add(crown);
    addLandmarkLabel("Coit Tower", LANDMARKS.coitTower.lat, LANDMARKS.coitTower.lng, 1.7);
  }

  // --- Oracle Park: open horseshoe facing the bay ---
  {
    const p = project(LANDMARKS.oraclePark.lat, LANDMARKS.oraclePark.lng);
    const stands = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.7, 0.3, 24, 1, true, Math.PI * 0.32, Math.PI * 1.36),
      materials.building,
    );
    stands.position.set(p.x, 0.15, p.z);
    stands.rotation.y = -0.5;
    stands.castShadow = true;
    stands.receiveShadow = true;
    scene.add(stands);
    const field = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), materials.park);
    field.rotation.x = -Math.PI / 2;
    field.position.set(p.x, 0.03, p.z);
    scene.add(field);
    addLandmarkLabel("Oracle Park", LANDMARKS.oraclePark.lat, LANDMARKS.oraclePark.lng, 0.7);
  }

  // --- Chase Center: the arena the Mission Bay AI campuses grew around ---
  {
    const p = project(LANDMARKS.chaseCenter.lat, LANDMARKS.chaseCenter.lng);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.5, 0.34, 20), materials.building);
    bowl.position.set(p.x, 0.17, p.z);
    bowl.castShadow = true;
    scene.add(bowl);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.44, 0.05, 20), materials.roofColored);
    roof.position.set(p.x, 0.36, p.z);
    scene.add(roof);
    addLandmarkLabel("Chase Center", LANDMARKS.chaseCenter.lat, LANDMARKS.chaseCenter.lng, 0.8);
  }

  // --- Painted Ladies: the Alamo Square row, facing the park ---
  {
    const p = project(LANDMARKS.paintedLadies.lat, LANDMARKS.paintedLadies.lng);
    const trims = [0xe8d5b7, 0xd9b8a0, 0xcfc0a8, 0xdcc6ae, 0xc9b49c, 0xe0cbb2];
    trims.forEach((tint, i) => {
      const house = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.16, 0.1),
        new THREE.MeshStandardMaterial({ color: tint, roughness: 0.75 }),
      );
      house.position.set(p.x + (i - 2.5) * 0.062, 0.08, p.z);
      house.castShadow = true;
      scene.add(house);
      const gable = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.06, 4), materials.roofColored);
      gable.position.set(p.x + (i - 2.5) * 0.062, 0.19, p.z);
      gable.rotation.y = Math.PI / 4;
      scene.add(gable);
    });
    addLandmarkLabel("Painted Ladies", LANDMARKS.paintedLadies.lat, LANDMARKS.paintedLadies.lng, 0.45);
  }

  // --- City Hall: beaux-arts dome over Civic Center ---
  {
    const p = project(LANDMARKS.cityHall.lat, LANDMARKS.cityHall.lng);
    createBlockAt(LANDMARKS.cityHall.lat, LANDMARKS.cityHall.lng, 0.6, 0.34, 0.24, stone, 0);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.12, 18), stone);
    drum.position.set(p.x, 0.3, p.z);
    scene.add(drum);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      materials.copper,
    );
    dome.position.set(p.x, 0.36, p.z);
    dome.castShadow = true;
    scene.add(dome);
    addLandmarkLabel("City Hall", LANDMARKS.cityHall.lat, LANDMARKS.cityHall.lng, 0.7);
  }
}
