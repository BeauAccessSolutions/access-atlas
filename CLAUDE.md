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
- **List-first, map-second.** The map is a progressive enhancement. Every map result set must have a fully equivalent, accessible **list/table view** that works with zero map interaction. Never ship a map-only interface. (The one scripted browsing feature — on-device "sort by distance" on the two list index pages — is exactly this kind of enhancement: the list works fully without it, and the visitor's location never leaves the device. Scoped CSP carve-out + rationale: [`docs/adr-0001-nearby-geolocation.md`](docs/adr-0001-nearby-geolocation.md).)
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
- ⏳ **Tier 3 (still feature-gated — build when the feature lands).** `<details>` filter panels (needs search/filters — pattern now proven on the help page); sensitive-data consent copy beyond the identity-tag explainer. ✅ **Destructive-action confirmation landed 2026-07-09** with the self-service delete flow (typed word in a labeled field, zero-JS — `/account/delete/`). ✅ **Photo alt-text + alt-required landed 2026-07-09** with evidence-photo rendering (below).

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

**Resolved (2026-07-09) — evidence photos are now VISIBLE (§4 "photos are the evidence base"):**
- ✅ **Rendering:** listing detail pages show photo evidence under each claim (`AttributeList`, via `repo.getEvidenceForListing`) — thumbnail inline, full photo a plain link, dissent photos labeled "Problem reported", capped at 4/claim with an honest "+N more" note (§5 low-bandwidth). Public read path is the `evidence_photos` view (migration `0007`): ONLY photo fields + a coarse DATE, never notes/tags/contributor ids — the confirmations privacy boundary (§6) is unchanged, verified as role `anon` against real Postgres.
- ✅ **Alt text is part of the evidence:** `photo_alt` required whenever a photo is attached (endpoint-enforced, honest `alert` banner) — the Tier 3 alt-required rule. A ~320px thumbnail is generated in the same sharp pass (`photo_thumb_url`); self-service/ops deletion removes BOTH storage objects (unit-tested, verified zero orphans end-to-end).
- ✅ **CSP nuance:** `img-src https:` covers prod Supabase; a non-https (local dev) storage origin is appended to `img-src` only when configured — shipped policy unchanged (`src/lib/security.ts`).
- ▶️ **Unblocks** the iOS App Review 4.2 camera value-add (§13 TestFlight track).

**Resolved (2026-07-11) — evidence-photo moderation, first cut (§13; §4/§6):**
- ✅ **Ops-only photo redaction built** — `src/lib/moderation.ts` `redactEvidencePhoto` + `scripts/moderate-photo.mjs` (`npm run moderate:photo`, `--dry-run`, typed-word confirm). Removes BOTH storage objects and nulls the confirmation's photo columns, so the public `evidence_photos` view (`where photo_url is not null`, migration 0007) excludes it — **no schema change**. Reuses the deletion primitives (`storagePathFromPublicUrl`), one implementation, unit-tested.
- **Deliberate scope:** redaction is **photo-level** — it KEEPS the contributor's yes/no visit report, because scrubbing a bad image is not a confirmation-level takedown (that would change §4 consensus and must be its own decision).

**Resolved (2026-07-12) — the DB path is now verified, and the audit trail landed:**
- ✅ **The redaction DB path is verified against real Postgres + Supabase Storage** (Docker was finally available). Seeded a confirmation with a real evidence photo → `--dry-run` is a true no-op → a real run removes both storage objects (zero orphans), drops the photo from the `evidence_photos` view, and leaves the `agrees` vote / identity tags / visit date untouched → re-run is idempotent. A latent runtime bug was fixed en route: the ops CLI imports the real `.ts` modules under Node type-stripping, but Node couldn't resolve the app's extensionless relative imports — an ops-only resolve hook (`scripts/lib/ts-ext-resolve.mjs`) closes that gap without touching app source.
- ✅ **`moderation_audit` table built** (migration `0008`) — every moderation action is now recorded in-DB, not just in terminal scrollback (§7 accountability). **Append-only** (service_role gets INSERT + SELECT only — verified UPDATE/DELETE are denied), **ops-only** (RLS + no anon grant — verified `anon` read is denied), and it **stores no `contributor_id`** (§6 data minimization: the audit is about the moderated *content*, not the person; content ids are plain uuids with no FK so a row survives the deletion of what it describes — verified). Written by `recordModerationAudit` in `moderation.ts`; `redactEvidencePhoto` now returns its `auditId`.
- ✅ **Confirmation-level takedown built** — `takedownConfirmation` in `moderation.ts` + `scripts/takedown-confirmation.mjs` (`npm run moderate:takedown`, `--dry-run`, typed-word `takedown` confirm). The HEAVIER action, deliberately separate from photo redaction: it **deletes a fraudulent confirmation**, which **changes §4 consensus**. It removes the confirmation's evidence photos from storage first, deletes the row, then **recomputes the claim's state from `attribute_claim_status`** (the one source of truth — never re-derives the formula) and **surfaces the affected claim for re-review** (`affectedClaimIds`, mirroring `deleteContributorData`), recording before/after in the audit. Migration `0009` grants `service_role` read on the status view (it was granted only to anon/authenticated in 0001; exposes nothing new — service_role already reads the underlying rows). Verified against real Postgres both ways: removing the lone dissent **un-froze** `disputed → community_confirmations`; removing an agreeing photo-confirmation dropped `community_verified → community_confirmations` with **zero storage orphans**; idempotent re-run writes no audit.
- ✅ **User-facing "report this photo" surface built — but feature-gated OFF.** A zero-JS `<details>` disclosure under each evidence photo (`AttributeList`) POSTs to `src/pages/api/photo-reports.ts`, which files a row in `photo_reports` (migration `0010`) for ops triage. It renders and accepts reports **only when `contributionsOpen()`** (real auth configured OR provisional explicitly enabled) — today, with contributions closed, the control is absent and a direct POST is refused (`photo_report=closed`). **Reporter-anonymous** (§6): a report stores only the already-public `claim_id` + `photo_url` and a coarse reason **code** from a fixed allow-list — never free text, never who reported. The endpoint validates the photo exists in the public `evidence_photos` view (anon client) before inserting (no arbitrary-URL dumping ground), and `return_to` is sanitized against open redirects. A report is the inbound to-do; acting on it still goes through the ops CLIs → the `moderation_audit` trail. Verified end-to-end against real Postgres + the dev server: gated OFF (no control, POST refused) and ON (control renders, valid report inserts, bad reason → `need_reason`, missing photo → `gone`, `//evil.example` return sanitized to `/`); `anon` cannot read the queue.
- **Nothing in this §13 block remains deferred** — the three follow-ups (audit table, takedown, report surface) are all built and Postgres-verified.

**Decided (2026-07-12) — list-page sort suite, ZIP filter, and on-device "sort by distance":**
- ✅ **Zero-JS sort suite + ZIP filter.** `/places` and `/providers` gained a **Sort by** control (name / ZIP / recently-added) and a **ZIP prefix filter** ("142" = Buffalo area, "14222" = one ZIP) — a `<select>` + text input in the existing GET form, so the state lives in the URL (bookmarkable), still zero-JS. Logic + tests in `src/lib/filters.ts` (`sortListings`, `parseListingFilters`); `Listing` gained `createdAt` (for the recent sort). Sort reorders but never counts as a narrowing filter.
- ▶️ **On-device "sort by distance" is the ONE scripted exception to the zero-JS browsing rule (§2/§5).** A user asked for device geolocation, which needs JS. Built as a **progressive enhancement**: `public/nearby.js` loads **only** on the two list index routes, adds a "sort by distance (use my location)" control, and reorders the list **on-device** — the visitor's location **never leaves the device** (§6): distances are computed in-browser against `data-lat`/`data-lng` on the cards, nothing is sent to the server or a URL. `security.ts` is now **route-aware**: `script-src 'self'` + `geolocation=(self)` on `/places` and `/providers` ONLY; every other route (incl. list *detail* pages) stays `script-src 'none'` + `geolocation=()`. `default-src 'none'` (no `connect-src`) means the script physically can't exfiltrate location. No inline script anywhere. Full rationale + guardrails: [`docs/adr-0001-nearby-geolocation.md`](docs/adr-0001-nearby-geolocation.md) (to be raised as a BAS ADR, §15). Seed listings carry **approximate** Buffalo coordinates (demo only). Verified end-to-end: CSP/Permissions-Policy scoped correctly per route, the enhancement reorders nearest-first with zero network calls, reset + permission-denied paths are honest, and the a11y suite asserts the new contract (list pages ship exactly one external `/nearby.js`, everything else zero `<script>`).
- ✅ **Submit flow now collects optional coordinates** (so real listings can feed the distance sort, not just the seed). `src/pages/contribute/submit.astro` has optional **Latitude/Longitude** fields (with a plain-language how-to-find hint, §5); `src/pages/api/listings.ts` validates + persists them via the pure `parseCoordinates` (`src/lib/geo.ts`, unit-tested): both-or-neither, real-world ranges, a half-filled/out-of-range pair is rejected honestly (`bad_coords`) rather than silently dropped. Verified end-to-end against Postgres: valid pair persists and reaches the card `data-lat`/`data-lng`; bad/half-filled create no listing; blank submits fine.
- ✅ **ZIP-centroid fallback — coordinates without the clunk.** A contributor who leaves lat/lng blank still gets placed in the distance sort: `src/lib/zip-centroids.ts` maps their ZIP to an **approximate** WNY centroid (curated Buffalo/Erie set only — NOT a nationwide ZIP DB, §3/§14). **No third-party geocoder** — an address is never sent out (§6). Precedence: exact typed coords → ZIP centroid → none. Migration `0011` adds `listings.coords_source` (`exact` | `approximate` | null) so the UI labels precision honestly (§4): the on-device distance note reads "0.5 mi away" for exact vs "~1.2 mi away (approx.)" for a ZIP centroid (`ListingCard` emits `data-coords-approx`; `public/nearby.js` renders the two forms). Verified end-to-end against Postgres: ZIP-only submit → approximate centroid coords; typed coords override to exact; a ZIP outside the WNY set → null. **Still open:** a self-hosted geocoder / address search for street-level precision (a bigger infra + external-service decision).

**Resolved (2026-07-23) — claimless listings are no longer a dead end (the first-report flow):**
- ✅ **The gap:** the "Report a visit" CTA was gated on `hasClaims`, and the confirm flow is per-claim — so a listing with zero attribute claims (39 of 75 prod places) offered NO way to start the §4 validation loop. Exactly the listings that most need first-person reports had no report button.
- ✅ **First-report flow built.** `/contribute/report/[listingId]/` is the per-listing report hub (tracked facts → their confirm forms; unreported facts → "be the first"); `/contribute/report/[listingId]/[attributeKey]/` is the first-report form (the shared `VisitReportForm.astro`, extracted from the confirm page — banners in `src/lib/visit-report-banners.ts` so the two doors never drift). POSTs go to the SAME `/api/confirmations` endpoint with `listingId`+`attributeKey` instead of `claimId`: it validates + gates first, then **creates the claim and the visit's confirmation together** — a first report is a real first-person visit, so it counts (starts at "1 community confirmation", or `disputed` for a first-person "no"; §4). This is deliberately different from the submit flow, where a submitter's self-report creates claims with zero confirmations. Claim creation happens AFTER validation (a fixable form error never leaves an empty claim); a first-report race is settled by the `unique (listing_id, attribute_def_id)` constraint (loser re-reads the winner's claim). If a claim already exists, the form page 303s to the canonical per-claim confirm form.
- ✅ **CTA renders on every listing now** (`ReportVisitCta`): with claims, as before plus a "report another accessibility fact" hub link; claimless, honest "Be the first to report" copy → the hub. New routes are on-demand zero-JS; the first-report form carries the same native-camera enhancement + route-scoped CSP carve-out as the confirm flow (`/contribute/report/` prefix in `security.ts`; the hub ships zero `<script>`, asserted in tests). Seed gained a deliberately claimless place (`44444444…`, both `src/lib/seed.ts` and `supabase/seed.sql`) to exercise the mode. Verified end-to-end against local Postgres: photo-required rejection creates nothing; dissent-first → `disputed`; photo confirm → "1 community confirmation" + visible evidence; duplicate → `already`; wrong-kind attribute → `notfound`; claimed-attribute form redirects to confirm. Held at the working floor: ≥3 independent agreeing confirmations, ≥1 carrying the attribute's relevant lived-experience tag, any first-person dissent freezes the claim. Encoded in BOTH `supabase/migrations/0001_init.sql` (the `attribute_claim_status` view) and `src/lib/seed.ts` — **change them together.** Revisit once real contributions exist and the tag-weighting can be tuned against data.
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

---
<!-- Shared cross-project lessons. Edit the canonical file, not here. -->
@~/.claude/shared/LESSONS.md
<!-- BAS-platform-only lessons. Canonical file lives in bas-platform. -->
@~/projects/bas-platform/LESSONS.md
