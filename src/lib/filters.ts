// List-page search + filters. Pure functions, filtered in memory over the
// already-loaded list so the behavior is identical for the Postgres backend
// and the no-DB seed fallback (one code path, §11). At the current WNY scale
// (~100 listings) this is deliberate — push down to SQL only when the data
// outgrows it, not before (§3: no scale assumptions in the MVP).
//
// Filters only ever NARROW what is shown. They never touch claim states or
// labels (§4) — a filtered list shows the same honest cards, just fewer.
import type { Listing, ListingKind } from './types';
import { isCategory, CATEGORY_LABELS, type Category } from './categories';

// How the (already-filtered) list is ordered. Sorting only REORDERS — it never
// narrows or touches claim labels (§4).
//   name   — case-insensitive by name (the default; what the list always showed)
//   zip    — by postal code, groups a neighborhood together (§3 WNY-first)
//   recent — newest submissions first, so fresh community listings are findable
//   distance — nearest to the visitor. Needs the visitor's location AND listing
//     coordinates, so it CANNOT be computed on the zero-JS server (§5). It is a
//     CLIENT-ONLY sort: the progressive-enhancement script reorders on-device
//     (location never leaves the device, §6). On the server it falls back to
//     name order, and the "Distance" affordance is added by that script — no-JS
//     visitors never see an option that can't work.
export type SortKey = 'name' | 'zip' | 'recent' | 'distance';
export const DEFAULT_SORT: SortKey = 'name';
const SORT_KEYS = new Set<SortKey>(['name', 'zip', 'recent', 'distance']);

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
  /** ZIP-code prefix, digits only. Matches listings whose postal code STARTS
      with it, so "142" is the Buffalo area and "14222" is one exact ZIP. */
  zip: string;
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
    // Digits only (a ZIP is numeric), capped — a stray query can't balloon it.
    zip: (params.get('zip') ?? '').replace(/\D/g, '').slice(0, 5),
    // Only a known key is honored; anything else falls back to the default order.
    sort: parseSort(params.get('sort')),
  };
}

function parseSort(raw: string | null): SortKey {
  return raw && SORT_KEYS.has(raw as SortKey) ? (raw as SortKey) : DEFAULT_SORT;
}

// Sort is intentionally excluded: it reorders, it doesn't narrow, so a list
// sorted by zip with no filters is still "All N places", not a filtered subset.
export function hasActiveFilters(f: ListingFilters, kind: ListingKind): boolean {
  return Boolean(
    f.q ||
      f.category ||
      f.county ||
      f.zip ||
      f.owned ||
      f.led ||
      (kind === 'provider' && f.literate),
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
    // ZIP is a PREFIX match: "142" keeps the whole Buffalo area, "14222" one ZIP.
    if (f.zip && !(l.postalCode ?? '').startsWith(f.zip)) return false;
    if (f.owned && !l.disabledOwned) return false;
    if (f.led && !l.disabledLed) return false;
    if (f.literate && !l.provider?.disabilityLiterate) return false;
    return true;
  });
}

// ListingFilters -> query string, omitting anything at its default. The partial
// inverse of parseListingFilters (only the fields the UI sets), so a relaxed
// filter set round-trips back into a real, bookmarkable list URL. Deterministic
// key order. `literate` is provider-only, so it's emitted only when set — a
// place URL never carries it.
export function serializeListingFilters(f: ListingFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.category) p.set('category', f.category);
  if (f.county) p.set('county', f.county);
  if (f.zip) p.set('zip', f.zip);
  if (f.owned) p.set('owned', '1');
  if (f.led) p.set('led', '1');
  if (f.literate) p.set('literate', '1');
  if (f.sort !== DEFAULT_SORT) p.set('sort', f.sort);
  return p.toString();
}

// One suggested way to widen a search that came back empty: drop exactly ONE
// filter, keep the rest, and show how many listings that would surface.
export interface BroadenSuggestion {
  /** Which single filter is relaxed (also a stable de-dupe key). */
  key: 'q' | 'category' | 'county' | 'zip' | 'owned' | 'led' | 'literate';
  /** Human phrase naming the dropped constraint, e.g. `ZIP 14222`. */
  label: string;
  /** URL with just this one constraint removed; other filters + sort preserved. */
  href: string;
  /** How many listings match once this one filter is removed (always > 0). */
  count: number;
}

// The active constraints, each paired with a copy of `filters` that has ONLY
// that one cleared. Order here is the priority used to break count ties below:
// most-specific constraints (a ZIP, a text needle) first.
function activeConstraints(
  f: ListingFilters,
  kind: ListingKind,
): Array<{ key: BroadenSuggestion['key']; label: string; without: ListingFilters }> {
  const c: Array<{ key: BroadenSuggestion['key']; label: string; without: ListingFilters }> = [];
  if (f.zip) c.push({ key: 'zip', label: `ZIP ${f.zip}`, without: { ...f, zip: '' } });
  if (f.q) c.push({ key: 'q', label: `“${f.q}”`, without: { ...f, q: '' } });
  if (f.category)
    c.push({ key: 'category', label: CATEGORY_LABELS[f.category], without: { ...f, category: null } });
  if (f.county) c.push({ key: 'county', label: f.county, without: { ...f, county: null } });
  if (f.owned) c.push({ key: 'owned', label: 'disabled-owned', without: { ...f, owned: false } });
  if (f.led) c.push({ key: 'led', label: 'disabled-led', without: { ...f, led: false } });
  // literate is provider-only (hasActiveFilters ignores it for places).
  if (kind === 'provider' && f.literate)
    c.push({ key: 'literate', label: 'disability-literate', without: { ...f, literate: false } });
  return c;
}

/**
 * "Broaden your search" coaching for a filtered result set that came back empty
 * (§3.4 empty-state coaching — explain why, then suggest a real broader query).
 * For each active filter, count how many listings would show if just THAT one
 * were relaxed (the others kept), and return only the relaxations that actually
 * surface results — ranked by how many, most first.
 *
 * The counts are DERIVED from the same in-memory list the page just filtered, so
 * every suggestion is a live link that leads somewhere — never a dead end. One
 * code path for the Postgres and seed backends (§11). A relaxation that clears
 * the LAST remaining filter is omitted: that is exactly the always-present
 * "clear all filters" action, which the caller shows separately.
 */
export function broadenSuggestions(
  action: string,
  listings: Listing[],
  f: ListingFilters,
  kind: ListingKind,
  limit = 4,
): BroadenSuggestion[] {
  const out: BroadenSuggestion[] = [];
  for (const c of activeConstraints(f, kind)) {
    // Dropping the last active constraint == "clear all"; don't duplicate it.
    if (!hasActiveFilters(c.without, kind)) continue;
    const count = applyListingFilters(listings, c.without).length;
    if (count === 0) continue; // relaxing this one alone still shows nothing
    const query = serializeListingFilters(c.without);
    out.push({ key: c.key, label: c.label, href: query ? `${action}?${query}` : action, count });
  }
  // Most results first; stable sort keeps the activeConstraints priority on ties.
  out.sort((a, b) => b.count - a.count);
  return out.slice(0, limit);
}

// Reorder the (already-filtered) list. Returns a NEW array — never mutates the
// caller's. Every branch breaks ties by name so the order is stable and
// deterministic across the DB and seed paths (§11). Missing values sink to the
// bottom (a listing with no ZIP / no date shouldn't jump to the top).
//
// 'distance' is NOT computed here — the server has no visitor location (§5). It
// falls back to name order; the client enhancement does the real distance
// reorder on-device (§6). See SortKey.
export function sortListings(listings: Listing[], sort: SortKey): Listing[] {
  const byName = (a: Listing, b: Listing) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

  if (sort === 'zip') {
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

  if (sort === 'recent') {
    // Newest first, by createdAt (ISO strings compare chronologically). Rows
    // with no date go last, ties broken by name.
    return [...listings].sort((a, b) => {
      const ad = a.createdAt ?? '';
      const bd = b.createdAt ?? '';
      if (ad !== bd) {
        if (ad === '') return 1;
        if (bd === '') return -1;
        return bd.localeCompare(ad); // descending = newest first
      }
      return byName(a, b);
    });
  }

  // 'name' and the server fallback for 'distance'.
  return [...listings].sort(byName);
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
