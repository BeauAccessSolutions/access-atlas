# Seed dataset format

This is the contract between **curated seed research** (e.g. the WNY dataset in
`research/seed-nys/`) and the **importer** (`scripts/seed-import.mjs`). Produce a
JSON file matching this shape; the importer loads it into Postgres.

## The one rule that overrides everything

**An import can only ever create `self_reported` (or, narrowly, `sourced`) data.**
It cannot manufacture community trust. There is no way to express a "confirmation"
in this format — confirmations are first-person visit reports and must come from
real people through the contribute flow (§4). A seeded listing shows
**"self-reported / awaiting verification"** until the community validates it. This
is intentional and non-negotiable (§2, §4, §14).

## File shape

```jsonc
{
  "source": "Human-readable description of where this batch came from",
  "listings": [
    {
      "source_ref": "wnyil:place:elmwood-village-cafe",  // REQUIRED, stable, unique — the idempotency key
      "source_url": "https://…",                          // REQUIRED — provenance (§7)
      "kind": "place",                                     // "place" | "provider"
      "name": "Elmwood Village Cafe",                      // REQUIRED
      "summary": "Neighborhood cafe on Elmwood Ave.",
      "street": "…",
      "city": "Buffalo",
      "region": "Erie County",                             // drives the WNY-first rollout (§3)
      "postal_code": "14222",
      "lat": 42.92, "lng": -78.87,                         // optional; map is progressive enhancement (§5)

      // Representation axis (§1, §12), SELF-ATTESTED. TOP-LEVEL because it applies
      // to BOTH kinds — a disabled-owned cafe is a place. Default false; omit if
      // not attested. Independent of each other and of disability_literate.
      "disabled_owned": true,
      "disabled_led": true,

      // Providers only. Provider-specific competence (§8), SELF-ATTESTED.
      // Omit the whole object for places.
      "provider": {
        "disability_literate": true
      },

      // Self-reported attribute claims. Each becomes ONE attribute_claim in the
      // self_reported state (zero confirmations). `key` MUST match a row in
      // attribute_definitions — unknown keys are rejected, not silently dropped.
      "attributes": [
        {
          "key": "entrance_step_free",   // see attribute_definitions / src/lib/seed.ts ATTR
          "asserted_value": true,        // optional, default true ("yes, present")
          "source_url": "https://…",     // optional per-attribute provenance
          "note": "Owner's website states a level entrance"
        },

        // ONLY for data backed by a real certification / audit / partner org —
        // this maps to the `sourced` state (§4). Do NOT use it for a business's
        // own marketing claim. Requires sourced_note describing the source.
        {
          "key": "accessible_restroom",
          "sourced": true,
          "sourced_note": "Erie County facilities ADA audit, 2026"
        }
      ]
    }
  ]
}
```

## Field notes

- **`source_ref`** — must be stable across re-imports. Re-running with the same
  `source_ref` **updates** the existing listing rather than duplicating it. Pick a
  deterministic scheme, e.g. `<source>:<kind>:<slug>`.
- **`source_url`** — required at the listing level; it's what makes the
  "self-reported / community-sourced" disclaimer checkable (§7). Leave nothing
  unsourced; if you can't cite it, omit the attribute rather than guess (§4).
- **`disabled_owned` / `disabled_led`** — top-level booleans, valid on either
  kind. Self-attested ownership (≥51%) / leadership per §12.
  - **Government-certification proxy (seed only).** §12 defines these as
    self-attested with no proof ever required. A seed record may set
    `disabled_owned` from a government disabled-veteran certification — NYS OGS
    **SDVOB** or federal SBA **VetCert** — because obtaining that certification
    *required the owner to attest their disabled-veteran status to a government
    body*. That prior attestation is a defensible proxy for the §12
    self-attestation, and it is a stricter basis than an unsourced flag, not a
    looser one. Rules that keep it honest: (1) the certifying registry is the
    listing's `source_url`, so the basis is checkable (§7); (2) it is a proxy
    for *ownership*, never a community-verified access claim (§4) — attribute
    claims still import `self_reported`; (3) it is still reconciled with the
    owner's own attestation at onboarding (§12). Records carrying this basis are
    flagged (e.g. `sdvob_veteran_subset`) in the batch conversion notes.
- **`category`** (optional) — a coarse scannability category (icon + label), one
  of: `healthcare`, `disability_services`, `business`, `library`, `arts_culture`,
  `parks_recreation`, `transit`. NULL/omitted = uncategorised. Not part of the
  validation model (§4). The importer rejects unknown values.
- **`attributes[].key`** — the valid keys are whatever lives in
  `attribute_definitions`. Today: `entrance_step_free`, `accessible_restroom`,
  `accessible_parking` (both kinds), `height_adjustable_exam_table` (provider),
  `accessible_scale` (provider), `communicated_directly` (provider),
  `staff_knew_equipment` (provider). The importer validates against the live
  catalog and lists any unknown keys.
- **No personal data.** Never include a reviewer's identity, disability type, or
  anything about a person (§6). This format describes places and providers only.

## Running the importer

```
npm run seed:import -- research/seed-nys/<file>.json --dry-run   # validate + preview, writes nothing
npm run seed:import -- research/seed-nys/<file>.json             # apply (idempotent; upserts on source_ref)
```

Needs a configured backend (`PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
in `.env`, or a running `npm run db:start`). Always `--dry-run` first and review.
