// Representation provenance (§1, §4, §12) — the labels that told users an
// attestation had happened when it had not.
//
// Two halves, both pinned here because the failure was a SEAM between them:
//   * scripts/lib/representation-source.mjs — what the importer records;
//   * src/lib/labeling.ts presentRepresentation — what the UI is allowed to say.
// The bug lived in neither half alone: the importer wrote a bare boolean and the
// UI invented the word "self-attested" to go with it.
import { describe, it, expect } from 'vitest';
import { presentRepresentation, representationDefinition } from '../../src/lib/labeling';
import {
  representationSource,
  representationColumns,
} from '../../scripts/lib/representation-source.mjs';

describe('representation provenance — the importer half', () => {
  it('treats a government certification as sourced, and cites it', () => {
    const apneaCare = {
      disabled_owned: true,
      disabled_led: true,
      _review: { flags: ['sdvosb_federal_cert', 'sdvob_veteran_subset', 'disabled_owned_needs_attestation'] },
    };
    const cols = representationColumns(apneaCare);
    expect(cols.disabled_owned_source).toBe('sourced');
    expect(cols.disabled_led_source).toBe('sourced');
    expect(cols.representation_note).toMatch(/SBA SDVOSB/);
  });

  it('does NOT let *_needs_attestation suppress a certified claim', () => {
    // "needs attestation" means "collect the owner's own words at onboarding",
    // not "this might be false" — it sits on every certified business.
    const { source } = representationSource('owned', {
      disabled_owned: true,
      _review: { flags: ['sdvob_veteran_subset', 'disabled_owned_needs_attestation'] },
    });
    expect(source).toBe('sourced');
  });

  it('DOES suppress when the curator could not confirm the flag', () => {
    // NYAIL's note: "CONFIRM before publishing that flag." Production published it.
    const nyail = {
      disabled_led: true,
      _review: { flags: ['statewide_anchor_context_only', 'disabled_led_needs_confirmation'] },
    };
    expect(representationSource('led', nyail).source).toBeNull();
    expect(representationColumns(nyail).disabled_led_source).toBeNull();
  });

  it('treats CIL designation as sourced (consumer control is a condition of it)', () => {
    const wnyil = { disabled_led: true, _review: { flags: ['cil_consumer_control'] } };
    const { source, note } = representationSource('led', wnyil);
    expect(source).toBe('sourced');
    expect(note).toMatch(/Center for Independent Living/);
  });

  it('fails safe on an unrecognized evidence class', () => {
    // A new upstream flag must NOT silently inherit a provenance word.
    const mystery = { disabled_owned: true, _review: { flags: ['some_new_flag_nobody_taught_us'] } };
    expect(representationSource('owned', mystery).source).toBeNull();
  });

  it('fails safe with no review block at all', () => {
    expect(representationSource('owned', { disabled_owned: true }).source).toBeNull();
    expect(representationSource('owned', {}).source).toBeNull();
  });

  it('lets an explicit seed value win over flag heuristics', () => {
    // A real onboarding attestation is recorded explicitly and must survive.
    const attested = {
      disabled_owned: true,
      disabled_owned_source: 'self_attested',
      _review: { flags: ['sdvob_veteran_subset'] },
    };
    expect(representationSource('owned', attested).source).toBe('self_attested');
  });

  it('never invents provenance for an unclaimed axis', () => {
    const cols = representationColumns({ disabled_owned: false, disabled_led: false, _review: { flags: ['sdvosb_federal_cert'] } });
    expect(cols.disabled_owned_source).toBeNull();
    expect(cols.disabled_led_source).toBeNull();
  });
});

describe('representation provenance — the UI half', () => {
  it('publishes NOTHING when provenance is unknown, even though the flag is true', () => {
    // This is the property that makes the fix hold for rows imported before
    // provenance existed: production data has source = null everywhere.
    expect(presentRepresentation('owned', true, null)).toBeNull();
    expect(presentRepresentation('owned', true, undefined)).toBeNull();
    expect(presentRepresentation('led', true, null, 'a note that should not rescue it')).toBeNull();
  });

  it('publishes nothing when there is no claim', () => {
    expect(presentRepresentation('owned', false, 'sourced', 'a certification')).toBeNull();
    expect(presentRepresentation('led', false, 'self_attested')).toBeNull();
  });

  it('says "self-attested" ONLY when someone actually attested', () => {
    const p = presentRepresentation('owned', true, 'self_attested');
    expect(p!.sourceLabel).toBe('self-attested');
    expect(p!.text).toBe('Disabled-owned (self-attested)');
    expect(p!.isTrustworthyClaim).toBe(false);
  });

  it('says "sourced" and names the citation, never "self-attested"', () => {
    const p = presentRepresentation('led', true, 'sourced', 'a federal SBA SDVOSB certification');
    expect(p!.sourceLabel).toBe('sourced');
    expect(p!.text).toBe('Disabled-led (sourced)');
    expect(p!.provenance).toContain('a federal SBA SDVOSB certification');
    // The specific regression: a sourced claim must not describe itself as an
    // attestation the business made to us.
    expect(p!.provenance).toContain('has not told us directly');
    expect(p!.isTrustworthyClaim).toBe(true);
  });

  it('still explains a sourced claim when the citation is missing', () => {
    const p = presentRepresentation('owned', true, 'sourced', '   ');
    expect(p!.provenance).toMatch(/certification, audit, or partner/);
    expect(p!.provenance).not.toMatch(/Backed by: \./);
  });

  it('exposes the axis definition independently of any claim', () => {
    // Detail pages show what the axis MEANS even when the answer is "Not attested".
    expect(representationDefinition('owned')).toMatch(/51%/);
    expect(representationDefinition('led')).toMatch(/leadership/);
  });
});

describe('end to end: the exact production defect', () => {
  it('Apnea Care no longer reads "self-attested"', () => {
    const seedRecord = {
      name: 'Apnea Care Inc',
      disabled_owned: true,
      disabled_led: true,
      _review: {
        flags: ['sdvosb_federal_cert', 'sdvob_veteran_subset', 'disabled_owned_needs_attestation'],
      },
    };
    const cols = representationColumns(seedRecord);
    const shown = presentRepresentation(
      'owned',
      seedRecord.disabled_owned,
      cols.disabled_owned_source as 'sourced',
      cols.representation_note,
    );
    expect(shown!.sourceLabel).toBe('sourced');
    expect(shown!.text).not.toContain('self-attested');
  });

  it('a pre-0012 production row publishes nothing at all', () => {
    // Every existing row: flag true, source null. Silence, not a claim.
    expect(presentRepresentation('owned', true, null)).toBeNull();
  });
});
