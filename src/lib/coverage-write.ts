// Writing provider coverage (migration 0016). The seam between "who told us"
// and "what we store".
//
// THE RULE THIS FILE ENFORCES: never store what we could not publish.
//
// src/lib/coverage.ts already refuses to RENDER a coverage fact without a value,
// a source and a real date. That is a fail-safe at the last possible moment, and
// it is the right backstop — but a database full of unpublishable rows is its
// own problem: it looks like data, it reports like data, and every future reader
// has to re-derive why none of it shows up. So the same rules are enforced at
// the door. A write that could not be published is rejected, not stored.
//
// Coverage has NO consensus layer (0014) — a single write publishes immediately,
// with no three-confirmation bar and no dissent freeze to absorb a mistake. That
// is why this path is ops-only, why `reason` and `actor` are mandatory, and why
// every write lands in the append-only audit with its before-state.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CoverageSource, ProviderCoverage } from './types';
import { recordModerationAudit } from './moderation';

/** The three-valued input for one flag. `unknown` clears it back to NULL. */
export type CoverageInput = boolean | 'unknown';

export interface CoverageUpdate {
  acceptingNewPatients?: CoverageInput;
  acceptsMedicaid?: CoverageInput;
  acceptsMedicare?: CoverageInput;
  offersTelehealth?: CoverageInput;
}

export interface CoverageWriteRequest {
  listingId: string;
  values: CoverageUpdate;
  source: CoverageSource;
  /** ISO date (YYYY-MM-DD) this was confirmed with the practice. */
  asOf: string;
  /** Citation, required when source is 'sourced' (§7 — a sourced claim must be checkable). */
  note?: string | null;
  /** How the operator knows. Mandatory: a published money fact must be accountable. */
  reason: string;
  /** Who acted, e.g. 'ops-cli:<operator>'. Never a contributor id (§6). */
  actor: string;
}

export interface CoverageWriteResult {
  before: ProviderCoverage | null;
  after: ProviderCoverage;
  auditId: string;
  /** True when every flag ended up unknown — source/date are cleared with them. */
  clearedEntirely: boolean;
}

const FLAGS = [
  ['acceptingNewPatients', 'accepting_new_patients'],
  ['acceptsMedicaid', 'accepts_medicaid'],
  ['acceptsMedicare', 'accepts_medicare'],
  ['offersTelehealth', 'offers_telehealth'],
] as const;

/** YYYY-MM-DD, a real calendar date, not in the future. */
export function isPublishableAsOf(asOf: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return false;
  const parsed = Date.parse(`${asOf}T00:00:00Z`);
  if (Number.isNaN(parsed)) return false;
  // Round-trip guards against Date's silent rollover ('2026-02-31' -> Mar 3).
  if (new Date(parsed).toISOString().slice(0, 10) !== asOf) return false;
  // Compare against today's UTC date, so "confirmed today" is always allowed.
  return asOf <= now.toISOString().slice(0, 10);
}

/**
 * Validate a write request. Returns the problems; empty means publishable.
 *
 * Pure and exported so the ops CLI can fail before touching the database, and
 * so the rules are unit-testable without one.
 */
export function validateCoverageWrite(req: CoverageWriteRequest, now = new Date()): string[] {
  const problems: string[] = [];

  if (!req.listingId?.trim()) problems.push('A listing id is required.');
  if (!req.reason?.trim()) problems.push('A reason is required — record how you know.');
  if (!req.actor?.trim()) problems.push('An actor is required.');

  const provided = FLAGS.filter(([key]) => req.values[key] !== undefined);
  if (provided.length === 0) {
    problems.push('Set at least one coverage flag (yes / no / unknown).');
  }

  // If everything is being cleared, source and date are meaningless — and
  // demanding them would block the legitimate "we were wrong, retract it" path.
  const allUnknown =
    provided.length > 0 && provided.every(([key]) => req.values[key] === 'unknown');
  if (allUnknown) return problems;

  if (req.source !== 'self_attested' && req.source !== 'sourced') {
    problems.push("Source must be 'self_attested' or 'sourced'.");
  }
  // §7: a sourced claim names something a reader can go and check.
  if (req.source === 'sourced' && !req.note?.trim()) {
    problems.push("A 'sourced' claim needs a --note naming the source, so a reader can check it.");
  }
  if (!req.asOf?.trim()) {
    problems.push('An --as-of date is required; an undated coverage claim is not publishable.');
  } else if (!isPublishableAsOf(req.asOf, now)) {
    problems.push(`--as-of must be a real past-or-today date as YYYY-MM-DD (got "${req.asOf}").`);
  }

  return problems;
}

/**
 * Flags that would SURVIVE this write without being re-stated, while the shared
 * provenance changes underneath them.
 *
 * Migration 0014 stores ONE source/date/note for the whole coverage record —
 * right when the record is written in one go, wrong the moment a partial write
 * carries a new provenance. Updating only `--medicare` from a directory would
 * silently relabel the practice's own self-attested panel status as "From: NY
 * State of Health directory", asserting a provenance nobody has. That is exactly
 * the failure migration 0012 fixed for representation, reappearing here.
 *
 * So this is detected and refused rather than papered over. Returns the flag
 * names at risk; empty means the write is safe.
 */
export function carriedOverFlags(
  before: ProviderCoverage | null,
  req: Pick<CoverageWriteRequest, 'values' | 'source' | 'asOf' | 'note'>,
): string[] {
  if (!before) return [];

  const provenanceUnchanged =
    before.source === req.source &&
    before.asOf === req.asOf &&
    (before.note?.trim() || null) === (req.note?.trim() || null);
  // Same call, same batch: adding a flag to provenance that already describes it
  // is exactly right, and must stay frictionless.
  if (provenanceUnchanged) return [];

  return FLAGS.filter(
    ([key]) => before[key] !== null && req.values[key] === undefined,
  ).map(([key]) => key);
}

function rowToCoverage(row: any): ProviderCoverage | null {
  if (!row) return null;
  const coverage: ProviderCoverage = {
    acceptingNewPatients: row.accepting_new_patients ?? null,
    acceptsMedicaid: row.accepts_medicaid ?? null,
    acceptsMedicare: row.accepts_medicare ?? null,
    offersTelehealth: row.offers_telehealth ?? null,
    source: row.coverage_source ?? null,
    asOf: row.coverage_as_of ?? null,
    note: row.coverage_note ?? null,
  };
  const hasAny = FLAGS.some(([key]) => coverage[key] !== null);
  return hasAny ? coverage : null;
}

/**
 * Apply a coverage update and record it in the append-only audit.
 *
 * Only the flags present in `values` change; omitted ones keep whatever they
 * held. `'unknown'` clears a flag back to NULL (publishing nothing for it), and
 * clearing ALL of them clears the shared source/date/note too rather than
 * leaving orphaned provenance behind describing nothing.
 */
export async function updateProviderCoverage(
  admin: SupabaseClient,
  req: CoverageWriteRequest,
  now = new Date(),
): Promise<CoverageWriteResult> {
  const problems = validateCoverageWrite(req, now);
  if (problems.length > 0) {
    throw new Error(`Refusing to write an unpublishable coverage record:\n  - ${problems.join('\n  - ')}`);
  }

  // The listing must exist AND be a provider — coverage is meaningless on a
  // cafe, and a typo'd id must fail loudly rather than silently insert nothing.
  const { data: listing, error: lErr } = await admin
    .from('listings')
    .select('id, kind, name')
    .eq('id', req.listingId)
    .maybeSingle();
  if (lErr) throw new Error(`Could not read listing: ${lErr.message}`);
  if (!listing) throw new Error(`No listing with id ${req.listingId}.`);
  if (listing.kind !== 'provider') {
    throw new Error(`Listing "${listing.name}" is a place, not a provider — coverage does not apply.`);
  }

  const { data: beforeRow, error: bErr } = await admin
    .from('provider_profiles')
    .select(
      'accepting_new_patients, accepts_medicaid, accepts_medicare, offers_telehealth, coverage_source, coverage_as_of, coverage_note',
    )
    .eq('listing_id', req.listingId)
    .maybeSingle();
  if (bErr) throw new Error(`Could not read provider profile: ${bErr.message}`);
  const before = rowToCoverage(beforeRow);

  // Refuse to relabel facts this write did not actually re-confirm (see
  // carriedOverFlags). Fail before any mutation.
  const carried = carriedOverFlags(before, req);
  if (carried.length > 0) {
    throw new Error(
      `This write changes the shared source/date, but leaves ${carried.length} already-published ` +
        `flag(s) untouched: ${carried.join(', ')}.\n` +
        `Coverage stores ONE source and date for the whole record, so those would be silently ` +
        `relabelled with provenance they don't have.\n` +
        `Either re-state them in this write (if your new source covers them too), or set them to ` +
        `unknown to retract them.`,
    );
  }

  const patch: Record<string, unknown> = { listing_id: req.listingId };
  for (const [key, column] of FLAGS) {
    const value = req.values[key];
    if (value === undefined) continue;
    patch[column] = value === 'unknown' ? null : value;
  }

  // Would anything remain published after this write? Merge the patch over the
  // existing row rather than looking at the patch alone — clearing one flag
  // while another survives must NOT drop the shared provenance.
  const stillSet = FLAGS.some(([key, column]) =>
    column in patch ? patch[column] !== null : (beforeRow?.[column] ?? null) !== null,
  );

  if (stillSet) {
    patch.coverage_source = req.source;
    patch.coverage_as_of = req.asOf;
    patch.coverage_note = req.note?.trim() || null;
  } else {
    // Nothing publishable left: drop the provenance with it, so no orphaned
    // source/date sits in the row describing nothing.
    patch.coverage_source = null;
    patch.coverage_as_of = null;
    patch.coverage_note = null;
  }

  const { data: afterRow, error: uErr } = await admin
    .from('provider_profiles')
    .upsert(patch, { onConflict: 'listing_id' })
    .select(
      'accepting_new_patients, accepts_medicaid, accepts_medicare, offers_telehealth, coverage_source, coverage_as_of, coverage_note',
    )
    .single();
  if (uErr) throw new Error(`Coverage write failed: ${uErr.message}`);

  const auditId = await recordModerationAudit(admin, {
    action: 'coverage_update',
    listingId: req.listingId,
    reason: req.reason,
    actor: req.actor,
    details: {
      before: before ?? null,
      after: rowToCoverage(afterRow),
      changed: FLAGS.filter(([key]) => req.values[key] !== undefined).map(([key]) => key),
      listingName: listing.name,
    },
  });

  return {
    before,
    after: rowToCoverage(afterRow) ?? {
      acceptingNewPatients: null,
      acceptsMedicaid: null,
      acceptsMedicare: null,
      offersTelehealth: null,
      source: null,
      asOf: null,
      note: null,
    },
    auditId,
    clearedEntirely: !stillSet,
  };
}
