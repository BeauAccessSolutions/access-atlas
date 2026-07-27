// Derive representation PROVENANCE for a seeded listing (§4, §12).
//
// WHY THIS IS A SEPARATE, TESTED MODULE. Production published
// "Disabled-owned (self-attested)" for 8 seeded businesses that had never
// attested anything — the importer copied a boolean and the UI supplied a
// provenance word out of thin air. The boolean is now only half the record;
// this decides the other half, and it decides it from evidence the seed
// curator already wrote down rather than from a guess.
//
// The curator's `_review.flags` ARE the policy. They were recorded during the
// WNY research sweep and each one means something specific:
//
//   sdvosb_federal_cert   federal SBA VetCert SDVOSB. Certification requires
//                         >=51% service-disabled-veteran ownership AND
//                         day-to-day control — exactly §12's test, verified by
//                         a government body. -> `sourced`.
//   sdvob_veteran_subset  NYS OGS SDVOB directory. Same ownership + control
//                         basis, certified by the state. -> `sourced`.
//   cil_consumer_control  a federally designated Center for Independent Living.
//                         Consumer control (>=51% of staff and board are
//                         disabled people) is a CONDITION of that designation
//                         under the Rehabilitation Act. -> `sourced`.
//   *_needs_confirmation  the curator could NOT substantiate the flag. NYAIL's
//                         note says it outright: "CONFIRM before publishing that
//                         flag." -> publish nothing.
//
// `*_needs_attestation` deliberately does NOT suppress. It means "collect the
// owner's own attestation at onboarding", and it sits alongside the cert flags
// on every certified business. A certification already substantiates the claim;
// the attestation would upgrade WHO said it, not WHETHER it is true.
//
// Everything else -> null. Unknown provenance publishes nothing (labeling.ts
// presentRepresentation returns null), so a new flag name added upstream fails
// safe instead of silently inheriting "self-attested".

/** flag -> the citation shown to users for a `sourced` claim. */
const SOURCED_FLAGS = [
  ['sdvosb_federal_cert', 'a federal SBA SDVOSB certification (verified 51%+ ownership and control by a service-disabled veteran)'],
  ['sdvob_veteran_subset', 'the New York State OGS SDVOB certified-business directory (verified 51%+ ownership and control by a service-disabled veteran)'],
  ['cil_consumer_control', 'its designation as a Center for Independent Living, where consumer control — 51% or more of staff and board being disabled people — is a condition of the designation'],
];

const NEEDS_CONFIRMATION = {
  owned: 'disabled_owned_needs_confirmation',
  led: 'disabled_led_needs_confirmation',
};

/**
 * @param {'owned'|'led'} axis
 * @param {object} listing a seed record
 * @returns {{source: 'self_attested'|'sourced'|null, note: string|null}}
 */
export function representationSource(axis, listing) {
  const claimed = Boolean(axis === 'owned' ? listing?.disabled_owned : listing?.disabled_led);
  if (!claimed) return { source: null, note: null };

  // An explicit value in the seed always wins — a real onboarding attestation
  // is recorded that way and must not be second-guessed by flag heuristics.
  const explicit = axis === 'owned' ? listing.disabled_owned_source : listing.disabled_led_source;
  if (explicit === 'self_attested' || explicit === 'sourced') {
    return { source: explicit, note: explicit === 'sourced' ? (listing.representation_note ?? null) : null };
  }

  const flags = listing?._review?.flags ?? [];

  // The curator could not substantiate it. Silence beats a claim (§2, §4).
  if (flags.includes(NEEDS_CONFIRMATION[axis])) return { source: null, note: null };

  for (const [flag, citation] of SOURCED_FLAGS) {
    if (flags.includes(flag)) return { source: 'sourced', note: citation };
  }

  // No recognized evidence class. Fail safe.
  return { source: null, note: null };
}

/**
 * Both axes at once, plus the single shared note column. When the two axes rest
 * on the same evidence (the normal case — a certification covers ownership AND
 * control) they produce the same citation, so one column suffices.
 * @returns {{disabled_owned_source: string|null, disabled_led_source: string|null, representation_note: string|null}}
 */
export function representationColumns(listing) {
  const owned = representationSource('owned', listing);
  const led = representationSource('led', listing);
  return {
    disabled_owned_source: owned.source,
    disabled_led_source: led.source,
    representation_note: owned.note ?? led.note ?? null,
  };
}
