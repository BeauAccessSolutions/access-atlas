# Gap & Coverage Note — WNY seed data

**Prepared:** 2026-07-08. Companion to `listings.json` / `sources-memo.md`.

This is the expected finding, not a failure: **secondary sources can bootstrap the
directory, but they cannot fill it.** The whole premise of Access Atlas (§4) is that
first-person disabled experience — not scraped data — is what makes a listing
trustworthy. This note says exactly where the seed is thin and what needs
on-the-ground / community collection.

---

## 1. What this seed covers (49 candidate records)

| Segment | Count | Sourcing quality |
|---|---:|---|
| Places (civic/cultural/transit/parks) | 23 | Mostly **high** — first-party accessibility pages (museums, BECPL, Erie County Parks, NFTA) |
| Providers — ILC / disabled-led orgs | 7 | **High** for org identity + disabled-led; **no facility attributes** sourced |
| Providers — health/disability-competent | 12 | **Mixed** — first-party for care programs; 211WNY directory for physical access |
| Providers — disabled-owned (SDVOB + Deaf-owned) | 7 | **High** (state cert) but veteran-skewed |

- **36 attribute claims total**, every one carrying its own `source_url`. All import as `self_reported`.
- Geographic weight is correct per §3: the overwhelming majority sit in **Erie County / Buffalo**, with a thin adjacent-county tail (Niagara, Genesee, Chautauqua, Cattaraugus) from the ILC network and one statewide anchor (NYAIL) kept as context only.

---

## 2. Where the data is thin (needs community collection)

### 2a. Objective facility attributes are the biggest hole
- **ILC / disabled-led orgs have ZERO facility attributes.** None of the 7 org pages published a citable step-free-entrance / accessible-restroom / accessible-parking statement. These are exactly the orgs whose members can photo-confirm their own building — a natural **first confirmation drive** at launch (and WNYIL is the anchor partner, §3).
- **"General accessible" flags dominate and were deliberately NOT inflated.** Many BECPL branches and 211WNY provider entries say only "wheelchair accessible." Per §4 (safety-first, no guessing) these were mapped to at most one conservative attribute with an explicit caveat note, or left empty. Each needs a real visit to confirm which *specific* attribute holds.
- **Accessible restrooms are barely sourced.** Only a handful of places (AKG, History Museum, Chestnut Ridge) had an explicit accessible-restroom statement. Restroom access is high-stakes and under-documented — a priority for photo confirmation.

### 2b. Medical Diagnostic Equipment (MDE) is essentially uncollectable from public sources
- **No provider in WNY publicly states it has a height-adjustable exam table or wheelchair-accessible scale.** Confirmed in the sources memo: **no registry of MDE-compliant providers exists anywhere.** So `height_adjustable_exam_table` has **zero** seed claims — it can only come from first-person visits.
- The **July 8 2026 (HHS-funded) and Aug 9 2026 (ADA Title II) MDE deadlines** are a recruitment hook, not a data source. The FQHCs and public hospital flagged `fqhc_mde_deadline_recruit` / `mde_deadline_recruit_title_ii` are the outreach shortlist.

### 2c. Disabled-owned representation is genuinely scarce and skewed
- **There is no formal NYS "disabled-owned business" certification.** NY certifies MWBE and SDVOB, not general disability ownership. **SDVOB (service-disabled veteran) is the only high-reliability citable signal**, and it captures only veterans — so 6 of 8 disabled-owned records are veteran-owned construction/landscaping/IT. That is a real coverage bias worth naming.
- **Non-veteran disabled-owned businesses are nearly invisible in public sources.** Searches surfaced Black-owned and MWBE guides but no disability-owned directory. The Deaf-owned angle yielded exactly **one** clean Buffalo-area business (Service Bridges). This category will be built almost entirely by community submission + owner self-attestation, not scraping.

### 2d. Provider *behavior* attributes are (correctly) absent
- `communicated_directly` and `staff_knew_equipment` are **first-person visit reports by design** (§8c). No seed record asserts them, and none should — they exist only once a real person answers the structured question from their own visit. This is not a gap to fill with data; it is the moat working as intended.

### 2e. Missing structured fields
- **Addresses:** several SDVOB records have `street: null` (the OGS releases give city + service line only). Resolve at onboarding.
- **Geocodes:** all `lat`/`lng` are null. The app can geocode from street addresses; the map is a progressive enhancement over the list (§5) so this does not block launch.

---

## 3. Schema gaps this research surfaced (for the human reviewer)

These are **additive** data-model changes — new columns / new `attribute_definitions`
rows. **None** touches the safety-critical consensus formula that must stay in
lockstep between `supabase/migrations/0001_init.sql` (the `attribute_claim_status`
view) and `src/lib/seed.ts` (§13). Do not fold these into that formula.

### Gap A — Places cannot hold `disabled_owned` / `disabled_led`
`provider_profiles` (which carries the ownership/leadership flags) attaches **only to
`provider` listings**. But a disabled-owned **restaurant, cafe, or shop is a `place`**
— e.g. **Fly By Cafe** (SDVOB-certified cafe/B&B). Its flags are recorded at the
**top level** of the JSON record with nowhere to land in the current schema.
The representation axis (§1) is a headline goal, so this matters.
- **Options:** (a) a `place_profiles` table mirroring `disabled_owned` / `disabled_led`; or
  (b) hoist those two columns onto the shared `listings` entity so both kinds carry them.
- Records affected: `fly-by-cafe` (flag `schema_gap_place_ownership`).

### Gap B — `accessible_parking` is place-only, but providers have parking too
`accessible_parking` is defined with `applies_to_kind = 'place'`. Yet §8b explicitly
lists **"accessible entrance/restroom/parking"** as objective *provider* facility
attributes (the ADA MDE facility set). Two provider records had sourced accessible-
parking evidence that **could not be attached** and is held as a note instead:
- `peopleinc-health-services` (porte-cochère + accessible parking, developer page)
- `jericho-road-doat` (211WNY: "Accessible entrance, restrooms, and parking spaces")
- **Fix:** change `accessible_parking.applies_to_kind` from `'place'` to `null` (both).
  One-line data change in the migration + `src/lib/seed.ts` ATTR catalog. Records flagged
  `provider_parking_evidence_no_schema_slot`.

### Gap C — Proposed new objective attribute keys (ADA MDE)
Objective, photo-verifiable facts with real WNY evidence but **no key**:
- **`accessible_scale`** — wheelchair-accessible weight scale (core ADA MDE attribute,
  §8; grounded in the U.S. Access Board MDE Standards). No seed claim yet, but it is a
  primary MDE recruitment target and should exist before provider outreach.
- **Dental/imaging access** — a **wheelchair-tilt dental lift** (People Inc./ECMC, UB)
  and a **wheelchair-accessible panoramic X-ray** (UB) recur in the data and are
  objective/photo-verifiable. If dental/imaging providers become a segment, consider a
  general key such as `patient_transfer_lift` rather than one-off keys. For now these are
  captured only as notes (flags `dental_tilt_lift_no_schema_key`,
  `dental_imaging_features_no_schema_key`).

### Gap D — No key for "automatic doors"
BECPL Central and Clearfield document automatic/power-assist doors. There is no
`automatic_doors` key; the fact is folded into the `entrance_step_free` evidence note
(flag `automatic_doors_no_schema_key`). Low priority — decide whether automatic doors is
its own attribute or a sub-detail of step-free entrance.

---

## 4. Data-quality flags to resolve before import (all present in `listings.json`)

| Flag | Meaning | Action |
|---|---|---|
| `planned_2027_not_operational` | UB Special Care Dental Clinic opens 2027 | Do NOT surface as available; hold until it opens |
| `project_in_progress_reverify` | Tifft accessible-trail rebuild was in progress | Re-confirm completion before asserting step-free |
| `source_fetch_403_reverify` | Explore & More attribute from a cached excerpt (403 on direct fetch) | Re-fetch first-party page |
| `system_wide_claim_not_per_station` | NFTA "all stations accessible" is a policy statement | Photo-confirm per station (esp. underground elevators) |
| `elevator_dependent_underground` | Lafayette Square depends on elevators that can fail | Prime example of §4 dissent-freezes-the-claim |
| `press_release_source_corroborate` | Catholic Health ASL claim from a PR release | Corroborate on the system's own site |
| `general_accessible_flag_only` | Source said only "wheelchair accessible" | Confirm which specific attribute holds, via visit |
| `self_listed_directory_medium_reliability` | Aveteran Corp self-listed, not state-certified | Verify vs NYS OGS / federal VA registry |
| `missing_street_address` / `address_may_be_mailing` | SDVOB records lack a confirmed street | Resolve at onboarding |
| `outside_erie_county` | Adjacent-county or statewide record | Keep for network context; don't count toward Erie density target |
| `partial_accessibility_caution` | Shea's — not fully ADA compliant (no elevator) | Surface the caveat prominently; never imply full access |

---

## 5. Recommended next moves

1. **Turn the ILC cluster into the first confirmation drive.** WNYIL (anchor, §3) and the
   6 other CILs have members who can photo-confirm their own buildings — the fastest path
   from `self_reported` to real confirmations, and it seeds the reviewer pool at the same time.
2. **Pull NFTA GTFS** to bulk-add every accessible transit stop as a Place (sources memo #2).
3. **Scrape/request the NYS SDVOB directory filtered to Erie County** for disabled-owned
   density (sources memo #3), tagging the veteran-subset honestly.
4. **Resolve Gaps A & B** (place ownership; provider parking) before seeding at scale — both
   are one-line additive changes and both block correctly representing records already in hand.
5. **Build MDE from scratch via recruitment**, using the July 8 / Aug 9 2026 deadlines as the
   hook with the flagged FQHCs and ECMC. There is no dataset to import here — by design.
