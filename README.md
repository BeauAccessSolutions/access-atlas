# Access Atlas

A disability-focused discovery platform: **accessible places**, **disability-competent / disabled-led providers**, and a **community validation** layer that labels every claim honestly.

> **Read [`CLAUDE.md`](./CLAUDE.md) first.** It is the project constitution. The
> Non-Negotiables and the validation model (§4) override convenience. This
> README is just how to run the scaffold.

## Stack

- **[Astro](https://astro.build) + React islands** — ships near-zero JS by default; static list/table views render as pure HTML. React only where a contributor flow needs it. (§9)
- **[react-aria-components](https://react-spectrum.adobe.com/react-aria/)** — accessible interactive primitives; do not hand-roll widgets. (§9)
- **Postgres via Supabase** — the real data + the safety-critical validation schema (`supabase/migrations/0001_init.sql`). (§9)
- **Playwright + axe-core** — automated WCAG 2.2 AA gate in CI. (§5)

## Architecture at a glance

- **List-first (§5).** Pages render as accessible lists. There is deliberately no map yet; if one is added it must be a progressive enhancement over the existing list.
- **The validation model is the core (§4).** `supabase/migrations/0001_init.sql` encodes attribute-level claims, the ≥3-confirmation bar, dissent-freezes-the-claim, lived-experience weighting, and time-decay. The derived `attribute_claim_status` view is the single source of truth for state.
- **One labeling vocabulary (`src/lib/labeling.ts`).** Every trust string comes from here. Never hand-write "verified" / "high confidence" in a component.
- **Runs with no database.** When `PUBLIC_SUPABASE_*` are unset, the app serves `src/lib/seed.ts` (which mirrors `supabase/seed.sql`) so you can develop and a11y-test with zero backend. Real data is Postgres.

## Setup

```sh
npm install
npx playwright install chromium   # for the a11y tests
cp .env.example .env               # optional — leave blank to use seed data
```

## Commands (§10)

```sh
npm run dev         # start the dev server (http://localhost:4321)
npm run build       # build the static site to dist/
npm run preview     # preview the built site
npm run check       # type-check (astro check) — also the lint step
npm run lint        # alias for check
npm run test:unit   # vitest — labeling vocabulary + consensus formula
npm run test:a11y   # build + run axe-core accessibility tests (REQUIRED in CI)
npm run test        # unit + a11y

# Database (optional; needs Docker + the Supabase CLI via npx)
npm run db:start    # boot local Postgres + apply migrations + seed
npm run db:reset    # re-apply migrations and re-seed
npm run db:stop
```

To read real data, set `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` in
`.env` (local Supabase prints these on `npm run db:start`).

## Accessibility is part of "done"

- `npm run test:a11y` must pass — but **automated scanners catch ~40% of issues** (§5). Manual assistive-tech testing (NVDA, VoiceOver, keyboard-only) is required before shipping any user-facing feature.
- Every PR should note its keyboard path, screen-reader labels, and contrast (§11).
- User-customizable UI (text size, contrast, reduced motion) is scaffolded in `src/styles/global.css` via CSS custom properties and `prefers-*` media queries.

## Contributing a confirmation (the validation flow)

The core §4 flow is built: from any listing, "Report your visit" opens a zero-JS
form (`/contribute/confirm/<claimId>`) that asks the attribute's structured
question. Submitting records a first-person confirmation or dissent; the derived
`attribute_claim_status` view relabels the claim (≥3 independent agreements →
community-verified; any dissent → disputed).

**Writes are hard-gated.** The endpoint refuses to save anything unless
`ALLOW_PROVISIONAL_CONTRIBUTIONS=true` — a local/preview-only interlock, because
real contributor auth (platform Keycloak) isn't stood up yet. To exercise the
full write path locally:

```sh
npm run db:start     # local Postgres with the schema + seed
# in .env: set PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY,
#          SUPABASE_SERVICE_ROLE_KEY, and ALLOW_PROVISIONAL_CONTRIBUTIONS=true
npm run dev
```

With no DB attached, the form still renders (from seed) and submitting reports
"contributions not open yet" — never a silent failure. Evidence photos are
re-encoded server-side to strip EXIF/GPS before storage (§6). See
[`docs/platform-membership.md`](docs/platform-membership.md).

## Rendering: static shell, on-demand data

Home and privacy prerender to static HTML. The **listing list/detail and the
contribute routes are on-demand** (`prerender = false`, Node adapter) so live
submissions and confirmations show immediately — a static build would go stale
the moment someone contributes. On-demand pages are still **zero-JS
server-rendered HTML** (asserted in the a11y suite), so the low-bandwidth mandate
(§5) holds; they just need the Node server rather than a pure CDN.

## What is intentionally NOT here yet

- No map (list-first; add only as progressive enhancement).
- No real contributor auth — the identity seam is provisional/gated pending platform Keycloak (§6; `docs/platform-membership.md`).
- No full ADHCE self-attestation set on providers yet — only the disabled-literate/owned/led booleans (§8 affirmations are a follow-up).
- Submitter self-reported attributes don't require a photo at submission (they're the lowest-trust `self-reported` state); **photos are required to *confirm*** them (§4).
- No real listings — the seed is tiny and Buffalo/Erie-County-scoped on purpose (§3). Do not seed to NYC/nationwide scale.

## Open decisions that affect this code

See `CLAUDE.md` §13. Resolved so far (2026-07-07):

- **Project name** → **Access Atlas**.
- **Framework** → Astro + React islands; **custom build** (not no-code).
- **"Disabled-owned"** → self-attested ≥51% ownership; **"disabled-led"** is a separate control/leadership attestation. No proof, ever.
- **Submission flow** → one shared flow with a Place/Provider toggle (not yet built).
- **Re-verification cadence** → uniform **12 months** for every attribute (`reverify_interval_days = 365`).

Still open (see §13): exact consensus count is held at the ≥3 working floor (the rule — ≥3 agreeing, ≥1 lived-experience-weighted, any dissent freezes — lives in the SQL view *and* `src/lib/seed.ts`; **change both together**); and the data entity/hosting structure, which is an org/legal decision, not a code one.
