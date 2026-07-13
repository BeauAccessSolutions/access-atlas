import { describe, expect, it } from 'vitest';
import {
  applyListingFilters,
  broadenSuggestions,
  countyOptions,
  hasActiveFilters,
  parseListingFilters,
  serializeListingFilters,
  sortListings,
} from '../../src/lib/filters';
import type { Listing } from '../../src/lib/types';

const listing = (over: Partial<Listing>): Listing => ({
  id: 'x',
  kind: 'place',
  name: 'Somewhere',
  summary: null,
  city: null,
  region: null,
  postalCode: null,
  category: null,
  disabledOwned: false,
  disabledLed: false,
  ...over,
});

const SAMPLE: Listing[] = [
  listing({ id: '1', name: 'Kleinhans Music Hall', city: 'Buffalo', region: 'Erie County', category: 'arts_culture' }),
  listing({ id: '2', name: 'Fly By Cafe', city: 'Niagara Falls', region: 'Niagara County', category: 'business', disabledOwned: true, disabledLed: true }),
  listing({ id: '3', kind: 'provider', name: 'WNYIL', summary: 'Independent living center', city: 'Buffalo', region: 'Erie County', category: 'disability_services', disabledLed: true, provider: { disabilityLiterate: true } }),
  listing({ id: '4', kind: 'provider', name: 'General Hospital', city: 'Buffalo', region: 'Erie County', category: 'healthcare', provider: { disabilityLiterate: false } }),
];

const parse = (qs: string) => parseListingFilters(new URLSearchParams(qs));

describe('parseListingFilters', () => {
  it('parses and trims the text query', () => {
    expect(parse('q=%20ramp%20').q).toBe('ramp');
  });

  it('caps a hostile oversized query', () => {
    expect(parse(`q=${'a'.repeat(500)}`).q).toHaveLength(120);
  });

  it('rejects unknown categories instead of erroring', () => {
    expect(parse('category=nonsense').category).toBeNull();
    expect(parse('category=library').category).toBe('library');
  });

  it('treats empty params as inactive', () => {
    const f = parse('q=&category=&county=');
    expect(hasActiveFilters(f, 'place')).toBe(false);
  });

  it('defaults sort to name and accepts every known key, ignoring anything else', () => {
    expect(parse('').sort).toBe('name');
    expect(parse('sort=zip').sort).toBe('zip');
    expect(parse('sort=recent').sort).toBe('recent');
    expect(parse('sort=distance').sort).toBe('distance');
    expect(parse('sort=bogus').sort).toBe('name');
  });

  it('a non-default sort is NOT an active filter (it never narrows)', () => {
    expect(hasActiveFilters(parse('sort=zip'), 'place')).toBe(false);
  });

  it('parses zip as digits-only, capped at 5', () => {
    expect(parse('zip=14222').zip).toBe('14222');
    expect(parse('zip=142').zip).toBe('142'); // partial = area prefix
    expect(parse('zip=1-4-2-2-2-9').zip).toBe('14222'); // strips non-digits, caps
    expect(parse('zip=abc').zip).toBe('');
  });

  it('counts a zip filter as active (it narrows)', () => {
    expect(hasActiveFilters(parse('zip=142'), 'place')).toBe(true);
  });
});

describe('hasActiveFilters', () => {
  it('ignores the provider-only literate flag on places', () => {
    const f = parse('literate=1');
    expect(hasActiveFilters(f, 'place')).toBe(false);
    expect(hasActiveFilters(f, 'provider')).toBe(true);
  });
});

describe('applyListingFilters', () => {
  it('matches text against name, summary, and city, case-insensitively', () => {
    expect(applyListingFilters(SAMPLE, parse('q=kleinhans')).map((l) => l.id)).toEqual(['1']);
    expect(applyListingFilters(SAMPLE, parse('q=independent')).map((l) => l.id)).toEqual(['3']);
    expect(applyListingFilters(SAMPLE, parse('q=niagara+falls')).map((l) => l.id)).toEqual(['2']);
  });

  it('filters by category and county', () => {
    expect(applyListingFilters(SAMPLE, parse('category=healthcare')).map((l) => l.id)).toEqual(['4']);
    expect(applyListingFilters(SAMPLE, parse('county=Niagara+County')).map((l) => l.id)).toEqual(['2']);
  });

  it('filters by zip as a PREFIX (a partial zip keeps the whole area)', () => {
    const rows = [
      listing({ id: 'a', postalCode: '14222' }),
      listing({ id: 'b', postalCode: '14201' }),
      listing({ id: 'c', postalCode: '13202' }), // Syracuse — different area
      listing({ id: 'd', postalCode: null }),
    ];
    expect(applyListingFilters(rows, parse('zip=142')).map((l) => l.id)).toEqual(['a', 'b']);
    expect(applyListingFilters(rows, parse('zip=14222')).map((l) => l.id)).toEqual(['a']);
    expect(applyListingFilters(rows, parse('zip=99')).map((l) => l.id)).toEqual([]);
  });

  it('representation flags are independent and narrow-only (§1)', () => {
    expect(applyListingFilters(SAMPLE, parse('owned=1')).map((l) => l.id)).toEqual(['2']);
    expect(applyListingFilters(SAMPLE, parse('led=1')).map((l) => l.id)).toEqual(['2', '3']);
  });

  it('literate matches only providers with the self-attested flag', () => {
    expect(applyListingFilters(SAMPLE, parse('literate=1')).map((l) => l.id)).toEqual(['3']);
  });

  it('combines filters with AND semantics', () => {
    expect(
      applyListingFilters(SAMPLE, parse('county=Erie+County&led=1')).map((l) => l.id),
    ).toEqual(['3']);
  });

  it('never mutates or reorders what it keeps', () => {
    const out = applyListingFilters(SAMPLE, parse(''));
    expect(out).toEqual(SAMPLE);
  });
});

describe('sortListings', () => {
  const rows = [
    listing({ id: 'a', name: 'Zed Diner', postalCode: '14201' }),
    listing({ id: 'b', name: 'Anchor Bar', postalCode: '14222' }),
    listing({ id: 'c', name: 'Middle Cafe', postalCode: '14201' }), // ties 'a' on zip
    listing({ id: 'd', name: 'No Zip Place', postalCode: null }),
  ];

  it('sorts by name case-insensitively (the default)', () => {
    expect(sortListings(rows, 'name').map((l) => l.id)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('sorts by zip ascending, ties broken by name, missing zip last', () => {
    // 14201: Middle Cafe (c) before Zed Diner (a); then 14222 (b); null (d) last.
    expect(sortListings(rows, 'zip').map((l) => l.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('treats a blank/whitespace zip as missing (sinks to the bottom)', () => {
    const withBlank = [listing({ id: 'x', name: 'A', postalCode: '  ' }), listing({ id: 'y', name: 'B', postalCode: '14201' })];
    expect(sortListings(withBlank, 'zip').map((l) => l.id)).toEqual(['y', 'x']);
  });

  it('returns a new array and never mutates the input', () => {
    const input = [...rows];
    const snapshot = input.map((l) => l.id);
    const out = sortListings(input, 'zip');
    expect(out).not.toBe(input);
    expect(input.map((l) => l.id)).toEqual(snapshot);
  });

  it('sorts by recent (newest createdAt first), missing dates last, name tiebreak', () => {
    const rows = [
      listing({ id: 'old', name: 'B', createdAt: '2026-01-01T00:00:00Z' }),
      listing({ id: 'new', name: 'C', createdAt: '2026-07-01T00:00:00Z' }),
      listing({ id: 'nodate', name: 'A', createdAt: null }),
    ];
    expect(sortListings(rows, 'recent').map((l) => l.id)).toEqual(['new', 'old', 'nodate']);
  });

  it("server 'distance' sort falls back to name (real distance is client-side)", () => {
    const rows = [
      listing({ id: 'z', name: 'Zed', postalCode: '14201' }),
      listing({ id: 'a', name: 'Ann', postalCode: '14999' }),
    ];
    // No coords / no visitor location server-side → deterministic name order.
    expect(sortListings(rows, 'distance').map((l) => l.id)).toEqual(['a', 'z']);
  });
});

describe('serializeListingFilters', () => {
  it('round-trips through parseListingFilters, omitting defaults', () => {
    const f = parse('q=cafe&category=business&county=Erie+County&zip=142&owned=1&sort=zip');
    const qs = serializeListingFilters(f);
    // Re-parsing the serialized string yields the same filters.
    expect(parseListingFilters(new URLSearchParams(qs))).toEqual(f);
  });

  it('emits nothing for an all-default filter set', () => {
    expect(serializeListingFilters(parse(''))).toBe('');
  });

  it('omits the default sort but keeps a non-default one', () => {
    expect(serializeListingFilters(parse('zip=142'))).toBe('zip=142');
    expect(serializeListingFilters(parse('zip=142&sort=recent'))).toBe('zip=142&sort=recent');
  });
});

describe('broadenSuggestions', () => {
  // Two owned businesses + one (not-owned) healthcare listing, all in Erie.
  const ROWS: Listing[] = [
    listing({ id: 'a', name: 'Ann Cafe', region: 'Erie County', category: 'business', postalCode: '14201', disabledOwned: true }),
    listing({ id: 'b', name: 'Bo Cafe', region: 'Erie County', category: 'business', postalCode: '14222', disabledOwned: true }),
    listing({ id: 'c', name: 'Cee Clinic', region: 'Erie County', category: 'healthcare', postalCode: '14203' }),
  ];

  it('for each active filter, offers a one-filter-relaxed link with a real result count', () => {
    // owned + a ZIP that matches nothing → zero results, both filters active.
    const f = parse('zip=15000&owned=1');
    const s = broadenSuggestions('/places/', ROWS, f, 'place');
    // Dropping the dead ZIP (keeping owned=1) surfaces the 2 owned listings;
    // dropping owned (keeping the dead ZIP) still shows nothing → not offered.
    expect(s.map((x) => x.key)).toEqual(['zip']);
    expect(s[0].count).toBe(2);
    expect(s[0].label).toBe('ZIP 15000');
    expect(s[0].href).toBe('/places/?owned=1'); // other filter preserved
  });

  it('ranks suggestions by how many results each surfaces, most first', () => {
    // category=healthcare (matches only c) AND owned=1 (matches a,b) → 0 together.
    // Drop category (keep owned) → 2 owned businesses. Drop owned (keep
    // healthcare) → 1 clinic. So the bigger-payoff relaxation ranks first.
    const f = parse('category=healthcare&owned=1');
    const s = broadenSuggestions('/places/', ROWS, f, 'place');
    expect(s.map((x) => x.key)).toEqual(['category', 'owned']);
    expect(s.map((x) => x.count)).toEqual([2, 1]);
    expect(s[0].href).toBe('/places/?owned=1');
    expect(s[1].href).toBe('/places/?category=healthcare');
  });

  it('never offers a relaxation that still shows nothing', () => {
    // Both a dead ZIP and a dead category: relaxing either one alone still 0.
    const f = parse('zip=15000&category=arts_culture');
    expect(broadenSuggestions('/places/', ROWS, f, 'place')).toEqual([]);
  });

  it('omits the last-filter relaxation (that is the separate "clear all")', () => {
    // Only one active filter → dropping it is "clear all", not a per-filter hint.
    const f = parse('zip=15000');
    expect(broadenSuggestions('/places/', ROWS, f, 'place')).toEqual([]);
  });

  it('ignores the provider-only literate filter on places', () => {
    const f = parse('zip=15000&literate=1');
    // literate isn't an active constraint for places, so only the ZIP is — and
    // dropping the ZIP is the last filter → nothing to suggest.
    expect(broadenSuggestions('/places/', ROWS, f, 'place')).toEqual([]);
  });
});

describe('countyOptions', () => {
  it('derives distinct counties from data, Erie first', () => {
    const rows = [
      listing({ region: 'Niagara County' }),
      listing({ region: 'Albany County' }),
      listing({ region: 'Erie County' }),
      listing({ region: 'Erie County' }),
      listing({ region: null }),
    ];
    expect(countyOptions(rows)).toEqual(['Erie County', 'Albany County', 'Niagara County']);
  });
});
