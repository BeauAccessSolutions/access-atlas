# WNY seed conversion + review notes

`listings.json` (raw research batch, 49 records) → `wny-2026-07.seed.json`
(importer format), via `convert.mjs`. A source-review pass was completed
2026-07-08 (below). Every claim imports as `self_reported` (§4).

Re-run: `node research/seed-nys/convert.mjs`
Validate shape (no DB): `npm run seed:import -- research/seed-nys/wny-2026-07.seed.json --dry-run`

## Result (after review)

- **42** listings (7 dropped), **33** self-reported attribute claims.
- 23 places + 19 providers. 35/42 in Erie County; the rest are adjacent-county /
  statewide network context (not counted toward the §3 density target).
- Representation: **2 disabled-owned** (Service Bridges, Fly By Cafe) + **9
  disabled-led** (7 ILCs incl. anchor WNYIL, plus Service Bridges + Fly By Cafe).

## Automated conversion decisions (deterministic, gaps.md §4)

| Action | Rule | Records |
|---|---|---|
| Excluded — not open yet | `planned_2027_not_operational` | UB Special Care Dental Clinic |
| Dropped claims (listing kept) | physical-safety caution — never assert partial/elevator-dependent/unbuilt access (§4) | Shea's, NFTA Lafayette Square, Tifft |
| Promoted `accessible_parking` | Gap B fixed — providers can hold parking | People Inc., Jericho Road — Doat St |
| Mapped | `candidate_id`→`source_ref`, `attribute_key`→`key`, ownership read from top-level **or** `provider_profile` | all |

## Review pass — completed 2026-07-08

1. **BUG FIXED — representation was being lost.** The raw batch stored ownership
   inconsistently (top-level for places, inside `provider_profile` for providers).
   The converter now reads both; without this, 14 provider records (7 disabled-led
   ILCs incl. WNYIL + 7 disabled-owned) imported with ownership silently false.
2. **Source reachability swept — 47/48 returned HTTP 200.** The one exception,
   Explore & More, hard-blocks automated fetch (403 to both curl and WebFetch), so
   its accessibility claim is unverifiable from here → **claim dropped, listing
   kept** until a visit / manual re-fetch (§4).
3. **Catholic Health source upgraded** — the 2015 PR Newswire release is
   corroborated by the system's own Language Assistance compliance page; cite that
   durable first-party page instead.
4. **Editorial: 6 pure-B2B SDVOBs excluded** (Hoag, Greater Frontier, Vanguard,
   Buffalo Veteran Contracting, Aveteran, CW Snow Plowing) — legitimately
   disabled-owned but construction/IT/snow-plowing with zero accessibility claims;
   off-mission for a discovery platform and would skew "disabled-owned" toward
   veteran B2B. Retained in the raw batch for a possible future disabled-owned-
   business directory. Service Bridges (Deaf-owned interpreting) + Fly By Cafe (a
   visitable place) kept. This resolves the `sdvob_veteran_subset` coverage bias.

## Still recommended before/at onboarding (not blockers)

- **Null street addresses** on 5 SDVOB-derived records — resolve when owners onboard.
- **`disabled_owned`/`disabled_led` are self-attestations** — confirm at owner
  onboarding; the seed cites the cert/source but the flag is a self-attest by design (§12).
- **Adjacent-county / statewide records** are network context — surface as such,
  don't count toward Erie density (§3).

## Intentionally zero (by design, not omission)

- **MDE** (`height_adjustable_exam_table`, `accessible_scale`): no public registry —
  first-person / July+Aug 2026 recruitment only (gaps.md §2b).
- **Provider behaviors** (`communicated_directly`, `staff_knew_equipment`):
  first-person only (§8c) — the moat.
- **`automatic_doors`, dental tilt-lift, panoramic X-ray**: no schema key yet
  (Gaps D + dental, deferred).
