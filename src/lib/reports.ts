// Pure helpers for the "report this photo" surface (§7; §13). Kept free of Astro
// and Supabase so the validation is unit-testable in isolation — the endpoint
// (src/pages/api/photo-reports.ts) is a thin wrapper over these.

// The coarse reason codes a visitor may pick — mirrors the photo_report_reason
// enum in migration 0010. Keep in lockstep. Order = display order in the UI.
export const PHOTO_REPORT_REASONS = [
  { code: 'off_topic', label: "Doesn't show the accessibility feature" },
  { code: 'not_this_place', label: 'Looks like a different place' },
  { code: 'abusive', label: 'Abusive or inappropriate' },
  { code: 'privacy', label: 'Shows a person or private information' },
  { code: 'other', label: 'Something else' },
] as const;

export type PhotoReportReason = (typeof PHOTO_REPORT_REASONS)[number]['code'];

const REASON_CODES = new Set(PHOTO_REPORT_REASONS.map((r) => r.code));

/** Accept only a known reason code; anything else (missing, typo, injection)
 *  is null so the endpoint can reject it rather than store junk. */
export function normalizeReportReason(input: unknown): PhotoReportReason | null {
  return typeof input === 'string' && REASON_CODES.has(input as PhotoReportReason)
    ? (input as PhotoReportReason)
    : null;
}

/**
 * Sanitize a return-to path so the redirect can't be turned into an open
 * redirect. Only a same-origin ABSOLUTE PATH is allowed: it must start with a
 * single '/', and NOT '//' or '/\' (protocol-relative → another origin).
 * Anything else falls back to the given default.
 */
export function safeReturnTo(input: unknown, fallback: string): string {
  if (typeof input !== 'string' || input === '') return fallback;
  if (input[0] !== '/') return fallback;
  if (input[1] === '/' || input[1] === '\\') return fallback;
  return input;
}
