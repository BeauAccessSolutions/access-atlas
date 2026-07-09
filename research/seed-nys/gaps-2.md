# Gap & Coverage Note — WNY Seed Batch 2

**Prepared:** 2026-07-09. Companion to `listings-2.json` / `sources-memo-2.md`. Batch 1's `gaps.md` still applies; this note covers what batch 2 adds, confirms, or newly surfaces.

## 1. What this batch covers (68 raw records → 66 after conversion)

| Segment | Count (raw) | Sourcing quality |
|---|---:|---|
| Transit (10 remaining Metro Rail stations, MTC, 2 Amtrak, airport, PAL) | 15 | **High** (first-party NFTA/Amtrak) but rail stations carry ZERO per-station claims by design |
| Healthcare providers (5 more FQHC sites, BHSC, Summit, BestSelf, VA, Roswell, DENT) | 11 | **Mixed** — first-party for competence, 211WNY for physical access |
| Arts/culture + large venues | 11 | **High** — mostly dedicated first-party accessibility pages |
| Disability-services orgs (DAS, Headway, Parent Network, SANYS, SABAH, Gliding Stars, ACCES-VR, NYSCB, Beyond Support Network) | 9 | **High** for identity; zero facility attributes (same as batch 1's ILC finding) |
| Parks & recreation | 9 | **High** (county/state first-party) but mostly coverage-only — playgrounds/matting/launches have no schema key |
| Libraries (6 more BECPL branches, chosen for town spread) | 6 | **High**, low detail (system boilerplate) |
| Businesses incl. disabled-owned | 7 | **Mixed** — the thinnest category, again |

- **35 raw attribute claims → 34 in the candidate file** (7 were safety-dropped at conversion; 6 were then restored by reviewer sign-off 2026-07-09 — the project owner has visited Kleinhans, Botanical Gardens, Graycliff, and Theatre of Youth. Only Martin House's single-spot parking claim remains dropped. See CONVERSION-NOTES-2).
- All 68 records are **Erie County** — batch 2 adds no adjacent-county tail, so every kept record counts toward the §3 density target. Running total toward ~200 validated: 42 (batch 1) + 66 (batch 2) = **108 candidate listings** — but remember §3 counts *validated* listings; everything here is still `self_reported`.

## 2. Where batch 2 confirms batch 1's structural gaps

- **2a. Disability orgs still publish zero facility attributes.** All 9 new org records are coverage-only. The first-confirmation-drive plan (gaps.md §5.1) now has 16+ org buildings whose own members could photo-confirm them.
- **2b. MDE remains uncollectable.** Zero `height_adjustable_exam_table` / `accessible_scale` claims in 11 new provider records. All five new FQHC sites are flagged `fqhc_mde_deadline_recruit` — and note the **July 8 2026 HHS deadline has now passed**, strengthening the outreach hook (Aug 9 2026 Title II is one month out). Honest nuance: the Buffalo VA is **federal** (ABA/§504, not ADA Title II) — the Title II flag was deliberately withheld there.
- **2c. Disabled-owned is still veteran-skewed and genuinely scarce.** A systematic hand-review of **all 87 Erie County SDVOB certifications** produced exactly 2 visitable candidates (1 kept). No Deaf-owned, DOBE-certified, or press-attested non-veteran disabled-owned storefront was found. Community submission + owner attestation remains the only path here.

## 3. New findings specific to batch 2

- **A negative access report, recorded honestly:** Jericho Road **Broadway** Clinic is listed by 211WNY as "Handicap Accessible? **No**" (3rd-floor site). Zero claims; surfaced as a caution and priority field-verification target. This is the first explicitly-negative record in the seed — the UI's honest-labeling states should handle "no citable access facts + known concern" gracefully.
- **Metro Rail is mid-disruption (time-sensitive).** Since 2026-06-07: above-ground single-tracking Church→Canalside, **inbound platforms closed** at Church/Seneca/Canalside, accessible boarding requires specific railcar positions or the Route 8 bus. Affects batch-1's **Canalside Station** record too — re-check it at review. "Cars on Main Street" construction (Church→Exchange) runs through summer 2026.
- **The station map changed:** DL&W Station opened 2025-12-08 (newest terminus; skybridge/entrance work still ongoing → `project_in_progress_reverify`); "Theater" and "Special Events" stations are closed and were not recorded.
- **Highmark Stadium is mid-transition** — the new $2.1B stadium was announced complete (June 2026 press release) and opens for the 2026 season while the old one retires; every physical fact is about to change venues. Listing **excluded** at conversion (`planned_not_operational`); re-add once the new stadium publishes its own accessibility guide.
- **NFTA's per-station accessibility PDF and elevator-status page both 404** — locating the live elevator-status feed is a follow-up worth doing before launch (it's the dissent/time-decay mechanic's natural data source for underground stations).

## 4. Data-quality flags introduced or notable in batch 2

| Flag | Meaning | Action |
|---|---|---|
| `planned_not_operational` | Generic form of batch 1's `planned_2027_not_operational` (Highmark new stadium) | Converter drops the listing |
| `storefront_status_unconfirmed` | Combat Vet Cannabis — SDVOB cert real, no confirmed operating storefront | Converter drops the listing (candidate-level review decision) |
| `disabled_led_needs_confirmation` | DAS (Deaf-community roots but current People Inc. page makes no peer-run claim), SANYS (strong first-party basis, still self-attest at onboarding) | Confirm at onboarding |
| `system_wide_claim_not_per_station` + `elevator_dependent_underground` | All 7 underground rail stations | No claims until per-station first-person confirmation; find elevator-status feed |
| `partial_accessibility_caution` | Kleinhans, Botanical Gardens, Martin House, Graycliff, Naval Park, Theatre of Youth, Pearl Street, Church/Seneca stations | Claims safety-dropped by converter; reviewer may restore the specific restroom/parking claims (see CONVERSION-NOTES-2) |
| `missing_street_address` | All 10 rail stations (NFTA publishes no street addresses) | Resolve via GTFS pull (batch-1 memo #2) or on-site |

## 5. Recommended next moves (delta to gaps.md §5)

1. ~~Restore-or-confirm the 7 safety-dropped claims~~ **Done 2026-07-09** — 6 restored on reviewer sign-off (owner has visited); Martin House's stays dropped. Once the contribute flow opens, those same venues are natural first first-person confirmations for the reviewer to file properly (§4).
2. **Find NFTA's live elevator-status page** and wire it into re-verification for the 7 underground stations.
3. **Re-check batch-1 Canalside Station** against the June 2026 single-tracking alert.
4. **Browser-based pass on Wheel the World** for RiverWorks/West Side Bazaar measured data (JS-rendered, unfetchable by plain HTTP).
5. **Future-batch leads parked here:** Tow Path Park; Aurora Town Public Library; BestSelf's 5+ other sites (one listed NOT accessible — same honest-negative handling as Broadway); Nurse Practitioner-Adult Health PC (SDVOB healthcare); The Arc Erie County; St. Mary's School for the Deaf; new Highmark Stadium once its guide is live.
