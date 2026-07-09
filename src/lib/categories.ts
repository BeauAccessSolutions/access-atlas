// Listing categories — a small, controlled vocabulary used only to help people
// scan the directory (an icon + label per listing). It is NOT part of the
// safety-critical validation model (§4): a category never affects a claim's
// state. Stored as free `text` on listings (like attribute keys) so adding a
// category later is a data change, not a migration.
//
// Icons live in src/components/CategoryIcon.astro. Every icon is paired with the
// text label below — never icon/colour alone (§5).

export const CATEGORY_LABELS = {
  healthcare: 'Healthcare',
  disability_services: 'Disability services',
  business: 'Business',
  library: 'Library',
  arts_culture: 'Arts & culture',
  parks_recreation: 'Parks & recreation',
  transit: 'Transit',
} as const;

export type Category = keyof typeof CATEGORY_LABELS;

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];

export function isCategory(v: unknown): v is Category {
  return typeof v === 'string' && v in CATEGORY_LABELS;
}

export function categoryLabel(v: string | null | undefined): string | null {
  return v && isCategory(v) ? CATEGORY_LABELS[v] : null;
}

// Best-effort classifier for SEED/IMPORT data only, from a listing's NAME.
// Ordered, first-match-wins. Returns null when nothing matches (better to show no
// category than a wrong one). Deliberately ignores the summary: a hospital whose
// blurb mentions "ASL interpreting" is still healthcare, not disability services.
// Human review can correct edge cases — this only bootstraps a curated batch,
// never live user submissions.
export function classifyCategory(name: string): Category | null {
  const t = name.toLowerCase();
  const has = (...words: string[]) => words.some((w) => t.includes(w));

  // Disability services first — an ILC or interpreting agency may also say
  // "health"/"center", but its primary identity is disability services.
  if (has('independent living', 'peer connection', 'association on independent', 'interpreting', 'sign language', ' asl', 'visually impaired advancement'))
    return 'disability_services';
  if (has('library')) return 'library';
  if (has('museum', 'theatre', 'theater', 'performing arts', 'science', 'gallery', 'art '))
    return 'arts_culture';
  if (has('park', 'nature preserve', 'creek', 'ridge', 'recreation', 'trail'))
    return 'parks_recreation';
  if (has('metro rail', 'station', 'nfta', 'transit', 'bus '))
    return 'transit';
  if (has('health', 'clinic', 'medical', 'dental', 'hospital', 'medicine', 'dentistry', 'care center', 'ecmc', 'physician'))
    return 'healthcare';
  if (has('cafe', 'restaurant', 'coffee', 'shop', 'store', 'llc', 'inc', 'company', 'contracting'))
    return 'business';
  return null;
}
