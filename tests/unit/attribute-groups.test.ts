// Grouping the attribute catalog by access need (report hub ordering).
//
// The two things worth protecting here: the group order must be the fixed
// IDENTITY_TAGS order (not a ranking someone re-litigates), and nothing may fall
// out of the list — a fact that vanishes is a fact nobody can report.
import { describe, it, expect } from 'vitest';
import { groupByAccessNeed, SHARED_GROUP_HEADING } from '../../src/lib/attribute-groups';
import { IDENTITY_TAGS } from '../../src/lib/identity-tags';
import { seedAttributeDefinitions } from '../../src/lib/seed';

const item = (label: string, tag: string | null) => ({ label, tag });
const groupOf = (items: ReturnType<typeof item>[]) =>
  groupByAccessNeed(items, (i) => i.tag, (i) => i.label);

describe('groupByAccessNeed', () => {
  it('orders groups by the fixed IDENTITY_TAGS order, shared group last', () => {
    // Input deliberately in the "wrong" order — output must not depend on it.
    const groups = groupOf([
      item('Everyone fact', null),
      item('Neuro fact', 'neurodivergent'),
      item('Chair fact', 'wheelchair_user'),
      item('Deaf fact', 'deaf_hoh'),
    ]);
    expect(groups.map((g) => g.tag)).toEqual([
      'wheelchair_user',
      'deaf_hoh',
      'neurodivergent',
      null,
    ]);
    expect(groups[groups.length - 1].heading).toBe(SHARED_GROUP_HEADING);
  });

  it('drops empty groups rather than rendering bare headings', () => {
    const groups = groupOf([item('Chair fact', 'wheelchair_user')]);
    expect(groups).toHaveLength(1);
  });

  it('sorts alphabetically within a group', () => {
    const groups = groupOf([
      item('Zebra', 'wheelchair_user'),
      item('Apple', 'wheelchair_user'),
    ]);
    expect(groups[0].items.map((i) => i.label)).toEqual(['Apple', 'Zebra']);
  });

  it('never loses an item, even with an unrecognized tag', () => {
    // A catalog row weighting a tag no longer offered must still be reportable.
    // Silently dropping it would make the fact invisible and unreportable.
    const groups = groupOf([
      item('Retired tag fact', 'no_longer_a_tag'),
      item('Chair fact', 'wheelchair_user'),
    ]);
    const all = groups.flatMap((g) => g.items.map((i) => i.label));
    expect(all.sort()).toEqual(['Chair fact', 'Retired tag fact']);
    expect(groups.find((g) => g.tag === null)?.items[0].label).toBe('Retired tag fact');
  });

  it('handles an empty catalog', () => {
    expect(groupOf([])).toEqual([]);
  });

  it('headings name a subject, never a permission', () => {
    // "If you use a wheelchair" would read as a gate and suppress reports the
    // consensus model actively wants (anyone may report; the tag only weights).
    const groups = groupOf(IDENTITY_TAGS.map((t, i) => item(`Fact ${i}`, t.key)));
    for (const g of groups) {
      expect(g.heading).not.toMatch(/^if you\b/i);
      expect(g.heading).not.toMatch(/\bonly\b/i);
    }
  });
});

describe('the real catalog, as the report hub renders it', () => {
  it('groups every provider fact without loss', () => {
    const defs = seedAttributeDefinitions('provider');
    const groups = groupByAccessNeed(defs, (d) => d.relevantIdentityTag, (d) => d.label);
    const grouped = groups.flatMap((g) => g.items);
    expect(grouped).toHaveLength(defs.length);
    expect(new Set(grouped.map((d) => d.key)).size).toBe(defs.length);
  });

  it('produces several groups for a provider — the point of the change', () => {
    // Before this, a provider's 17 facts rendered as one arbitrary key-ordered
    // list. If this collapses back to one group, the ordering fix is undone.
    const defs = seedAttributeDefinitions('provider');
    const groups = groupByAccessNeed(defs, (d) => d.relevantIdentityTag, (d) => d.label);
    expect(groups.length).toBeGreaterThanOrEqual(5);
  });

  it('carries the identity tag through the seed def mirror', () => {
    // The grouping is only meaningful if the tag actually survives the read
    // path; a mirror that drops it would silently produce one shared group.
    const defs = seedAttributeDefinitions('provider');
    expect(defs.some((d) => d.relevantIdentityTag === 'deaf_hoh')).toBe(true);
    expect(defs.some((d) => d.relevantIdentityTag === null)).toBe(true);
  });
});
