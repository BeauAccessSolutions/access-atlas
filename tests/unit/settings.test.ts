import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
  parseSettings,
  serializeSettings,
  settingsFromForm,
  settingsToRootAttrs,
  isDefaultSettings,
} from '../../src/lib/settings';

// The colour-theme axis (§5, platform/KindredAccess parity). The safety-relevant
// invariant: the DEFAULT stays 'system' so a person who relied on OS-following
// dark mode before this feature existed does not silently get forced to light.
describe('settings: colour theme', () => {
  it('defaults to system (follow the OS) — no regression for OS-dark users', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('system');
    // system adds NO class, so the page falls through to prefers-color-scheme.
    expect(settingsToRootAttrs(DEFAULT_SETTINGS).class).not.toMatch(/theme-/);
  });

  it('maps light/dark to the right <html> class; system to none', () => {
    expect(settingsToRootAttrs({ ...DEFAULT_SETTINGS, theme: 'light' }).class).toContain('theme-light');
    expect(settingsToRootAttrs({ ...DEFAULT_SETTINGS, theme: 'dark' }).class).toContain('theme-dark');
    const sys = settingsToRootAttrs({ ...DEFAULT_SETTINGS, theme: 'system' }).class;
    expect(sys).not.toContain('theme-light');
    expect(sys).not.toContain('theme-dark');
  });

  it('keeps theme and contrast independent (dark + high-contrast is expressible)', () => {
    const cls = settingsToRootAttrs({ ...DEFAULT_SETTINGS, theme: 'dark', contrast: true }).class;
    expect(cls).toContain('theme-dark');
    expect(cls).toContain('contrast-high');
  });

  it('round-trips through the cookie and preserves theme', () => {
    for (const theme of ['system', 'light', 'dark'] as const) {
      const s = { ...DEFAULT_SETTINGS, theme };
      expect(parseSettings(serializeSettings(s)).theme).toBe(theme);
    }
  });

  it('reads theme from submitted form data', () => {
    const form = new FormData();
    form.set('theme', 'dark');
    expect(settingsFromForm(form).theme).toBe('dark');
  });

  it('falls back to system on a malformed/unknown theme value', () => {
    expect(parseSettings('h=neon').theme).toBe('system');
    const form = new FormData();
    form.set('theme', 'neon');
    expect(settingsFromForm(form).theme).toBe('system');
  });

  it('a non-default theme makes settings non-default (so the reset link shows)', () => {
    expect(isDefaultSettings(DEFAULT_SETTINGS)).toBe(true);
    expect(isDefaultSettings({ ...DEFAULT_SETTINGS, theme: 'dark' })).toBe(false);
  });
});

// Reading supports (§5; parity with KindredAccess focus_mode / simplified_layout
// + WCAG 1.4.1 link underlines). Both are off by default and are plain booleans.
describe('settings: reading mode + underline links', () => {
  it('default off, and map to the right <html> classes when on', () => {
    expect(DEFAULT_SETTINGS.readingMode).toBe(false);
    expect(DEFAULT_SETTINGS.underlineLinks).toBe(false);
    const off = settingsToRootAttrs(DEFAULT_SETTINGS).class;
    expect(off).not.toContain('reading-mode');
    expect(off).not.toContain('underline-links');
    const on = settingsToRootAttrs({
      ...DEFAULT_SETTINGS,
      readingMode: true,
      underlineLinks: true,
    }).class;
    expect(on).toContain('reading-mode');
    expect(on).toContain('underline-links');
  });

  it('round-trip through the cookie and read from the form', () => {
    const s = { ...DEFAULT_SETTINGS, readingMode: true, underlineLinks: true };
    const parsed = parseSettings(serializeSettings(s));
    expect(parsed.readingMode).toBe(true);
    expect(parsed.underlineLinks).toBe(true);

    const form = new FormData();
    form.set('readingMode', 'on');
    // underlineLinks intentionally absent -> unchecked -> false.
    const fromForm = settingsFromForm(form);
    expect(fromForm.readingMode).toBe(true);
    expect(fromForm.underlineLinks).toBe(false);
  });

  it('either one makes settings non-default (reset link shows)', () => {
    expect(isDefaultSettings({ ...DEFAULT_SETTINGS, readingMode: true })).toBe(false);
    expect(isDefaultSettings({ ...DEFAULT_SETTINGS, underlineLinks: true })).toBe(false);
  });
});
