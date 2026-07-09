# CLAUDE.md

Project memory for Claude Code. Read this fully at the start of every session. The rules in **Non-Negotiables** and **What NOT to do** override convenience, speed, and default patterns. When in doubt, choose the more accessible, more private, more conservative option and leave a note.

> **Name: Access Atlas** (chosen 2026-07-07). Earlier candidates: "Wayfound"; "Verified by Us" was rejected because a name asserting "verified" conflicts with the honest-labeling non-negotiable (§2, §4) and raises platform-claim liability (§7).

---

## 1. What we're building

A disability-focused discovery platform with three connected parts:

1. **Providers** — a directory of service/health providers along two axes that both matter: providers who are **disability-literate/competent** (they serve disabled people well) *and* providers who are themselves **disabled-owned or disabled-led** (representation). A provider can be tagged as either or both.
2. **Places** — a directory of **accessible businesses and physical spaces**.
3. **Community validation** — the layer that ties it together: first-person disabled experiences (structured ratings, comments, photos) that validate listings, modeled on iNaturalist's graduated consensus but **made deliberately more conservative because the stakes here are physical safety, not a data label.**

Parts 1 and 2 are the directories. **Part 3 is the moat** — no existing product combines all three, and the honest, lived-experience validation layer is what makes the directories trustworthy. Build accordingly: the validation model is core, not a feature.

**Positioning line (the through-line for every decision):**
> Accessibility tools built *with* the community, not sold *to* it.

**Ethos:** built with the community not for it; privacy-first; built in the open; validated by the people who use it. "Nothing about us without us" is a build principle, not a slogan — it governs who tests, who's weighted in validation, and what we refuse to ship.

---

## 2. Non-Negotiables (the project constitution)

These are hard constraints. Do not violate them to hit a deadline or simplify an implementation. If a requirement forces a trade-off against one of these, stop and flag it.

- **Accessibility is existential.** A disability platform that isn't itself accessible is a fatal failure. WCAG 2.2 AA is the floor, not the target (see §5). Every feature must be usable by screen-reader, keyboard/switch, and cognitive-access users *before* it ships.
- **Privacy-first and verifiable.** Collect the minimum. Never require a user to disclose disability *type*. No third-party trackers. Prefer no-account browsing and pseudonymous contribution. Claims like "no data collected" must be literally true and checkable (see §6).
- **Safety-first validation.** A wrongly-validated "step-free entrance" can strand or endanger someone. Never label unverified data as trustworthy. Favor the cautious reading (see §4).
- **Honest labeling, always.** Unconfirmed listings read "self-reported / awaiting verification." Never "high confidence," never "verified," until the community threshold is met.
- **Never build an accessibility overlay.** No auto-remediation widget that claims to "fix" sites for all visitors. The disability community rejects these (the Overlay Fact Sheet). Anything we build acts *for the individual user on their device* or *helps developers do real remediation* — never a magic site-wide fix.
- **Lived experience is weighted.** In validation, first-person disabled reviewers outrank third-party observers for the access dimension they speak to. This is an intentional, safe departure from one-person-one-vote.
- **Built in the open.** Default to open source and public decision-making unless there's a privacy reason not to.

---

## 3. Scope & rollout

- **Frame:** New York State (one jurisdiction, one ILC network, state funders).
- **Launch:** dense in **Western New York (Buffalo / Erie County)** first — a beachhead, not a soft nationwide launch. Density in one region beats thin coverage everywhere; thin data is the #1 killer of platforms like this.
- **Anchor partner:** Western New York Independent Living (WNYIL), Buffalo — provider/reviewer recruitment and credibility.
- **Expansion:** region by region along the NYAIL Independent Living Center map (Rochester → Syracuse → Albany → NYC), only after the prior region hits a density threshold (target ~200 validated listings). **Do not build NYC-scale assumptions into the MVP.**
- **MVP segment discipline:** do not try to serve every disability everywhere at once. Structure the schema to support all disability types, but seed and validate narrowly first.

---

## 4. The validation model (safety-critical — read carefully)

Inspired by iNaturalist's Casual → Needs ID → Research Grade consensus system, but **more conservative** because errors here have physical consequences.

**Rules:**
- **Attribute-level, not overall-star.** Validate each specific claim separately ("entrance has zero steps," "accessible restroom present," "height-adjustable exam table"). Never collapse accessibility into a single star average — that's the specific failure of existing tools (e.g., AXS Map).
- **Evidence required.** Each objective attribute claim should carry a photo (entrance, restroom doorway, ramp, equipment). Photos are the evidence base, exactly as media are on iNaturalist.
- **Higher consensus bar than iNaturalist's 2/3.** Require **≥3 independent first-person confirmations** before an attribute flips to "community-verified." Two agreeing users is not enough for a safety claim.
- **Weight first-person disabled reviewers.** A wheelchair user's assessment of step-free access outweighs an ambulatory reviewer's for that attribute. Capture an optional reviewer-identity tag (e.g., "I use a wheelchair," "I am Deaf") and use it to weight the relevant dimension — never to expose the individual.
- **Favor dissent on safety.** A single credible "this is NOT accessible" report **freezes or downgrades** the claim pending re-review. The cost of a false positive is borne by a user's body; bias toward caution.
- **Time-decay / re-verification.** Physical access facts expire (ramps break, elevators fail, tables get removed). Attach a "last confirmed" date to every attribute and surface staleness; prompt re-confirmation on a cadence. This is a mechanic iNaturalist doesn't need and we critically do.
- **Anti "trigger-happy agreeing."** Contributors confirm by answering the specific structured question *from their own visit*, not a one-click "me too."

**Labeling states (the only allowed vocabulary):**
`self-reported / awaiting verification` → `N community confirmations` → `community-verified`.
A separate `sourced` state may apply when backed by a certification, audit, or partner org. **"High confidence" is reserved for `sourced` only — never for self-reported data.**

---

## 5. Accessibility engineering rules

**Standard:** WCAG 2.2 AA minimum. "Beyond compliance" means: screen-reader-first (designed, not retrofitted), full keyboard/switch operability, plain-language + cognitive accessibility, captioned media, low-bandwidth mode, and user-customizable UI (text size, contrast, reduced motion).

**Architecture:**
- **List-first, map-second.** The map is a progressive enhancement. Every map result set must have a fully equivalent, accessible **list/table view** that works with zero map interaction. Never ship a map-only interface.
- **Map failure modes to avoid:** unreachable/unlabeled pins, filter panels not announced to screen readers, drag-only interactions, infinite scroll that breaks keyboard focus. If maps are used (Leaflet/MapLibre), every pin must have an accessible name and keyboard path; paginate instead of infinite-scrolling.
- **Semantic HTML before ARIA.** Use native elements; reach for ARIA only when semantics can't express it. No div-soup.
- **Every form field has a visible label** (not placeholder-only), keyboard navigation, and text-based errors (not color alone).

**Testing (part of "done"):**
- Automated: `axe-core` in CI; Playwright/Lighthouse a11y assertions.
- **Automated scanners catch ~40% of issues** — manual assistive-tech testing (NVDA, VoiceOver) is required before shipping any user-facing feature.
- **Paid disabled co-designers/testers** across mobility, blind/low-vision, Deaf/HoH, cognitive, and neurodivergent users, from prototype stage. Not tokenism, not volunteers-only.

---

## 6. Privacy & data rules

- **Data minimization is the default.** If a field isn't essential, don't collect it.
- **Never require disability type** from providers-as-owners or from reviewers. Owners self-attest they qualify; nothing more.
- **Pseudonymous contribution.** Reviewers can post without exposing their specific condition. The identity tag used for validation weighting (§4) is coarse, optional, and never publicly tied to a person.
- **No third-party trackers.** No analytics that phone home to ad networks. If analytics are needed, self-hosted and privacy-preserving.
- **Treat access/disability data as sensitive** (health-adjacent). Comply with CCPA/CPRA-style rights: export and deletion.
- **Verifiability:** any public privacy promise must be backed by the actual implementation (on-device where claimed, open code where claimed).

---

## 7. Legal & trust rules

- **UGC reviews:** third-party review content is broadly protected under Section 230; the reviewer, not the platform, owns their statement. Still, moderate for fake listings, brigading, and stale data.
- **Honest disclaimers, mirroring the LGBTQ+ Healthcare Directory model:** state clearly that listings are self-reported/community-sourced, that the platform doesn't individually verify at sign-up, and that it can't guarantee an experience or outcome. Keep platform-*generated* claims minimal and evidence-backed — a badge *we* confer carries more liability than a fact a user reports.

---

## 8. Provider competence schema

Ground "disability-literate" in evidence, not vibes. Backbone sources:

- **ADHCE Core Competencies on Disability (2019)** — six domains: (1) contextual/conceptual frameworks on disability; (2) professionalism & patient-centered care; (3) legal obligations (ADA, Rehab Act); (4) teams & systems-based practice; (5) clinical assessment; (6) care across the lifespan/transitions. Use these to derive self-attestation and rating questions.
- **ADA Medical Diagnostic Equipment (MDE) attributes** — objective, photo-verifiable: height-adjustable/low-transfer exam table, wheelchair-accessible weight scale, accessible entrance/restroom/parking. Note compliance deadlines (HHS-funded providers July 8 2026; ADA Title II state/local Aug 9 2026) — a recruitment and PR hook.
- **Self-attestation model** — adapt the LGBTQ+ Healthcare Directory's checkbox-affirmation flow (provider agrees to a set of competence statements at sign-up), layered with community validation.

**Ratable dimensions split into:** (a) provider self-attested affirmations (ADHCE-mapped), (b) objective facility attributes (community-verifiable, photo-backed, binary), (c) community-rated behaviors from first-person visits ("communicated directly with me," "didn't assume my quality of life," "staff knew how to use accessible equipment") — each rated per-dimension, never as one blurry average.

---

## 9. Tech stack (PROPOSED — confirm before scaffolding)

Nothing here is locked. Optimize the choice for accessibility ceiling, low-bandwidth performance, and privacy.

- **Framework:** Next.js (React) for SSR + interactivity, **or** Astro if we want to ship less JS (better perf/a11y; fits a static-first background). Decide based on how dynamic the contributor flows are.
- **Accessible UI primitives:** React Aria (Adobe) or Radix UI — do not hand-roll interactive widgets.
- **Styling:** semantic HTML first; Tailwind acceptable only if paired with real semantics.
- **Maps:** Leaflet or MapLibre with documented a11y patterns, always behind an equivalent list view (§5).
- **Data/back end:** minimal. Postgres (e.g., via Supabase) with strict data-minimization, *or* start form-submission + static until validation flows are proven.
- **Auth:** minimize. Public browsing needs no account; light auth only for contributors; pseudonymous.
- **Hosting/CI:** Netlify or Vercel; `axe-core` + Playwright in CI.

> ⚠️ **No-code note:** an MVP could be built on Bubble (chosen for its greater control over semantic HTML/ARIA than most no-code tools) to validate demand before custom engineering. If this repo *is* the custom build, we've already made that decision — confirm.

---

## 10. Commands

```
npm install          # install deps
npx playwright install chromium   # one-time, for the a11y tests

npm run dev          # dev server at http://localhost:4321
npm run build        # build static site to dist/
npm run preview      # preview the built site
npm run check        # type-check (astro check) — also the lint step
npm run lint         # alias for check
npm run test:unit    # vitest — labeling vocabulary + consensus formula (§4/§14)
npm run test:a11y    # build + axe-core accessibility tests  <- required in CI
npm run test         # unit + a11y

# Database (optional; needs Docker + Supabase CLI via npx)
npm run db:start     # local Postgres + migrations + seed
npm run db:reset     # re-apply migrations and re-seed
npm run db:stop
```

Unit tests (`tests/unit/`, vitest) cover the safety-critical core: the labeling
vocabulary (§4/§14 — only `sourced` may say "high confidence"; self-reported is
never "verified") and the consensus formula mirror (all five states, the ≥3 +
weighted bar, dissent-freezes, time-decay). The SQL side of that formula is
verified against real Postgres via `supabase db reset` + the seeded states.

---

## 11. Conventions

- Small, reviewable PRs. Every user-facing change includes an a11y check in the description (keyboard path, screen-reader label, contrast).
- Accessibility and privacy notes belong in code comments where a future reader might otherwise "optimize" them away.
- Prefer boring, legible code over clever code — contributors may be community members, not senior engineers.
- Plain-language commit messages and docs (an accessibility practice, not just style).

---

## 12. Glossary

- **Disabled-owned:** a disabled person holds **≥ 51% ownership** of the business/practice. **Disabled-led:** a disabled person holds **primary leadership / decision-making** (a control test, not an ownership percentage). The two are independent and separately attested. **Self-attested — no medical proof, ever** (resolved 2026-07-07).
- **Disability-literate / disability-competent:** serves disabled people well per the ADHCE competencies. Distinct from disabled-owned; a provider may be either or both.
- **Self-reported → community-verified:** validation states from §4. Never conflate.
- **Sourced:** backed by certification/audit/partner — the only state that may carry "high confidence."
- **First-person confirmation:** a validation from someone reporting their own visit and, optionally, their own relevant access identity.

---

## 13. Open decisions (resolve, don't assume)

**Resolved (2026-07-07):**
- ✅ **Project name** → **Access Atlas**.
- ✅ **Framework** → **Astro + React islands**, **custom build** (not Next.js, not no-code).
- ✅ **"Disabled-owned" threshold & wording** → self-attested **≥ 51% ownership**; **"disabled-led"** is a separate **control/leadership** attestation. No proof, ever. (§12)
- ✅ **Re-verification cadence** → **uniform 12 months** (`reverify_interval_days = 365`) for every attribute. Column stays per-attribute so a future tiered policy is a data change, not a migration.
- ✅ **Submission flow** → **one shared flow** with a Place/Provider toggle and branching provider fields. Built: `src/pages/contribute/submit.astro` + `src/pages/api/listings.ts`. New listings start `self-reported`; the submitter may self-report attributes (creates claims, not confirmations).
- ✅ **Contributor auth mechanism** → the platform **Keycloak** IdP (pseudonymous), not hand-rolled. Public browsing stays account-free; identity gates contribution only. See §15 and `docs/platform-membership.md`. (The broader pseudonymous-contribution UX design is still open.)

**Resolved (2026-07-08) — schema gaps surfaced by the WNY seed research (`research/seed-nys/gaps.md`):**
- ✅ **Representation lives on the listing, not the provider.** `disabled_owned` / `disabled_led` were **hoisted from `provider_profiles` onto `listings`** (migration `0004`) so a disabled-owned **place** (e.g. Fly By Cafe) can carry them. `disability_literate` stays provider-only. Orthogonal to the consensus formula. (Gap A)
- ✅ **`accessible_parking` applies to both kinds** (`applies_to_kind = null`) — §8b treats provider parking as objective too. (Gap B)
- ✅ **New objective attribute `accessible_scale`** (wheelchair-accessible scale, provider, ADA MDE §8). Zero seed claims by design — a first-person/recruitment target. (Gap C)
- ⏳ **Deferred:** an `automatic_doors` key (folds into step-free evidence for now) and dental/imaging keys (revisit as a general `patient_transfer_lift` if dental becomes a segment). (Gaps D + dental)

**Resolved (2026-07-08) — a11y crossover audit Tier 1 (`docs/a11y-crossover-audit.md`):**
- ✅ **Accessibility settings are cookie-backed and zero-JS.** A `<form>` POSTs to `src/pages/api/settings.ts`, which sets one first-party **httpOnly functional** cookie (`aa_settings`); `src/layouts/Base.astro` reads it per request and stamps a class + CSS vars on `<html>`. No account, no client script, no third party. Model + encoding live in one place: `src/lib/settings.ts`. Settings: text size, line spacing, contrast, reduce-motion, larger targets (44px), font.
- ✅ **Browsing pages render on-demand, not static.** Home + `/about/*` joined places/providers as `prerender = false` so the settings cookie applies **uniformly** (a setting that took hold on `/places` but not `/` reads as broken). Still zero-JS server-rendered HTML — the low-bandwidth budget is unchanged. `output: 'static'` stays; pages opt in per-file.
- ✅ **Dyslexia-font question (audit §D) → offer the choice, don't pick one.** Font is a 3-way: `system` / `readable` (wide legible **system** stack, zero download) / `dyslexic` (**self-hosted** OpenDyslexic in `public/fonts/`, SIL OFL). Self-hosting satisfies CSP `font-src 'self'`; the `@font-face` is inert until `.dyslexic-font` is on `<html>`, so **only users who choose it download the ~115KB** — everyone else pays nothing (§5). Honest label: called "more legible", never "dyslexia-fixing" (§4). Real dyslexic co-designers should tune this later.
- ✅ **Inline form errors + target size.** Field-level errors via `aria-invalid` + `aria-describedby` (submit form's name field), required marker = visible `*` (aria-hidden) + `.sr-only` "(required)". WCAG 2.2 §2.5.8: 24px baseline hit area, 44px under the "larger targets" setting. Added the missing `.sr-only` utility and `/about/accessibility` statement page.

**Resolved (2026-07-08) — a11y crossover Tier 2 + Tier 3:**
- ✅ **Tier 2 (polish).** Print styles (`@media print`: drop nav/footer chrome, black-on-white, `break-inside: avoid` so a listing/claim row never splits across a page break); `aria-atomic="true"` on every `role=status/alert` banner; verified text inputs / `select` / `textarea` compute to ≥16px (no iOS focus-zoom); richer WNY-aware empty states on the list pages.
- ✅ **Tier 3 (the one buildable now).** `/about/help` — a plain-language glossary + how-to-read + FAQ (cognitive access, §5). The FAQ uses native `<details>`/`<summary>`: zero-JS disclosure, keyboard + `aria-expanded` for free — and it lands the exact pattern Tier 3 flags for filter panels. Linked from nav + footer. (Note: style `summary` with `display:list-item`, never `flex` — flex drops the disclosure triangle and collapses the summary width.)
- ⏳ **Tier 3 (still feature-gated — build when the feature lands).** Photo alt-text + alt-required (needs evidence-photo upload/render); `<details>` filter panels (needs search/filters — pattern now proven on the help page); sensitive-data consent copy beyond the identity-tag explainer. ✅ **Destructive-action confirmation landed 2026-07-09** with the self-service delete flow (typed word in a labeled field, zero-JS — `/account/delete/`).

**Decided (2026-07-08) — native / TestFlight track (revisits the earlier "defer native" lean):**
- ▶️ **Pursuing an iOS TestFlight build via a Capacitor wrapper, browse-first.** An Apple Developer Program account now exists. TestFlight requires a real native binary (a PWA can't go to TestFlight), so the least-divergent route is a **Capacitor/WKWebView wrapper** around the existing web app — it keeps the zero-JS, low-bandwidth, a11y-first browsing surface (§5, §15) instead of a React Native rewrite (§15 forbids rewriting the browsing pages).
- **The webview loads the hosted site** (browsing is on-demand SSR, so the app needs the server reachable) — this couples the mobile track to the still-open hosting decision below.
- **Two gates:** *internal* TestFlight needs no review → reachable now with a bare wrapper. *External* TestFlight needs Beta App Review, which enforces **App Review Guideline 4.2 (minimum functionality)** — a wrapper that's "just a website" gets rejected. The native value-add that clears 4.2 is **camera-based evidence-photo capture** (`@capacitor/camera`), which is itself downstream of building the (deferred) evidence-photo feature (§4).
- **Scaffold lives in the repo** (`capacitor.config.ts`, `mobile/` offline fallback; config excluded from the web typecheck). Capacitor deps are **not** pre-installed and the native `ios/` project is **not** committed — both are created on a Mac in Phase 2 (`npm install @capacitor/*`, then `npx cap add ios`; needs Xcode + CocoaPods), so the web lockfile / CI stay clean. See `docs/ios-testflight.md`. If any App Store rule ever conflicts with a non-negotiable here, the more conservative rule wins (§15) and it's raised as a BAS ADR.

**Decided (2026-07-08) — contributor auth (Keycloak) built drop-in via a server-side BFF:**
- ▶️ **OIDC Authorization-Code-+-PKCE runs server-side (BFF), not a React island.** Tokens never reach the browser; the contribute pages stay zero-JS (sign-in is a plain link, sign-out a form POST). This diverges from §15's `packages/auth` island — rationale in `docs/auth-bff-decision.md` (→ BAS ADR). Flow lives in `src/pages/api/auth/{login,callback,logout}.ts`; JWKS verify + revocable session in `src/lib/auth/{config,oidc,verify,session}.ts` (uses `jose`).
- ▶️ **Layered sessions (invariant #1):** validate the ID token against Keycloak's JWKS, then mint the app's OWN revocable session — a `contributor_sessions` row (migration `0006`) keyed by a SHA-256 of the cookie token (raw token never stored). Contributors keyed by the pairwise `sub` (`contributors.sub`, unique).
- ▶️ **The seam is one function:** `resolveContributor` (`src/lib/contributor.ts`) — verified session → else Keycloak-configured means `need_signin` → else provisional (if `ALLOW_PROVISIONAL_CONTRIBUTIONS`) → else refuse. **Config-gated:** unset `KEYCLOAK_*` = behavior identical to today, so nothing turns on by accident.
- ⏳ **Blocked on the platform IdP standup + Phase B:** register the OIDC client on Keycloak (steps in `docs/platform-membership.md`); then narrow service-role writes to RLS-scoped sessions and add step-up (ACR — attach point marked in `src/pages/api/account/delete.ts`).

**Resolved (2026-07-09) — the self-service data-rights door (the last deferred half of invariant #3 / §6):**
- ✅ **Built at `/account/`** — see what we hold (display name + counts), download it (`POST /api/account/export`, immediate JSON attachment, `Cache-Control: no-store`), or delete it (`/account/delete/` → `POST /api/account/delete`). Zero-JS, on-demand, linked from the footer and `/about/privacy`. Gated by `getAccountContributor` (`src/lib/contributor.ts`): a verified Keycloak session, else the provisional cookie only when explicitly enabled — never creates a contributor, never resurrects a deleted one from a stale cookie, and can only resolve to *yourself*. POST-only endpoints (SameSite=Lax cookies don't ride cross-site POSTs).
- ✅ **One deletion implementation, two doors.** The endpoints and the ops CLI both call `src/lib/data-rights.ts`. Self-service never purges submitted listings (community safety data — the purge stays an ops-only override). Deletion requires typing “delete” (`confirmsDeletion`, case/whitespace-tolerant on purpose — §5 cognitive access). §4 side effects (a departing dissent un-freezing a claim) are logged for re-review, never silent — verified end-to-end against local Postgres (dissent froze the seeded claim → self-delete un-froze it → warning logged with the claim id).

**Still open:**
- **Exact consensus count & reviewer-weighting formula.** Held at the working floor: ≥3 independent agreeing confirmations, ≥1 carrying the attribute's relevant lived-experience tag, any first-person dissent freezes the claim. Encoded in BOTH `supabase/migrations/0001_init.sql` (the `attribute_claim_status` view) and `src/lib/seed.ts` — **change them together.** Revisit once real contributions exist and the tag-weighting can be tuned against data.
- **Entity/hosting for data** (ties to the hybrid nonprofit + PBC org structure). This is an org/legal decision, not a code one — defer to a dedicated conversation.

---

## 14. What NOT to do (guardrails)

- ❌ Do **not** build or resemble an accessibility overlay / auto-remediation widget.
- ❌ Do **not** label self-reported data as "verified" or "high confidence."
- ❌ Do **not** collapse accessibility into a single overall star rating.
- ❌ Do **not** require, request, or store a user's specific disability/diagnosis.
- ❌ Do **not** ship a map-only interface, or any interactive widget that fails keyboard/screen-reader use.
- ❌ Do **not** add third-party trackers or analytics that share data externally.
- ❌ Do **not** design for nationwide/NYC scale in the MVP — WNY density first.
- ❌ Do **not** treat automated a11y passing as "accessible" — manual AT testing is required.
- ❌ Do **not** make trust claims the implementation can't verify.

---

## 15. Platform membership (Beau Access Solutions)

Access Atlas is a member app of the **Beau Access Solutions (BAS)** platform.
Governance (identity architecture, the five platform invariants, contribution
boundary) lives in a separate repo and is referenced by URL, never by path:
<https://github.com/Beaudoin0zach/Beau-Access-Solutions>. Local pointer + the
invariants fallback: [`docs/platform-membership.md`](docs/platform-membership.md).

Role: **full identity member**, scoped honestly to how this app works —

- **Browsing stays account-free** (§2, §6). The platform never overrides that.
- **Identity gates contribution only.** When the contributor write flow lands, it
  authenticates via the platform **Keycloak** IdP (pseudonymous), not hand-rolled auth.
- **Sensitive tenant, layered sessions.** Access/disability data is health-adjacent
  (§6); Access Atlas exchanges the identity token for its own revocable Supabase
  session and applies step-up — the identity token is never a data credential.
- **Browsing surface stays Astro / near-zero-JS.** Shared design system = a11y tokens +
  the `packages/auth` PKCE client inside React islands (contributor flows), NOT a React
  Native rewrite of the static browsing pages. Low-bandwidth + a11y are existential (§5).

If a platform rule ever conflicts with a non-negotiable here, the more conservative
(more accessible, more private) rule wins and the conflict is raised as a BAS ADR.
