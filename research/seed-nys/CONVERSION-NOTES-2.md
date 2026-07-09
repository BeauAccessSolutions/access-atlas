# WNY seed batch 2 — conversion + review notes

`listings-2.json` (raw research batch, 68 records) → `wny-2026-07b.seed.json`
(importer format), via the same `convert.mjs` (now parameterized). **NOT yet
human-reviewed, NOT imported.** Every claim imports as `self_reported` (§4).

Re-run:
```
node research/seed-nys/convert.mjs research/seed-nys/listings-2.json \
  research/seed-nys/wny-2026-07b.seed.json \
  "WNY seed research batch 2 2026-07-09 (Erie County beachhead, §3)"
npm run seed:import -- research/seed-nys/wny-2026-07b.seed.json --dry-run
```

## Result (after the 2026-07-09 partial review pass)

- **66** listings (2 dropped), **34** self-reported attribute claims (1 safety-dropped).
- 21 providers + 45 places. **All 66 in Erie County** (no adjacent-county tail this batch).
- By category: transit 15, healthcare 11, arts_culture 10, disability_services 9,
  parks_recreation 9, library 6, business 6 (after conversion drops; PAL counts under transit).
- Representation: **1 disabled-owned + disabled-led** kept (Greek to Me Restaurant,
  SDVOB) + **1 disabled-led** (SANYS Western Region, peer-run per first-party wording).
- Dry-run verified against live Postgres 2026-07-09: shape OK, all attribute keys
  valid against the live catalog, batch-1 seed re-converted byte-identical.

## Automated conversion decisions (deterministic)

| Action | Rule | Records |
|---|---|---|
| Excluded — not operational | `planned_not_operational` | Highmark Stadium (old venue retiring, new venue opening 2026 season — re-add when its guide is live) |
| Excluded — reviewer decision | storefront unconfirmed (no OCM retail license) | Combat Vet Cannabis |
| Dropped 1 claim (listing kept) | physical-safety caution — never assert access on partial-access records (§4) | Martin House (accessible_parking — a single spot; not reviewer-restored) |
| **Restored 6 claims** | reviewer (project owner) has personally visited and signed off 2026-07-09; caution flags stay on the records | Kleinhans (restroom+parking), Botanical Gardens (restroom+parking), Graycliff (parking), Theatre of Youth (restroom — venue confirmed open, 2026-27 season announced) |
| Category | explicit `category` on each raw record (converter now honors it) | all 68 |

## Merge-time review decisions (orchestrator, 2026-07-09 — confirm at human review)

1. **Two duplicates removed before the raw file was written:** the business
   researcher independently re-surfaced **Shea's Buffalo Theatre** (already batch 1,
   `wny:place:sheas-buffalo`) and **Highmark Stadium** (kept the arts researcher's
   version, which asserts nothing during the stadium transition; the business
   version had an accessible_parking claim sourced from search excerpts of a
   404-blocked page describing the OLD stadium — rejected as unsafe).
2. **Olmsted Center for Sight deliberately not added** — it is the same
   organization as batch-1's VIA (rebranded); adding it would double-count.
3. **Autism Services Inc. / Cantalician / LDA of WNY not added under legacy names** —
   Autism Services' programs transferred to People Inc. and The Summit Center
   (2024); Cantalician + LDA merged into **Beyond Support Network** (2022), which
   is what batch 2 lists.
4. **Sahlen Field upgraded during the URL sweep:** the A-Z guide blocked one fetch
   tool (406) during research, but a direct fetch the same day verified the exact
   restroom wording, so its claim stands un-flagged (the batch-1 Explore & More
   precedent — drop claims we can't verify from here — did not apply in the end).
5. **`press_release_source_corroborate` added to Buffalo Harbor State Park**
   (its currency rests on a May 2026 Governor's release).

## Human-review checklist before import

- [x] **Decide the 7 safety-dropped claims.** ✅ RESOLVED 2026-07-09: the project
  owner has personally visited Kleinhans, the Botanical Gardens, Graycliff, and
  Theatre of Youth and signed off on restoring their 6 explicit first-party
  restroom/parking claims (encoded in `convert.mjs` `KEEP_ATTRS_DESPITE_CAUTION`;
  the `partial_accessibility_caution` flags stay on the records). Theatre of
  Youth confirmed still operating (2026-27 season announced on its site).
  **Martin House's single-spot parking claim stays dropped** (not visited/signed
  off). Reminder: the restored claims are still `self_reported` — the owner's
  visits become real confirmations only through the contribute flow (§4).
- [ ] Confirm the 2 excluded listings stay excluded (Highmark until the new
  stadium's guide is live; Combat Vet Cannabis until a storefront is confirmed).
- [ ] Spot-check the 211WNY-derived `entrance_step_free` claims (6 records,
  all flagged `general_accessible_flag_only`) — same convention as batch 1,
  same caveat: a general "Handicap Accessible? Yes" is a weak signal.
- [ ] Re-check batch-1 **Canalside Station** against the June 2026 single-tracking
  alert (inbound platform closed) — batch 2 surfaced this; it's a batch-1 record.
- [ ] Confirm West Side Bazaar's single claim (business-supplied tourism-map
  description, medium reliability) is acceptable, or drop to coverage-only.
- [ ] The 4 records still flagged `source_fetch_403_reverify` (NYSCB / Beyond
  Support Network / CHCB / — all zero-claim or 211-sourced-claim records) get a
  manual browser check.
- [ ] Ownership flags (`disabled_owned`/`disabled_led`) remain self-attestations
  to confirm at onboarding (§12): Greek to Me (SDVOB), SANYS (peer-run wording).

## URL sweep (2026-07-09)

54/57 distinct source URLs returned HTTP 200 via curl. Failures (all on
zero-claim records): ocfs.ny.gov (connection reset), visitbuffalo.com (403 to
curl, fetched fine during research), buffalobills.com guide (404 — listing
excluded anyway). Details: `sources-memo-2.md`.

## Intentionally zero (by design, not omission — unchanged from batch 1)

- **MDE attributes** (`height_adjustable_exam_table`, `accessible_scale`): zero
  claims; no provider publishes them. Recruitment via the now-passed July 8 2026
  HHS deadline + Aug 9 2026 Title II deadline (flags on all 5 new FQHCs).
- **Provider behaviors** (`communicated_directly`, `staff_knew_equipment`):
  first-person only — the moat.
- **Per-station rail claims:** zero, until first-person confirmation + a live
  elevator-status source.
