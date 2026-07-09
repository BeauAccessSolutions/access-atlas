// User-chosen accessibility settings — the single source of truth for the model,
// its cookie encoding, and how it maps onto <html> (§5: accessibility is
// customizable by the person using it, not fixed by us).
//
// HOW IT WORKS (and why it's still zero-JS). The settings page POSTs a plain
// <form> to /api/settings, which writes a first-party functional cookie. The
// browsing pages are on-demand, so Base.astro reads that cookie PER REQUEST and
// puts the resulting classes + CSS custom properties on <html>. Nothing here
// runs in the browser: no client script (the CSP is `script-src 'none'`), no
// third-party (§6, §14). The dormant tokens (--font-scale, .contrast-high) that
// global.css shipped "wired to a control later" finally get their control.
//
// Cookie is httpOnly: only the server ever needs to read it, so we keep it out
// of reach of any future script — the more private default (§6).

export const SETTINGS_COOKIE = 'aa_settings';

// One year — a preference, not a session. Matches the contributor cookie's life.
export const SETTINGS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// Text size multiplies --font-scale (global.css: html font-size is
// calc(100% * var(--font-scale))). Keys are the labels the form shows.
export const TEXT_SIZES = {
  '100': 1,
  '110': 1.1,
  '125': 1.25,
  '150': 1.5,
  '175': 1.75,
  '200': 2,
} as const;
export type TextSize = keyof typeof TEXT_SIZES;

// Line spacing multiplies --line-scale (applied to body line-height in
// global.css). Roomier line-height is a core cognitive-access lever.
export const LINE_SPACINGS = {
  normal: 1,
  roomy: 1.2,
  loose: 1.45,
} as const;
export type LineSpacing = keyof typeof LINE_SPACINGS;

// Font choice. Three honest options rather than one boolean (§4: don't label
// something a "dyslexia font" unless it is one):
//   system    — the default system-ui stack, zero extra weight.
//   readable  — a wide, high-legibility SYSTEM stack (Verdana) + spacing; still
//               no download, so it stays free for low-bandwidth users.
//   dyslexic  — self-hosted OpenDyslexic (SIL OFL, public/fonts/). Only THIS
//               choice pulls the ~115KB webfont, and only for users who pick it
//               — the @font-face is inert until .dyslexic-font is on <html>, so
//               everyone else pays nothing (§5 low-bandwidth).
export const FONT_CHOICES = ['system', 'readable', 'dyslexic'] as const;
export type FontChoice = (typeof FONT_CHOICES)[number];

export interface Settings {
  textSize: TextSize; // -> --font-scale
  lineSpacing: LineSpacing; // -> --line-scale
  contrast: boolean; // -> .contrast-high
  motion: boolean; // -> .reduce-motion (force reduced regardless of OS)
  largeTargets: boolean; // -> .large-targets (WCAG 2.2 §2.5.8: 44px hit areas)
  font: FontChoice; // -> .readable-font / .dyslexic-font (or neither)
}

export const DEFAULT_SETTINGS: Settings = {
  textSize: '100',
  lineSpacing: 'normal',
  contrast: false,
  motion: false,
  largeTargets: false,
  font: 'system',
};

function isTextSize(v: string | null): v is TextSize {
  return v != null && Object.prototype.hasOwnProperty.call(TEXT_SIZES, v);
}
function isLineSpacing(v: string | null): v is LineSpacing {
  return v != null && Object.prototype.hasOwnProperty.call(LINE_SPACINGS, v);
}
function isFontChoice(v: string | null): v is FontChoice {
  return v != null && (FONT_CHOICES as readonly string[]).includes(v);
}
// Cookie/form values are strings; only "1" is truthy, everything else is off.
const bool = (v: string | null): boolean => v === '1';

/**
 * Parse the cookie value into Settings, tolerating anything malformed by falling
 * back to the default for each field. Never throws — a corrupt cookie must never
 * break a page render.
 */
export function parseSettings(raw: string | undefined | null): Settings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  let p: URLSearchParams;
  try {
    p = new URLSearchParams(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  const t = p.get('t');
  const l = p.get('l');
  const f = p.get('f');
  return {
    textSize: isTextSize(t) ? t : DEFAULT_SETTINGS.textSize,
    lineSpacing: isLineSpacing(l) ? l : DEFAULT_SETTINGS.lineSpacing,
    contrast: bool(p.get('c')),
    motion: bool(p.get('m')),
    largeTargets: bool(p.get('g')),
    font: isFontChoice(f) ? f : DEFAULT_SETTINGS.font,
  };
}

/** Serialize Settings to the compact cookie string. Deterministic key order. */
export function serializeSettings(s: Settings): string {
  const p = new URLSearchParams();
  p.set('t', s.textSize);
  p.set('l', s.lineSpacing);
  p.set('c', s.contrast ? '1' : '0');
  p.set('m', s.motion ? '1' : '0');
  p.set('g', s.largeTargets ? '1' : '0');
  p.set('f', s.font);
  return p.toString();
}

/** Build Settings from submitted form data (the /api/settings POST). */
export function settingsFromForm(form: FormData): Settings {
  const t = form.get('textSize');
  const l = form.get('lineSpacing');
  const f = form.get('font');
  return {
    textSize: isTextSize(typeof t === 'string' ? t : null)
      ? (t as TextSize)
      : DEFAULT_SETTINGS.textSize,
    lineSpacing: isLineSpacing(typeof l === 'string' ? l : null)
      ? (l as LineSpacing)
      : DEFAULT_SETTINGS.lineSpacing,
    font: isFontChoice(typeof f === 'string' ? f : null)
      ? (f as FontChoice)
      : DEFAULT_SETTINGS.font,
    // Unchecked checkboxes are simply absent from the POST body.
    contrast: form.get('contrast') != null,
    motion: form.get('motion') != null,
    largeTargets: form.get('largeTargets') != null,
  };
}

export function isDefaultSettings(s: Settings): boolean {
  return (
    s.textSize === DEFAULT_SETTINGS.textSize &&
    s.lineSpacing === DEFAULT_SETTINGS.lineSpacing &&
    s.font === DEFAULT_SETTINGS.font &&
    !s.contrast &&
    !s.motion &&
    !s.largeTargets
  );
}

/**
 * Map Settings onto the <html> element. `class` toggles the behavior rules in
 * global.css; `style` sets the two scalar CSS custom properties. Both are safe
 * under the CSP: style attributes are permitted by `style-src 'unsafe-inline'`,
 * and no script is involved.
 */
export function settingsToRootAttrs(s: Settings): { class: string; style: string } {
  const classes: string[] = [];
  if (s.contrast) classes.push('contrast-high');
  if (s.motion) classes.push('reduce-motion');
  if (s.largeTargets) classes.push('large-targets');
  if (s.font === 'readable') classes.push('readable-font');
  else if (s.font === 'dyslexic') classes.push('dyslexic-font');

  const style = `--font-scale:${TEXT_SIZES[s.textSize]};--line-scale:${LINE_SPACINGS[s.lineSpacing]}`;
  return { class: classes.join(' '), style };
}
