import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Guards the representation accent (§1 / .tag--rep) against silent drift. Reads
// the real global.css, pulls the accent tokens for each theme, and recomputes
// WCAG contrast — if someone re-tunes a hex below AA, this fails (the C4 rule:
// verify numerically in BOTH themes, never by eye).

const css = readFileSync(
  fileURLToPath(new URL('../../src/styles/global.css', import.meta.url)),
  'utf8',
);

// --- WCAG 2.1 relative luminance + contrast ratio ---
function srgbToLin(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}
function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// Slice a single declaration block by its selector (blocks here have no nested
// braces), then read one token out of it.
function block(selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open, close);
}
function token(scope: string, name: string): string {
  const m = scope.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,6})`));
  if (!m) throw new Error(`token ${name} not found in scope`);
  return m[1].toLowerCase();
}

const light = block(':root {');
const darkClass = block(':root.theme-dark {');
const darkMedia = block(':root:not(.theme-light):not(.theme-dark) {'); // the OS-dark block

describe('representation accent (.tag--rep) contrast', () => {
  it('light: violet ink passes AA on its wash and on the canvas', () => {
    const ink = token(light, '--rep-ink');
    const wash = token(light, '--rep-wash');
    const canvas = token(light, '--color-bg');
    expect(contrast(ink, wash)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ink, canvas)).toBeGreaterThanOrEqual(4.5);
  });

  it('dark: violet ink passes AA on its wash and on the canvas', () => {
    const ink = token(darkClass, '--rep-ink');
    const wash = token(darkClass, '--rep-wash');
    const canvas = token(darkClass, '--color-bg');
    expect(contrast(ink, wash)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ink, canvas)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the two dark token blocks in sync (the file requires it)', () => {
    expect(token(darkMedia, '--rep-ink')).toBe(token(darkClass, '--rep-ink'));
    expect(token(darkMedia, '--rep-wash')).toBe(token(darkClass, '--rep-wash'));
  });

  it('stays hue-separated from the validation tones and the teal brand', () => {
    // A cheap guard that the accent is not accidentally re-tuned toward an
    // existing semantic hue: the representation ink must differ meaningfully
    // from the brand and from every tone token in the same (light) scope.
    const repInk = token(light, '--rep-ink');
    for (const other of ['--brand', '--brand-ink', '--color-link', '--tone-verified', '--tone-partial', '--tone-disputed']) {
      expect(repInk).not.toBe(token(light, other));
    }
  });
});
