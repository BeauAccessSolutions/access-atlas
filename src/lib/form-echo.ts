// Zero-JS input preservation for the contribute forms.
//
// The write endpoints (api/listings.ts, api/confirmations.ts) signal a
// validation error by 303-redirecting back to the form with `?status=…`, which
// the page renders in a role="alert" banner. On its own that redirect throws
// away everything the contributor typed — a single wrong field wipes the radio
// answer, the visit date, the note, the identity tags, the pseudonym, the
// summary, the address, the checkboxes. Re-typing all of it to fix one field is
// exactly the barrier §5 says we don't put in front of people.
//
// This is the same POST → cookie → 303 → read-on-render loop the settings flow
// already uses (lib/settings.ts + api/settings.ts), so it stays zero-JS: the
// endpoint stashes the submitted fields in a short-lived first-party cookie, the
// redirected GET re-renders the form from that cookie, then clears it. No client
// script, no third party, and the existing `?status=` error signaling is
// untouched.
//
// File inputs (the evidence photo) are deliberately NOT echoed: a browser will
// not let a server pre-fill a file control, so there is nothing to round-trip.
import type { AstroCookies } from 'astro';

export const FORM_ECHO_COOKIE = 'aa_form_echo';

// It only has to survive the redirect back to the form; keep it brief so stale
// input can't reappear on a later, unrelated visit to the page.
const MAX_AGE = 120; // seconds

// Stay comfortably under the ~4KB per-cookie browser limit. Realistic input fits
// easily (the fields are maxlength-capped server-side), but a very long note of
// multi-byte characters could bloat the URL-encoded form; if so we drop the two
// largest free-text fields rather than risk an over-size cookie that breaks the
// redirect. Every other field is still preserved.
const MAX_COOKIE_BYTES = 3800;

const COOKIE_OPTS = {
  httpOnly: true, // only the server reads it; keep it out of any future script (§6)
  sameSite: 'lax',
  path: '/',
} as const;

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

/**
 * Stash the submitted text/select/checkbox/radio values so the form page can
 * re-populate them after a validation-error redirect. Call this on the error
 * paths; call `clearFormEcho` on success so a completed submission leaves the
 * form blank. File entries are skipped.
 */
export function setFormEcho(cookies: AstroCookies, form: FormData): void {
  const p = new URLSearchParams();
  for (const [key, value] of form.entries()) {
    // Skip File uploads (photo) — a file control can't be pre-filled anyway.
    if (typeof value === 'string') p.append(key, value);
  }

  let raw = p.toString();
  for (const drop of ['observed_note', 'summary']) {
    if (byteLength(raw) <= MAX_COOKIE_BYTES) break;
    p.delete(drop);
    raw = p.toString();
  }
  // Still over budget after shedding the big fields (pathological input): give
  // up on echoing rather than set a truncated, malformed cookie.
  if (byteLength(raw) > MAX_COOKIE_BYTES) return;

  cookies.set(FORM_ECHO_COOKIE, raw, { ...COOKIE_OPTS, maxAge: MAX_AGE });
}

/** Clear any echoed input — used on the success path so the form comes back clean. */
export function clearFormEcho(cookies: AstroCookies): void {
  cookies.delete(FORM_ECHO_COOKIE, { path: '/' });
}

/** Reader over the echoed values a form page uses to restore each control. */
export interface FormEcho {
  /** First value for a text/select/date field, or '' if absent. */
  value(name: string): string;
  /** Whether a single checkbox with this name was submitted (i.e. checked). */
  checked(name: string): boolean;
  /** Whether `value` is among a repeated (checkbox-group) field's values. */
  includes(name: string, value: string): boolean;
  /** Whether a radio group's selected value equals `value`. */
  selected(name: string, value: string): boolean;
}

/**
 * Read the echoed input for this render, if any, and CLEAR the cookie so it is
 * strictly one-shot — a later plain GET of the form must not resurrect stale
 * input. Returns null when there's nothing to restore (the normal first render),
 * so the caller can leave every control at its default.
 */
export function readFormEcho(cookies: AstroCookies): FormEcho | null {
  const raw = cookies.get(FORM_ECHO_COOKIE)?.value;
  if (raw === undefined) return null;
  clearFormEcho(cookies);

  let p: URLSearchParams;
  try {
    p = new URLSearchParams(raw);
  } catch {
    return null;
  }
  return {
    value: (name) => p.get(name) ?? '',
    checked: (name) => p.has(name),
    includes: (name, v) => p.getAll(name).includes(v),
    selected: (name, v) => p.get(name) === v,
  };
}
