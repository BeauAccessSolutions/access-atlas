// List-page search + filters. Pure functions, filtered in memory over the
// already-loaded list so the behavior is identical for the Postgres backend
// and the no-DB seed fallback (one code path, §11). At the current WNY scale
// (~100 listings) this is deliberate — push down to SQL only when the data
// outgrows it, not before (§3: no scale assumptions in the MVP).
//
// Filters only ever NARROW what is shown. They never touch claim states or
// labels (§4) — a filtered list shows the same honest cards, just fewer.
import type { Listing, ListingKind } from './types';
import { isCategory, type Category } from './categories';

// How the (already-filtered) list is ordered. 'name' is the default (and what
// the list has always shown); 'zip' groups nearby listings by postal code, which
// is handy for planning a trip around one neighborhood (§3 WNY-first). Sorting
// only REORDERS — it never narrows or touches claim labels (§4).
export type SortKey = 'name' | 'zip';
export const DEFAULT_SORT: SortKey = 'name';

export interface ListingFilters {
  /** Free-text needle, matched case-insensitively against name/summary/city. */
  q: string;
  category: Category | null;
  /** Exact `region` match ("Erie County"). Options come from the live data. */
  county: string | null;
  /** Representation axis (§1) — valid on both kinds, independent flags. */
  owned: boolean;
  led: boolean;
  /** Provider competence axis — providers only; ignored for places. */
  literate: boolean;
  /** Result ordering. Not a "filter" (it never narrows) — see hasActiveFilters. */
  sort: SortKey;
}

// Query-param names are part of the page's URL contract (bookmarkable,
// zero-JS GET form). Keep them short and stable.
export function parseListingFilters(params: URLSearchParams): ListingFilters {
  const rawCategory = params.get('category');
  return {
    // Cap the needle so a hostile query string can't balloon the page.
    q: (params.get('q') ?? '').trim().slice(0, 120),
    category: rawCategory && isCategory(rawCategory) ? rawCategory : null,
    county: (params.get('county') ?? '').trim().slice(0, 80) || null,
    owned: params.get('owned') === '1',
    led: params.get('led') === '1',
    literate: params.get('literate') === '1',
    // Only the known key flips it; anything else falls back to the default order.
    sort: params.get('sort') === 'zip' ? 'zip' : DEFAULT_SORT,
  };
}

// Sort is intentionally excluded: it reorders, it doesn't narrow, so a list
// sorted by zip with no filters is still "All N places", not a filtered subset.
export function hasActiveFilters(f: ListingFilters, kind: ListingKind): boolean {
  return Boolean(
    f.q || f.category || f.county || f.owned || f.led || (kind === 'provider' && f.literate),
  );
}

export function applyListingFilters(listings: Listing[], f: ListingFilters): Listing[] {
  const needle = f.q.toLowerCase();
  return listings.filter((l) => {
    if (needle) {
      const hay = `${l.name} ${l.summary ?? ''} ${l.city ?? ''}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    if (f.category && l.category !== f.category) return false;
    if (f.county && l.region !== f.county) return false;
    if (f.owned && !l.disabledOwned) return false;
    if (f.led && !l.disabledLed) return false;
    if (f.literate && !l.provider?.disabilityLiterate) return false;
    return true;
  });
}

// Reorder the (already-filtered) list. Returns a NEW array — never mutates the
// caller's. 'name' is a plain case-insensitive name sort. 'zip' orders by postal
// code ascending, with listings that have NO postal code LAST (a missing zip
// shouldn't jump to the top), and ties broken by name so the order is stable and
// deterministic across the DB and seed paths (§11).
export function sortListings(listings: Listing[], sort: SortKey): Listing[] {
  const byName = (a: Listing, b: Listing) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  if (sort === 'name') return [...listings].sort(byName);
  return [...listings].sort((a, b) => {
    const az = a.postalCode?.trim() ?? '';
    const bz = b.postalCode?.trim() ?? '';
    if (az !== bz) {
      if (az === '') return 1; // missing zip sinks to the bottom
      if (bz === '') return -1;
      return az.localeCompare(bz, undefined, { numeric: true });
    }
    return byName(a, b);
  });
}

// Distinct counties present in the loaded data, Erie first (§3 beachhead),
// the rest alphabetical. Derived from data so the dropdown never offers a
// county with zero listings.
export function countyOptions(listings: Listing[]): string[] {
  const seen = new Set<string>();
  for (const l of listings) if (l.region) seen.add(l.region);
  const counties = [...seen].sort((a, b) => a.localeCompare(b));
  const erie = counties.indexOf('Erie County');
  if (erie > 0) {
    counties.splice(erie, 1);
    counties.unshift('Erie County');
  }
  return counties;
}
