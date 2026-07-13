// Curated WNY ZIP-code centroids — the "no external geocoder" way to give a
// submitted listing coarse coordinates for the on-device "sort by distance"
// enhancement (§13). The contributor types a ZIP like normal; we place the
// listing at the ZIP's approximate center. No address is ever sent to an outside
// service (§6), and no JavaScript is involved.
//
// SCOPE (§3 WNY-first): Buffalo + Erie County and immediate neighbors only. Do
// NOT bloat this into a nationwide ZIP database — that's the exact "NYC/national
// scale in the MVP" anti-pattern (§14). Add ZIPs region-by-region as the rollout
// reaches them (Rochester → Syracuse → Albany → NYC).
//
// PRECISION: these are APPROXIMATE neighborhood centers (~1 mi), hand-curated,
// NOT surveyed. A listing placed from its ZIP is stored as coords_source
// 'approximate' (migration 0011) and labeled that way in the UI (§4) — never
// presented as a precise location.

export interface Centroid {
  lat: number;
  lng: number;
}

// key = 5-digit ZIP. Values are approximate centers (decimal degrees).
const WNY_ZIP_CENTROIDS: Record<string, Centroid> = {
  // Buffalo — city
  '14201': { lat: 42.898, lng: -78.878 }, // Lower West Side / Allentown
  '14202': { lat: 42.883, lng: -78.878 }, // Downtown
  '14203': { lat: 42.879, lng: -78.866 }, // Downtown / Cobblestone
  '14204': { lat: 42.884, lng: -78.86 }, // Near East Side
  '14206': { lat: 42.888, lng: -78.815 }, // Lovejoy
  '14207': { lat: 42.945, lng: -78.895 }, // Riverside / Black Rock
  '14208': { lat: 42.907, lng: -78.856 }, // Hamlin Park
  '14209': { lat: 42.913, lng: -78.868 }, // Delaware District
  '14210': { lat: 42.858, lng: -78.826 }, // Valley / South
  '14211': { lat: 42.907, lng: -78.82 }, // East Side
  '14212': { lat: 42.895, lng: -78.828 }, // Broadway-Fillmore
  '14213': { lat: 42.918, lng: -78.888 }, // West Side / Grant-Ferry
  '14214': { lat: 42.94, lng: -78.83 }, // University Heights
  '14215': { lat: 42.938, lng: -78.822 }, // Kensington / Bailey
  '14216': { lat: 42.945, lng: -78.87 }, // North Buffalo
  '14220': { lat: 42.843, lng: -78.822 }, // South Buffalo
  '14222': { lat: 42.918, lng: -78.878 }, // Elmwood Village
  // Erie County — near suburbs
  '14217': { lat: 42.975, lng: -78.878 }, // Kenmore / Tonawanda
  '14218': { lat: 42.822, lng: -78.828 }, // Lackawanna
  '14219': { lat: 42.795, lng: -78.828 }, // Blasdell
  '14221': { lat: 42.985, lng: -78.72 }, // Williamsville / Amherst
  '14223': { lat: 42.965, lng: -78.87 }, // Tonawanda
  '14224': { lat: 42.835, lng: -78.75 }, // West Seneca
  '14225': { lat: 42.92, lng: -78.74 }, // Cheektowaga
  '14226': { lat: 42.965, lng: -78.8 }, // Amherst / Eggertsville
  '14227': { lat: 42.885, lng: -78.745 }, // Cheektowaga (south)
  '14228': { lat: 43.02, lng: -78.77 }, // Amherst / Getzville
};

/**
 * Approximate centroid for a ZIP, or null if it's not in the curated WNY set.
 * Accepts a raw ZIP string (e.g. "14222" or "14222-1234"); only the first five
 * digits are used. Returns null for blank / non-WNY / ZIP+4 with no base match.
 */
export function zipCentroid(zip: unknown): Centroid | null {
  if (typeof zip !== 'string') return null;
  const five = zip.trim().replace(/\D/g, '').slice(0, 5);
  if (five.length !== 5) return null;
  return WNY_ZIP_CENTROIDS[five] ?? null;
}
