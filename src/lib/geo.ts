// Coordinate parsing for the submit flow. Pure + Astro-free so the validation is
// unit-testable in isolation (the API route is a thin wrapper).
//
// Coordinates are OPTIONAL on a listing and entered by hand (no third-party
// geocoder — that would send an address to an outside service, §6). When a
// contributor supplies them, they power the on-device "sort by distance"
// enhancement; when they don't, the listing simply sorts last there.

export interface Coordinates {
  lat: number;
  lng: number;
}

// { coords: null }  → nothing was entered (fine, listing has no coordinates)
// { coords: {...} }  → a valid lat/lng pair
// { error: 'invalid' } → something was entered but it isn't a usable pair
export type CoordinatesParse = { coords: Coordinates | null } | { error: 'invalid' };

function trimmed(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Parse a latitude/longitude pair from raw form values. Both are required
 * TOGETHER — a latitude with no longitude (or vice-versa) is not a location, so
 * it's an error rather than silently half-stored. Ranges are the real-world
 * bounds (lat ±90, lng ±180); anything outside, non-numeric, or half-filled is
 * 'invalid'. Both blank is the normal "no coordinates" case.
 */
export function parseCoordinates(latRaw: unknown, lngRaw: unknown): CoordinatesParse {
  const lat = trimmed(latRaw);
  const lng = trimmed(lngRaw);
  if (lat === '' && lng === '') return { coords: null };
  const latN = Number(lat);
  const lngN = Number(lng);
  const valid =
    lat !== '' &&
    lng !== '' &&
    Number.isFinite(latN) &&
    Number.isFinite(lngN) &&
    latN >= -90 &&
    latN <= 90 &&
    lngN >= -180 &&
    lngN <= 180;
  return valid ? { coords: { lat: latN, lng: lngN } } : { error: 'invalid' };
}
