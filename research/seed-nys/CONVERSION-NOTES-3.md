# WNY seed batch 3 — sources, conversion + review notes

`listings-3.json` (raw batch, 56 records) → `wny-2026-07c.seed.json` via the
shared `convert.mjs`. **NOT yet human-reviewed, NOT imported.** All claims
import as `self_reported` (§4). This batch consolidates the sources memo,
gaps note, and conversion notes into one file.

Re-run:
```
node research/seed-nys/convert.mjs research/seed-nys/listings-3.json \
  research/seed-nys/wny-2026-07c.seed.json \
  "WNY seed research batch 3 2026-07-10 (Erie County beachhead, §3)"
npm run seed:import -- research/seed-nys/wny-2026-07c.seed.json --dry-run
```

## What this batch is

Two workstreams, prioritized by **value × defensibility** (owner direction,
2026-07-10):

1. **The owner's curated lead list** (669-row CSV, cross-checked against the
   Erie County OPD community-agencies directory). Deduped against batches 1–2
   → 348 defensible leads (Erie County + working website) → the four
   highest-value slices verified this batch (77 leads): adaptive sports &
   inclusive arts, accessibility-equipment/AT vendors, disability employment &
   advocacy, and PT/OT providers. **~270 defensible leads remain for batch 4**
   (mental health, housing, legal, food, condition-specific orgs, hearing/
   vision/autism/DS/CP providers, transportation).
2. **Certified disabled-veteran-owned businesses** — the full defensible
   registry sweep: NYS OGS SDVOB API (all 36 adjacent-WNY-county certs
   reviewed; Erie's 87 already done in batch 2) + federal SBA VetCert (812
   active NY SDVOSBs → all 51 in the 8 WNY counties reviewed) +
   veteranownedbusiness.com strictly as cross-check leads (none verified →
   none recorded).

## Result (pre-review)

- **55** listings (1 dropped), **6** self-reported claims. 51/55 Erie County.
- 47 providers + 8 places. Categories: disability_services 24, healthcare 20,
  business 10, arts_culture 1.
- **Representation: 5 new certified disabled-veteran-owned businesses** —
  Nurse Practitioner-Adult Health PC (Buffalo — the directory's first
  disabled-owned healthcare provider), Apnea Care (Cheektowaga, federal
  SDVOSB, patient-visitable DME), LA FFOCA dispensary (Niagara Falls,
  SDVOB + one of NY's first service-connected-disabled-veteran OCM retail
  licenses), Escarpment Arms (Lockport, dual NYS+federal cert), Valley
  Motorsports (Sinclairville). All flagged `sdvob_veteran_subset` +
  `disabled_owned_needs_attestation`.
- Verified 2026-07-10 by dry-run against live Postgres; batches 1 and 2
  re-convert byte-identical.

## Deterministic conversion decisions

| Action | Rule | Records |
|---|---|---|
| Excluded — reviewer decision | certified entity vs storefront link unconfirmed (its own site shows only B2B distribution) | ES & ES Enterprises (49 Express Pit Stop) |

## Merge-time decisions (2026-07-10 — confirm at review)

1. **Duplicates removed:** SABAH (already batch 2) re-surfaced by the sports
   agent — dropped; Starlight Studio came from two agents — kept the copy with
   the corrected Beyond-Support-Network affiliation (the lead's "via CEPA" was
   wrong).
2. **LA FFOCA kept / Combat Vet Cannabis stays excluded — same standard,
   different facts:** the bar is a *confirmed operating storefront* (LA FFOCA
   has an OCM retail license + posted hours; Combat Vet had neither).
3. **Distinct program sites of seeded parents kept deliberately** (flag
   `duplicate_of_parent_check`): Beyond Support Network Employment Services
   (Tri-Main) and Starlight Studio (340 Delaware) — own public locations.
4. **Heavy lead-list corrections applied and recorded per-record** — the PT/OT
   slice was the worst (8 address fixes, 5 dead/wrong websites, two practices'
   addresses swapped). Every correction cites the practice's own site.
5. The Erie County OPD directory URL moved: working page is
   `https://www3.erie.gov/ecopd/agencies-services` (agents verified against
   org sites first-party throughout; no record depends on the county URL).

## Human-review checklist — CLEARED 2026-07-10

- [x] **Mission-fit call (owner):** Escarpment Arms (DV-owned firearms retailer)
  → **EXCLUDED** by owner decision (off-mission for a disability-access
  directory). Encoded in `convert.mjs` `DROP_CANDIDATE`; kept in the raw batch.
- [x] **ES & ES / 49 Express Pit Stop** → **RESTORED.** Owner policy: include
  once a real operating location is verified. Federal SAM.gov registers the
  certified SDVOSB LLC at 409 Bloomingdale Rd with gasoline-station NAICS
  (owner Eric W Smith) + Yelp confirms the station operates → the certified
  entity operates the visitable retail location. Labeled self-reported; the
  entity↔storefront link rests on SAM registration, not a first-party statement.
- [x] Spot-check the 6 claims — all re-verified live 2026-07-10: 4 × 211WNY
  pages still read "Handicap Accessible? Yes" (OPWDD DDRO /8613, Beyond ES
  /11648, Kaleida BTS /5177, ECMC /7410); 2 × Buffalo Arts Studio from its
  first-party accessibility page. No change.
- [x] `org_status_unconfirmed` re-checks done: Excalibur (operating; 2026 season
  not first-party-dated — flag kept), People First Mobility (People Inc.
  affiliation **confirmed**), LiNK/Belonging (rebrand confirmed; record already
  reflected it). **CHANGED:** Buffalo PT & Sports Rehab → renamed **"Buffalo
  Physical Therapy (Paragon Physical Therapy Group)"** (org_status flag
  cleared); Inclusive Theater of WNY → no 2026 season posted (last activity Dec
  2025) → `org_status_unconfirmed` kept + reverify note added.
- [x] Four fetch-blocked sites re-verified live: thebtrc.org, uniquetheatre.org,
  highhurdlestrc.org (2026 season confirmed), excelsiorortho.com, familycarept.com
  — all quoted wording/addresses confirmed. Flags may stay as a manual-recheck
  hint, but content is verified.
- [ ] Ownership flags remain self-attestations to confirm at onboarding (§12) —
  the one item that genuinely can't close until owners onboard.

**Post-closeout counts:** 55 listings (Escarpment excluded, ES & ES restored),
6 self-reported claims, **5 certified disabled-veteran-owned** businesses. Batch 3
remains **not imported** — the closeout resolved the review items; the import
decision is still yours.

### Cross-batch correction triggered by this pass
- **Batch 1 `nfta-canalside-station`** (already imported): the NFTA single-tracking
  disruption (Church→Canalside, inbound platform CLOSED, construction through
  2026) is still active. Its `entrance_step_free` claim was **frozen** — dropped
  at reconversion (added `project_in_progress_reverify` + `partial_accessibility_caution`),
  removed from the local DB, and the summary updated to state the disruption
  (§4: never imply step-free access that isn't currently available). Batch 1 no
  longer re-converts byte-identical — this is an intentional safety correction.
  See CONVERSION-NOTES.md.

## URL sweep (2026-07-10)

57/59 distinct source URLs return HTTP 200 via curl (browser UA). The two
failures — buffalojewishfederation.org/belonging/ and uniquetheatre.org — are
both zero-claim records already flagged `source_fetch_403_reverify`. Notably,
thebtrc.org, excelsiorortho.com, and highhurdlestrc.org DO return 200 to a
plain curl even though they blocked the research fetcher — the reverify flags
stay so a human confirms the quoted content, but the URLs are live.

## Intentionally zero / structural findings (consistent with batches 1–2)

- **MDE:** zero claims across 18 PT/OT sites — *no* provider publishes hi-lo
  table or accessible-scale wording. All 18 carry `mde_recruit_pt_ot`; ECMC
  rehab (wheelchair seating clinic, SCI program), First Step PT (neuro),
  Kaleida BTS, and WNYPT&OT are the top outreach targets.
- **Disability orgs still publish no facility attributes** (24 more records,
  1 exception: Buffalo Arts Studio's real accessibility page).
- **Non-veteran disabled-owned remains registry-invisible.** The full
  three-registry sweep is now DONE for all 8 WNY counties: the certified
  universe contains ~9 visitable businesses total, 7 now listed across
  batches. Everything further comes from owner self-attestation + community
  submission, not searching.
- **Unverified leads parked for outreach (NOT recorded):** TASSMA LLC (East
  Amherst, healthcare products, SDV-self-tagged only), Swiftwater Organic
  Farmstead (Buffalo, SBA SDVOSB, possible farm stand), Buffalo Wheelchair
  Basketball / Buffalo RIMS (real and active but Facebook-only web presence —
  strong re-add candidate via direct contact).
