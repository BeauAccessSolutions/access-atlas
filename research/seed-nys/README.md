# WNY seed data (research → review → import)

This folder holds curated seed data for the **Western New York (Buffalo / Erie
County) beachhead** (`CLAUDE.md` §3). It bootstraps the directory so the
community-validation layer (the moat, §4) has something to validate against —
seed data is a starting point, never a substitute for first-person confirmation.

## Workflow

1. **Research** produces one or more `*.seed.json` files here (the background
   research task writes them). Format: [`docs/seed-format.md`](../../docs/seed-format.md).
2. **A human reviews** them — every listing must be real and carry a `source_url`
   (§7). Delete anything unsourced or uncertain (§4: a wrong "step-free entrance"
   can strand someone — omit rather than guess).
3. **Import**, dry-run first:
   ```
   npm run seed:import -- research/seed-nys/<file>.seed.json --dry-run
   npm run seed:import -- research/seed-nys/<file>.seed.json
   ```

## What import can and cannot do

- ✅ Create listings + provider profiles + **self-reported** attribute claims.
- ✅ Mark a claim `sourced` only when it cites a real certification/audit/partner.
- ❌ **Cannot** create community confirmations. Seeded claims read
  **"self-reported / awaiting verification"** and earn their state only from real
  first-person visits through the contribute flow (§2, §4, §14).

## Files

**Raw research batch (source of record — the research task's own shape):**
- `listings.json` / `listings.csv` — 49 candidate WNY records.
- `attributes.csv` — the attribute claims, flat.
- `sources-memo.md` — which sources were used and how reliable each is.
- `gaps.md` — coverage gaps + the schema gaps (A/B/C now resolved) + data-quality flags.

**Import-ready (converted, for review):**
- `convert.mjs` — deterministic converter (raw batch → importer format), applying the
  gaps.md §4 data-quality rules. Re-run: `node research/seed-nys/convert.mjs`.
- `wny-2026-07.seed.json` — the **candidate** import file. 42 listings, 33 self-reported
  claims (post-review numbers; see CONVERSION-NOTES.md). **Not reviewed for import.**
- `CONVERSION-NOTES.md` — every automated decision + the checklist a human must clear
  before import.

**Batch 2 (2026-07-09 — categories thin in batch 1: transit, arts/culture, parks, businesses, non-ILC disability orgs, more FQHCs/libraries):**
- `listings-2.json` / `listings-2.csv` — 68 candidate records (source of record).
- `attributes-2.csv` — batch-2 attribute claims, flat.
- `sources-memo-2.md` / `gaps-2.md` — sources used + coverage gaps/flags (delta to batch 1's).
- `wny-2026-07b.seed.json` — the **candidate** import file. 66 listings, 34 self-reported
  claims. **Partially reviewed (restore decision 2026-07-09), not imported.**
- `CONVERSION-NOTES-2.md` — automated decisions + the human-review checklist.
- Convert: `node research/seed-nys/convert.mjs research/seed-nys/listings-2.json research/seed-nys/wny-2026-07b.seed.json "WNY seed research batch 2 2026-07-09 (Erie County beachhead, §3)"`

**Template:**
- `EXAMPLE.seed.json` — placeholder entities/fake sources. Shows the shape; do not import.
