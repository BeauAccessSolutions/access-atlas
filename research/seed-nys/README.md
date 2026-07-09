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
- `wny-2026-07.seed.json` — the **candidate** import file. 48 listings, 34 self-reported
  claims. **Not reviewed, not imported.**
- `CONVERSION-NOTES.md` — every automated decision + the checklist a human must clear
  before import.

**Template:**
- `EXAMPLE.seed.json` — placeholder entities/fake sources. Shows the shape; do not import.
