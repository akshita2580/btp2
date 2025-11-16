/**
 * Geographic utility functions for route tracking and distance calculations
 */

export type Coordinate = [number, number]; // [lat, lon]

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
export function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate the total distance of a route (polyline)
 * @param route Array of coordinates [lat, lon]
 * @returns Total distance in kilometers
 */
export function calculateRouteDistance(route: Coordinate[]): number {
  if (route.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const [lat1, lon1] = route[i];
    const [lat2, lon2] = route[i + 1];
    totalDistance += haversine(lat1, lon1, lat2, lon2);
  }
  return totalDistance;
}

/**
 * Find the nearest point on a polyline to a given coordinate
 * @param point The coordinate to find nearest point for [lat, lon]
 * @param route Array of coordinates representing the route
 * @returns Object with nearest point index, coordinate, and distance
 */
export function findNearestPointOnRoute(
  point: Coordinate,
  route: Coordinate[]
): {
  index: number;
  coordinate: Coordinate;
  distance: number; // in kilometers
} {
  if (route.length === 0) {
    throw new Error('Route is empty');
  }

  if (route.length === 1) {
    const [lat, lon] = route[0];
    const dist = haversine(point[0], point[1], lat, lon);
    return { index: 0, coordinate: route[0], distance: dist };
  }

  let minDistance = Infinity;
  let nearestIndex = 0;
  let nearestPoint: Coordinate = route[0];

  const [pointLat, pointLon] = point;

  // Check distance to each segment
  for (let i = 0; i < route.length - 1; i++) {
    const [lat1, lon1] = route[i];
    const [lat2, lon2] = route[i + 1];

    // Find nearest point on this segment
    const nearestOnSegment = nearestPointOnSegment(
      pointLat,
      pointLon,
      lat1,
      lon1,
      lat2,
      lon2
    );

    const dist = haversine(
      pointLat,
      pointLon,
      nearestOnSegment[0],
      nearestOnSegment[1]
    );

    if (dist < minDistance) {
      minDistance = dist;
      nearestIndex = i;
      nearestPoint = nearestOnSegment;
    }
  }

  // Also check the last point
  const [lastLat, lastLon] = route[route.length - 1];
  const lastDist = haversine(pointLat, pointLon, lastLat, lastLon);
  if (lastDist < minDistance) {
    minDistance = lastDist;
    nearestIndex = route.length - 1;
    nearestPoint = route[route.length - 1];
  }

  return {
    index: nearestIndex,
    coordinate: nearestPoint,
    distance: minDistance,
  };
}

/**
 * Find the nearest point on a line segment to a given point
 * Uses projection onto the line segment
 */
function nearestPointOnSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): Coordinate {
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return [x1, y1];
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
    )
  );

  return [x1 + t * dx, y1 + t * dy];
}

/**
 * Calculate cumulative distance along a route up to a given index
 * @param route Array of coordinates
 * @param endIndex Index to calculate distance up to (inclusive)
 * @returns Cumulative distance in kilometers
 */
export function calculateCumulativeDistance(
  route: Coordinate[],
  endIndex: number
): number {
  if (endIndex <= 0 || route.length < 2) return 0;
  if (endIndex >= route.length) {
    endIndex = route.length - 1;
  }

  let distance = 0;
  for (let i = 0; i < endIndex; i++) {
    const [lat1, lon1] = route[i];
    const [lat2, lon2] = route[i + 1];
    distance += haversine(lat1, lon1, lat2, lon2);
  }
  return distance;
}

/**
 * Calculate covered distance along a route based on nearest point
 * @param userLocation Current user location [lat, lon]
 * @param route Route coordinates
 * @returns Covered distance in kilometers
 */
export function calculateCoveredDistance(
  userLocation: Coordinate,
  route: Coordinate[]
): number {
  if (route.length < 2) return 0;

  const nearest = findNearestPointOnRoute(userLocation, route);
  
  // Calculate distance from start to nearest point
  return calculateCumulativeDistance(route, nearest.index);
}

