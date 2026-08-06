// Shared point-in-shape tests. City-agnostic: every city's geo module feeds the
// same two predicates, and the scatter passes lean on them heavily.

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
