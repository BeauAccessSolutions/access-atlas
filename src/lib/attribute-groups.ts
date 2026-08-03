// Grouping the attribute catalog by the access need each fact speaks to.
//
// THE PROBLEM. The catalog went 7 -> 18 across migrations 0013 and 0015, and the
// report hub lists every applicable fact in attribute-KEY order. That is an
// implementation detail leaking into the interface: for a provider it puts
// "Wheelchair-accessible scale" third, between the restroom and the captions,
// for no reason a reader could ever infer. At 17 items an arbitrary order stops
// being untidy and starts being unusable — someone who just visited has to read
// the whole list to find the two things they can speak to.
//
// THE HEADINGS DESCRIBE A SUBJECT, NOT A PERMISSION. "Wheelchair and mobility
// access", never "If you use a wheelchair". Anyone may report any fact — the
// optional identity tag only WEIGHTS a report for the dimension it speaks to
// (§4). A heading that reads as a gate would suppress exactly the reports we
// want, and would misdescribe how the consensus formula actually works.
//
// GROUP ORDER is the fixed IDENTITY_TAGS order, with the untagged group last.
// That is deliberately NOT a ranking: it is the same order the visit-report form
// already shows the tags in, so a contributor meets them twice in the same
// sequence. Ranking one disability's facts above another's is exactly what this
// project refuses to do (see the ask-ahead ordering note in CLAUDE.md §13).
import { IDENTITY_TAGS } from './identity-tags';

/** Subject-area heading per identity tag. Keyed by tag; null = the shared group. */
const GROUP_HEADINGS: Record<string, string> = {
  wheelchair_user: 'Wheelchair and mobility access',
  blind_low_vision: 'Blind and low-vision access',
  deaf_hoh: 'Deaf and hard-of-hearing access',
  cognitive_access: 'Cognitive and learning access',
  neurodivergent: 'Sensory and neurodivergent access',
};

/** Heading for facts no single access need speaks to more than another. */
export const SHARED_GROUP_HEADING = 'Everyone';

export interface AttributeGroup<T> {
  /** Identity tag key, or null for the shared group. Stable list key. */
  tag: string | null;
  heading: string;
  items: T[];
}

/**
 * Group items by the access need they speak to, dropping empty groups.
 *
 * Pure and generic so the same ordering serves both the tracked-claims list and
 * the not-yet-reported list without either drifting from the other.
 *
 * `tagsOf` returns the attribute's `relevant_identity_tags`. Since migration
 * 0018 an attribute may name SEVERAL, and it then appears under EACH of them —
 * a Deaf visitor scanning their own section must find "Service animal welcomed"
 * there, not only under blind and low-vision. Appearing twice is the point: the
 * groups answer "what can I speak to", and the honest answer for that fact is
 * "several of you can".
 *
 * An unrecognized tag (a catalog row weighting something no longer offered), or
 * no tags at all, lands in the shared group rather than vanishing — a fact must
 * never become unreportable because the tag vocabulary moved underneath it.
 */
export function groupByAccessNeed<T>(
  items: T[],
  tagsOf: (item: T) => string[] | null | undefined,
  labelOf: (item: T) => string,
): AttributeGroup<T>[] {
  const known = new Set(IDENTITY_TAGS.map((t) => t.key));
  const buckets = new Map<string | null, T[]>();
  const push = (tag: string | null, item: T) => {
    const bucket = buckets.get(tag);
    if (bucket) bucket.push(item);
    else buckets.set(tag, [item]);
  };

  for (const item of items) {
    const recognized = (tagsOf(item) ?? []).filter((t) => known.has(t));
    if (recognized.length === 0) push(null, item);
    else for (const tag of recognized) push(tag, item);
  }

  // IDENTITY_TAGS order, then the shared group. Not a ranking — see header.
  const order: (string | null)[] = [...IDENTITY_TAGS.map((t) => t.key), null];

  return order
    .filter((tag) => buckets.has(tag))
    .map((tag) => ({
      tag,
      heading: tag === null ? SHARED_GROUP_HEADING : (GROUP_HEADINGS[tag] ?? SHARED_GROUP_HEADING),
      // Alphabetical within a group: predictable, and no implied priority
      // between two facts serving the same access need.
      items: [...(buckets.get(tag) ?? [])].sort((a, b) => labelOf(a).localeCompare(labelOf(b))),
    }));
}
