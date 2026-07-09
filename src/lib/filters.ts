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
  };
}

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
