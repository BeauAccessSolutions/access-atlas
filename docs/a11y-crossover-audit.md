# Accessibility crossover audit — KindredAccess → Access Atlas

Prepared 2026-07-08. Source: the KindredAccess Django app's WCAG 2.2 AA work
(`~/projects/bas-platform/repos/kindredaccess/`, ~84 documented a11y features).
This maps its features onto Access Atlas and flags what to replicate. Access
Atlas constraints: **zero-JS browsing surface**, CSP `default-src 'none'` /
`script-src 'none'` / `font-src 'self'`, no accounts, list-first (§5).

## A. Already at parity (no work needed)
Skip link · semantic landmarks · `:focus-visible` 3px outline · heading
hierarchy · reduced-motion · dark mode · high-contrast tokens · AA contrast ·
`role="status"/"alert"` messaging · `lang` · unique titles · descriptive links ·
`main[tabindex="-1"]` · decorative-icon `aria-hidden` · no `javascript:` URLs.
**Ahead of KA:** axe-core already runs in CI (`npm run test:a11y`).

## B. Crossovers to replicate — prioritized

### Tier 1 — high value, clean fit, doable now (zero-JS)
1. **Accessibility settings page (the flagship).** KA has a 14-field settings
   model + page (text size, contrast, motion, line-spacing, larger targets,
   readable font). Access Atlas already has the *tokens* (`--font-scale`,
   `.contrast-high`) but **nothing sets them** ("wired to a control later" in
   `global.css`). Adapt zero-JS: a `<form>` POSTs prefs → sets a functional
   cookie → `src/middleware.ts` (or Base.astro) reads the cookie on SSR and
   applies a class / CSS vars. No account, no client JS. Directly delivers §5's
   "user-customizable text size / contrast / reduced motion."
2. **Target size 24px (WCAG 2.2 §2.5.8 AA).** Real gap — no explicit min sizing
   today. Add hit-area to nav links, report-visit links, badge-links; "larger
   targets" (44/48px) becomes one of the settings in #1.
3. **Accessible form fields.** Required-asterisk + `aria-required`, and
   field-level errors via `aria-invalid` + `aria-describedby` (KA's reusable
   `form_field.html`). Access Atlas uses "(required)" text + a top-of-page error
   banner; move to inline field errors on the server round-trip (still zero-JS).
4. **`.sr-only` / visually-hidden utility.** Missing entirely — ~6 lines of CSS.
   Then use it for screen-reader context (e.g. confirmation-count phrasing).
5. **Accessibility statement page** (`/about/accessibility`). On-brand: we can
   honestly enumerate what we do (§6 verifiable claims), backed by axe + the above.

### Tier 2 — smaller wins
Print styles · verify 16px inputs (stop iOS zoom) · `aria-atomic` on status
banners · richer empty-state messaging.

### Tier 3 — flag now, build when the feature exists
- **Alt text on evidence photos** + **alt-required on upload** (the moment photos render).
- **Native `<details>` disclosure for filters** — when search/filters land (zero-JS `aria-expanded` for free).
- **Sensitive-data consent** + **destructive-action confirmation** — when the contributor/Keycloak flow lands (data-rights delete already confirms at the CLI).
- **Plain-language glossary/help page** — cognitive access; §12 glossary exists internally.

## C. Not applicable (KindredAccess-specific)
~30 features tied to chat/realtime, emoji picker, modals + focus-trap + photo
cropper, matching/compatibility, like/pass, block/report user, unread badges,
profiles/pronouns, onboarding wizard, availability status. Access Atlas has no
accounts, no realtime, no modals (zero-JS) → these don't cross over.

## D. CSP caveat — the dyslexia font
KA loads **OpenDyslexic from a CDN**. Access Atlas **cannot** copy that: CSP is
`font-src 'self'`. Options: self-host the font (adds weight, cuts against
low-bandwidth), OR make the "readable" toggle just bump spacing/size. Decide
before building the settings page's font option.

## Recommendation
Do **Tier 1** as one focused pass; the cookie-backed settings page is the
centerpiece (activates the dormant tokens AND subsumes target-size + line-spacing).
Then Tier 2. Tier 3 rides along with the features that unlock it.
