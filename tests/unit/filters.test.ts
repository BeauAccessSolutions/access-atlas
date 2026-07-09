import { describe, expect, it } from 'vitest';
import {
  applyListingFilters,
  countyOptions,
  hasActiveFilters,
  parseListingFilters,
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
