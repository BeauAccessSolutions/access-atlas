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
npm run test:a11y    # build + axe-core accessibility tests  <- required in CI
npm run test         # alias for test:a11y

# Database (optional; needs Docker + Supabase CLI via npx)
npm run db:start     # local Postgres + migrations + seed
npm run db:reset     # re-apply migrations and re-seed
npm run db:stop
```

Note: there is no separate unit-test suite yet; the validation formula is
currently exercised through the seed + a11y build. Add unit tests for
`src/lib/labeling.ts` and the consensus logic when the contributor write flow
lands.

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
- ✅ **Submission flow** → **one shared flow** with a Place/Provider toggle and branching provider fields. (Data model is unified; UI not yet built.)
- ✅ **Contributor auth mechanism** → the platform **Keycloak** IdP (pseudonymous), not hand-rolled. Public browsing stays account-free; identity gates contribution only. See §15 and `docs/platform-membership.md`. (The broader pseudonymous-contribution UX design is still open.)

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
