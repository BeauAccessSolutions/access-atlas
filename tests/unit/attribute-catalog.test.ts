// Invariants over the attribute catalog itself (§4 weighting, §3 all disability
// types). These are cheap guards on two things that have already gone wrong or
// can silently drift:
//
//   1. A reviewer identity tag offered on the visit-report form but weighted by
//      NO attribute. That contributor can tag themselves and have it count for
//      nothing in the consensus math — the inequity migration 0013 fixed (five
//      tags offered, only `wheelchair_user` weighted).
//   2. The catalog lives in TWO mirrors — the migration chain (the real one,
//      and the only one that reaches production) and src/lib/seed.ts (renders
//      with no DB attached). CLAUDE.md says change them together; this makes
//      "together" checkable.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { IDENTITY_TAGS } from '../../src/lib/identity-tags';
import { seedAttributeDefinitions, seedAttributeIdentityTags } from '../../src/lib/seed';

const TAGS_OF = seedAttributeIdentityTags();

/**
 * Attribute keys declared by the migration chain — every
 * `insert into attribute_definitions (...) values ...;` across all migrations,
 * so a later catalog migration is picked up without touching this test.
 */
function migrationAttributeKeys(): string[] {
  const dir = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));
  const keys: string[] = [];

  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    // Drop whole-line SQL comments first: prose semicolons inside them would
    // otherwise look like the end of the statement and truncate a block.
    const sql = readFileSync(dir + file, 'utf8')
      .split('\n')
      .filter((line) => !/^\s*--/.test(line))
      .join('\n');

    let from = 0;
    for (;;) {
      const start = sql.indexOf('insert into attribute_definitions', from);
      if (start === -1) break;
      const end = sql.indexOf(';', start);
      const block = sql.slice(start, end === -1 ? undefined : end);
      keys.push(...[...block.matchAll(/^\s*\('([a-z_]+)',/gm)].map((m) => m[1]));
      from = end === -1 ? sql.length : end;
    }
  }

  expect(keys.length, 'the migrations should declare the attribute catalog').toBeGreaterThan(0);
  return keys;
}

describe('attribute catalog invariants', () => {
  it('weights every identity tag it offers (§4 lived experience is weighted)', () => {
    const weighted = new Set(Object.values(TAGS_OF).flat());
    const unweighted = IDENTITY_TAGS.filter((t) => !weighted.has(t.key)).map((t) => t.key);

    // If this fails: either add an attribute that the new tag can speak to, or
    // remove the tag from the form. Offering a tag that weights nothing makes
    // that contributor second-class in the consensus math.
    expect(unweighted).toEqual([]);
  });

  it('keeps the migration chain and src/lib/seed.ts in step', () => {
    const fromMigrations = migrationAttributeKeys();
    // No key declared twice across migrations — a re-insert with different
    // wording would silently no-op under `on conflict do nothing`.
    expect(fromMigrations.length, 'duplicate attribute key across migrations').toBe(
      new Set(fromMigrations).size,
    );
    expect(Object.keys(TAGS_OF).sort()).toEqual([...fromMigrations].sort());
  });

  it('lets one attribute weight several access experiences (migration 0018)', () => {
    // service_animal_welcomed is the case that motivated the array: a guide dog
    // handler is blind, a hearing dog handler is Deaf, a mobility assistance dog
    // handler uses a wheelchair — all three are first-person authorities on
    // whether the animal was welcomed.
    expect([...(TAGS_OF.service_animal_welcomed ?? [])].sort()).toEqual([
      'blind_low_vision',
      'deaf_hoh',
      'wheelchair_user',
    ]);
  });

  it('keeps every OTHER attribute single-tagged or untagged', () => {
    // Widening loosens an attribute's verification bar, so it must stay a
    // deliberate, argued, per-attribute decision — not something that creeps in.
    // If this fails, the new multi-tag attribute needs its own justification in
    // the migration, then add it here.
    const widened = Object.entries(TAGS_OF)
      .filter(([, tags]) => tags.length > 1)
      .map(([key]) => key);
    expect(widened).toEqual(['service_animal_welcomed']);
  });

  it('gives non-wheelchair visitors something to report at a PLACE', () => {
    // Places are half the product (§1), but the tag-weighted attributes could
    // easily all end up provider-only — leaving a Deaf or blind visitor at a
    // cafe with nothing to report. Every offered tag must be weighted by at
    // least one attribute that applies to places.
    const placeTags = new Set(
      seedAttributeDefinitions('place').flatMap((d) => TAGS_OF[d.key] ?? []),
    );
    const missing = IDENTITY_TAGS.filter((t) => !placeTags.has(t.key)).map((t) => t.key);
    expect(missing).toEqual([]);
  });
});
