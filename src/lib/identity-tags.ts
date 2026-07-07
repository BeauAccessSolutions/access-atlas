// Coarse, optional, access-oriented reviewer identity tags (§4, §6).
//
// These weight a confirmation for the dimension the person speaks to (a
// wheelchair user's step-free assessment outweighs an ambulatory reviewer's).
// They are DELIBERATELY COARSE and are NEVER a diagnosis or disability *type*
// (§6, §14). Always optional. Never displayed tied to an individual. Keep this
// list short and access-relevant; do not expand it toward medical categories.

export interface IdentityTag {
  key: string;   // stored in confirmations.reviewer_identity_tags
  label: string; // shown next to an optional checkbox
}

export const IDENTITY_TAGS: IdentityTag[] = [
  { key: 'wheelchair_user', label: 'I use a wheelchair or mobility device' },
  { key: 'blind_low_vision', label: 'I am blind or have low vision' },
  { key: 'deaf_hoh', label: 'I am Deaf or hard of hearing' },
  { key: 'cognitive_access', label: 'I have cognitive / learning access needs' },
  { key: 'neurodivergent', label: 'I am neurodivergent' },
];

const VALID = new Set(IDENTITY_TAGS.map((t) => t.key));

/** Keep only recognized coarse tags; silently drop anything else (never store free-form health text). */
export function sanitizeTags(raw: string[]): string[] {
  return [...new Set(raw.filter((t) => VALID.has(t)))];
}
