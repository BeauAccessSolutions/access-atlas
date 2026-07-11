# Access Atlas — design direction

Status: living document, first written 2026-07-11. Sources are a deep-research
pass (27 sources, 24/25 claims verified via 3-vote adversarial checking) plus a
direct read of the sibling **KindredAccess (KA)** app and the **Beau Access
Solutions (BAS)** governance repo. This records the design direction and the
evidence behind it; it is not a spec. Confidence and citations are inline.

Guiding rule for everything below: **"nothing about us without us."** The
recommendations here are evidence-backed and community-endorsed; the contested
ones are flagged as such and must be tuned with paid disabled co-designers, not
settled by this document.

---

## 1. Executive summary

The research **validates the existing architecture** rather than redirecting it.
Access Atlas already does the hard, contested things correctly — the zero-JS,
on-device, cookie-backed preferences model; honest font labeling; 44px targets;
list-first browsing. The work ahead is a small, well-evidenced set of additions.

Prioritized:

- **P0 — Explicit colour-theme toggle (`system` / `light` / `dark`).** The one
  real gap vs. the KA/platform canonical suite. **Shipped in this change.**
- **P0 — Hold the anti-overlay line** (already done). It is the single most
  important guardrail and it is fully backed by community consensus.
- **P1 — Accessible-map engineering contract** written *before* any map is built
  (list-first, keyboard path, unique pin names) — the accessible parts are real
  work, not framework defaults.
- **P1 — GOV.UK/MOJ "filter-a-list" explicit-submit filtering** when search
  lands (native controls, no auto-apply) — a direct fit for zero-JS.
- **P2 — Cognitive supports KA already ships:** a server-rendered
  `focus_mode` / `simplified_layout` reading mode, and a link-underline toggle.

## 2. What "align with KindredAccess/the platform" actually means

BAS ships `packages/ui` — an "accessibility-first design system
(telemetry-free)" — and the canonical accessibility suite originates in the
flagship CIT app to be generalized: **dark / high-contrast / dyslexia /
text-size / reduced-motion**. Reading KA's own implementation
(`kindredaccess`, `static/css/theme.css`, `core/templates/core/accessibility_settings.html`)
shows its full user-facing suite:

`color_theme` (light/dark/high-contrast) · `text_size` · `line_spacing` ·
`dyslexia_font` · `large_targets` · `reduce_motion` · `focus_mode` ·
`simplified_layout` · plus app/native-only controls (`flash_alerts`,
`sound_effects`, `vibration`, `pause_autoplay`, `announce_status`,
`extended_time`, `confirm_actions`).

Two structural facts that shape our decisions:

- **KA folds high-contrast into a single `color_theme` enum**
  (light/dark/high-contrast are mutually exclusive). Access Atlas keeps
  **contrast as an independent axis**, so a person can run **dark _and_
  high-contrast at once**. Per CLAUDE.md §15 the more-accessible option wins, so
  we diverge deliberately — a candidate BAS ADR, like the auth-BFF divergence.
- The native/media-only KA controls (flash alerts, sounds, vibration, autoplay
  pausing, extended timeouts) have **no surface on a zero-JS static browsing
  page** — there is nothing to flash, autoplay, or time out. They are honestly
  N/A here, not gaps.

## 3. Overall UX / visual design direction

**List-first, map-second (validated).** Accessible-map guidance (Minnesota IT
state guide, Equal Entry, Leaflet a11y) unanimously backs CLAUDE.md §5: first
*question whether a map is needed at all*, and make the app work with or without
it, with the equivalent text list **first in DOM and keyboard order**.
`[high, 3-0]`

**Accessible map = real engineering, not a default.** The one **refuted** claim
in the research is load-bearing: Leaflet markers are **not** keyboard-operable
by default `[refuted 0-3]`. So when a map is added: every marker needs a unique,
descriptive accessible name (`alt`/`title`); full keyboard zoom/pan (e.g. a
centre-crosshair "click"); semantic HTML around the widget (headings, lists,
`main`); dynamic result changes announced. Keyboard operability is mandatory
under WCAG 2.1.1. `[high, 3-0]`

**Filter UX.** Adopt the MOJ/GOV.UK **"Filter a list"** pattern: list appears
unfiltered; the user sets native form controls (checkbox/radio/date/text matched
to the attribute type) and submits an explicit **"Apply filters"** button — *no
auto-apply on change*. Authoritative government guidance, and a 1:1 fit for the
zero-JS Astro/cookie model. `[high, 3-0]`

**Listing detail & "report a visit."** No change needed — the per-attribute
confirm flow already matches the "adapt to the individual, evidence per claim"
model. Hold the line: never collapse to a single overall star (§4, and §5 below).

## 4. Accessibility feature suite — gap analysis

The compliant model Access Atlas uses — on-device, user-controlled
personalization that adapts content *for the individual*, not a site-wide "fix"
— is exactly what W3C WAI-COGA endorses ("Support Adaptation and
Personalization"; content "specified to the User Agent"). It is the principled
opposite of an overlay. `[high 3-0 / the "vs overlay" framing is synthesis, 2-1]`

| Feature | Status | KA / platform canonical | WCAG map | Zero-JS feasibility |
|---|---|---|---|---|
| Text size (100–200%, 6 steps) | ✅ Have | ✅ `text_size` | 1.4.4 Resize Text | ✅ cookie → `--font-scale` |
| High-contrast toggle | ✅ Have (independent axis) | ✅ (inside `color_theme`) | 1.4.3 / 1.4.11 | ✅ `.contrast-high` |
| Reduced motion (forced) | ✅ Have | ✅ `reduce_motion` | 2.3.3 | ✅ `.reduce-motion` |
| Font: system / readable / OpenDyslexic (honest label) | ✅ Have — **exceeds** | ✅ `dyslexia_font` (boolean) | 1.4.12 | ✅ self-hosted |
| Line spacing (normal/roomy/loose) | ✅ Have | ✅ `line_spacing` | 1.4.12 Text Spacing | ✅ `--line-scale` |
| Larger targets (44px) | ✅ Have — **exceeds** | ✅ `large_targets` | 2.5.8 AA (24px floor); **44px = AAA 2.5.5** | ✅ `.large-targets` |
| **Colour theme (system/light/dark)** | ✅ **Shipped here** | ✅ `color_theme` | 1.4.3 / 1.4.8 | ✅ `.theme-light`/`.theme-dark` + cookie |
| Reading mode (focus + simplified) | ✅ **Shipped** | ✅ `focus_mode` + `simplified_layout` | WAI-COGA Obj. 5 / Adaptation | ✅ `.reading-mode` cookie mode (calmer layout; no content hidden) |
| Link-underline toggle | ✅ **Shipped** | — | 1.4.1 Use of Colour | ✅ `.underline-links`, CSS-only |
| Flash/sound/vibration/autoplay/timeout controls | N/A | ✅ (native/app) | 2.2.x / 2.3.x | N/A on a zero-JS static page |

**Colour theme — why it's a choice, never a forced default.** Dark mode causes
**halation** for the ~47% of people with astigmatism but relieves
photophobia/cloudy-media users; NN/g finds users split roughly in thirds. So we
offer **system / light / dark** and default to **system** (follow the OS), which
preserves prior behaviour so no OS-dark user regresses. `[medium, 3-0]`
Implementation reuses the **already-shipped** dark palette (previously only under
`prefers-color-scheme`), so there is no new contrast risk — the same colours,
now explicitly selectable, plus a verified dark-**and**-high-contrast path
(white on dark, never black on dark).

**What Access Atlas already does better — keep it.** The OpenDyslexic evidence
is damning: Wery & Diliberto (2017, *Annals of Dyslexia*) found **no**
improvement and in one task *reduced* reading speed/accuracy (−49% to −89%, no
participant preferred it); Kuster et al. (2018) found the same for Dyslexie.
Our honest **"more legible"** (not "dyslexia-fixing") label is vindicated by the
literature. Evidence is genuinely contested (a minority adult-comprehension
study exists) — which is *exactly* why "offer as a choice + non-curative label +
tune with dyslexic co-designers" is the correct posture. `[high, 3-0]`

## 5. Anti-patterns to avoid (all evidence-backed)

- **Accessibility overlay / auto-remediation widget** — the single most
  important guardrail. The Overlay Fact Sheet (570+/800+ practitioner endorsers
  incl. Deque/WebAIM) states full compliance *cannot* be achieved by an overlay;
  its controls are "at best redundant" with users' own OS/AT; and it cannot
  reliably fix alt text, form labels/focus, keyboard, or framework-driven
  (React/Angular/Vue) content. Reinforced by WebAIM's survey (67% ineffective;
  72% among disabled respondents) and the **FTC action against accessiBe**.
  Access Atlas already complies — this section is the citation file. `[high, 3-0]`
- **Single overall star rating** — validate per attribute (§4).
- **Map-only interface** — the list is the equivalent, and comes first.
- **Unverified "verified" labels** — the honest-labeling vocabulary prevents this.

## 6. Roadmap (fits Astro / zero-JS / cookie-backed)

1. **Colour-theme toggle** — ✅ done in this change (`settings.ts` `theme` field,
   `.theme-*` classes in `global.css`, control in `settings.astro`, unit tests,
   all four combos verified in the browser).
2. **Filter-a-list** pattern when search/filters land (native controls + Apply).
3. **Link-underline toggle** + **reading mode** — ✅ done. "Always underline
   links" (`.underline-links`, WCAG 1.4.1) and "Reading mode" (`.reading-mode`:
   narrower measure, flat surfaces, decorative chrome dropped — our single
   zero-JS control covering KA's `focus_mode` + `simplified_layout`; nothing is
   hidden, only quietened). Both cookie-backed, verified in the browser.
4. **Accessible-map contract** documented *before* the map is built.
5. **Manual AT testing plan** — automated tools catch only ~30–40%
   (GOV.UK cites ~30%; our own docs say ~40%; CI currently runs only
   `@axe-core/playwright`). Budget NVDA / VoiceOver / switch testing and paid
   disabled co-designers to tune the contested items (font, dark mode, reading
   mode). `[high, 3-0]`

## 7. Open questions

Answered by reading KA:

- **KA's suite** = `color_theme` (light/dark/high-contrast), `text_size`,
  `line_spacing`, `dyslexia_font`, `large_targets`, `reduce_motion`,
  `focus_mode`, `simplified_layout`, + native-only controls. Its `theme.css`
  uses `--ka-*` design tokens.
- **Theme model** → we chose three-way (`system`/`light`/`dark`) keeping contrast
  independent, diverging from KA's combined enum for more capability (§2).

Still open:

- **Shared token contract.** KA uses `--ka-*` tokens; Access Atlas uses its own
  `--color-*`/`--brand-*` set. If `packages/ui` ever ships a real shared token
  contract, reconcile names then — not before (BAS ADR-002: reference by URL,
  don't couple prematurely).
- **`focus_mode` / `simplified_layout` semantics** — match KA's exact behaviour
  or define our own zero-JS server-rendered version? (Reading-guide bars and
  per-element focus dimming need client JS and would strain the no-JS mandate;
  a simplified single-column layout does not.)
- **Manual AT + co-designer plan** for the contested items specifically.

## 8. Sources (primary / authoritative)

- Overlay Fact Sheet — <https://overlayfactsheet.com/en/>
- W3C WAI-COGA Design Guide (personalization; objectives) — <https://w3c.github.io/wai-coga/coga-draft/guide/overview>
- W3C "What's New in WCAG 2.2" — <https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/>
- W3C WCAG2ICT (applies WCAG to non-web software; relevant to the Capacitor track) — <https://w3c.github.io/wcag2ict/>
- GOV.UK Design System — accessibility strategy & colour — <https://design-system.service.gov.uk/accessibility/accessibility-strategy/>
- MOJ/GOV.UK "Filter a list" pattern — <https://design-patterns.service.justice.gov.uk/patterns/filter-a-list/>
- Minnesota IT accessible interactive maps guide — <https://mn.gov/mnit/media/blog/?id=38-645700>
- Leaflet accessibility — <https://leafletjs.com/examples/accessibility/>
- Wery & Diliberto (2017), *Annals of Dyslexia* (OpenDyslexic) — <https://pmc.ncbi.nlm.nih.gov/articles/PMC5629233/>
- Dyslexia-font evidence overview — <https://www.edutopia.org/article/do-dyslexia-fonts-actually-work/>
- Dark mode readability (not for everyone) — <https://www.boia.org/blog/dark-mode-can-improve-text-readability-but-not-for-everyone>
