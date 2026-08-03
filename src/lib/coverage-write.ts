// Writing provider coverage (migrations 0016-0017).
//
// THE RULE: never store what we could not publish. Since 0017 the schema
// enforces most of it — `provider_coverage_facts.source` and `.as_of` are NOT
// NULL, so a fact without provenance is unstorable rather than merely
// unrenderable. What is left here is the part SQL can't express: a `sourced`
// fact needs a citation, a date must be real and not in the future, and a write
// must say who did it and how they know.
//
// WHAT 0017 DELETED. This file used to carry `carriedOverFlags`, a guard against
// our own schema: because one source/date covered the whole provider, updating
// one fact would silently relabel the others with provenance nobody gave them.
// It caused a real bug in the single-record path and constant friction in the
// bulk one. Per-fact provenance removes the problem, so the guard is gone —
// **a partial write is now simply safe**, which is what it always looked like.
//
// Coverage has NO consensus layer (0014) — a single write publishes immediately,
// with no three-confirmation bar and no dissent freeze to absorb a mistake. That
// is why this path is ops-only, why `reason` and `actor` are mandatory, and why
// every write lands in the append-only audit with its before-state.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CoverageKey, CoverageSource, ProviderCoverage } from './types';
import { COVERAGE_DB_KEYS, COVERAGE_KEY_BY_DB, COVERAGE_ORDER } from './coverage';
import { recordModerationAudit } from './moderation';

/** Per-fact input. `unknown` deletes the fact (we no longer claim to know). */
export type CoverageInput = boolean | 'unknown';

export type CoverageUpdate = Partial<Record<CoverageKey, CoverageInput>>;

export interface CoverageWriteRequest {
  listingId: string;
  values: CoverageUpdate;
  /** Provenance for the facts SET by this write. Irrelevant to ones cleared. */
  source: CoverageSource;
  /** ISO date (YYYY-MM-DD) these facts were confirmed with the practice. */
  asOf: string;
  /** Citation, required when source is 'sourced' (§7 — a sourced claim must be checkable). */
  note?: string | null;
  /** How the operator knows. Mandatory: a published money fact must be accountable. */
  reason: string;
  /** Who acted, e.g. 'ops-cli:<operator>'. Never a contributor id (§6). */
  actor: string;
}

export interface CoverageWriteResult {
  before: ProviderCoverage;
  after: ProviderCoverage;
  auditId: string;
  /** Fact keys deleted by this write (set back to unknown). */
  cleared: CoverageKey[];
}

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
 * Pure and exported so the ops CLIs can fail before touching the database, and
 * so the rules are unit-testable without one.
 */
export function validateCoverageWrite(req: CoverageWriteRequest, now = new Date()): string[] {
  const problems: string[] = [];

  if (!req.listingId?.trim()) problems.push('A listing id is required.');
  if (!req.reason?.trim()) problems.push('A reason is required — record how you know.');
  if (!req.actor?.trim()) problems.push('An actor is required.');

  const provided = COVERAGE_ORDER.filter((key) => req.values[key] !== undefined);
  if (provided.length === 0) {
    problems.push('Set at least one coverage fact (yes / no / unknown).');
  }

  // Provenance describes what is being SET. A write that only clears facts needs
  // none — demanding a source for a fact being *removed* would block the
  // legitimate "our note was wrong, retract it" path.
  const setting = provided.filter((key) => req.values[key] !== 'unknown');
  if (setting.length === 0) return problems;

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

/** provider_coverage_facts rows -> the keyed ProviderCoverage map. */
export function rowsToCoverage(rows: any[] | null | undefined): ProviderCoverage {
  const coverage: ProviderCoverage = {};
  for (const row of rows ?? []) {
    const key = COVERAGE_KEY_BY_DB[row.key];
    // An unrecognized key (a fact retired from the vocabulary) is ignored rather
    // than crashing the page — the DB column is free text on purpose.
    if (!key) continue;
    coverage[key] = {
      value: !!row.value,
      source: row.source,
      asOf: typeof row.as_of === 'string' ? row.as_of.slice(0, 10) : row.as_of,
      note: row.note ?? null,
    };
  }
  return coverage;
}

/**
 * Apply a coverage update and record it in the append-only audit.
 *
 * Only the facts present in `values` change; every other fact keeps its own
 * source and date untouched — that is the whole point of 0017. `'unknown'`
 * deletes a fact (we stop claiming to know it).
 */
export async function updateProviderCoverage(
  admin: SupabaseClient,
  req: CoverageWriteRequest,
  now = new Date(),
): Promise<CoverageWriteResult> {
  const problems = validateCoverageWrite(req, now);
  if (problems.length > 0) {
    throw new Error(
      `Refusing to write an unpublishable coverage record:\n  - ${problems.join('\n  - ')}`,
    );
  }

  // The listing must exist AND be a provider — coverage is meaningless on a
  // cafe, and a typo'd id must fail loudly rather than silently write nothing.
  const { data: listing, error: lErr } = await admin
    .from('listings')
    .select('id, kind, name')
    .eq('id', req.listingId)
    .maybeSingle();
  if (lErr) throw new Error(`Could not read listing: ${lErr.message}`);
  if (!listing) throw new Error(`No listing with id ${req.listingId}.`);
  if (listing.kind !== 'provider') {
    throw new Error(
      `Listing "${listing.name}" is a place, not a provider — coverage does not apply.`,
    );
  }

  const { data: beforeRows, error: bErr } = await admin
    .from('provider_coverage_facts')
    .select('key, value, source, as_of, note')
    .eq('listing_id', req.listingId);
  if (bErr) throw new Error(`Could not read coverage facts: ${bErr.message}`);
  const before = rowsToCoverage(beforeRows);

  const cleared: CoverageKey[] = [];
  const upserts: Record<string, unknown>[] = [];
  for (const key of COVERAGE_ORDER) {
    const value = req.values[key];
    if (value === undefined) continue; // untouched — keeps its own provenance
    if (value === 'unknown') {
      cleared.push(key);
      continue;
    }
    upserts.push({
      listing_id: req.listingId,
      key: COVERAGE_DB_KEYS[key],
      value,
      source: req.source,
      as_of: req.asOf,
      note: req.note?.trim() || null,
      updated_at: new Date(now).toISOString(),
    });
  }

  if (cleared.length > 0) {
    const { error } = await admin
      .from('provider_coverage_facts')
      .delete()
      .eq('listing_id', req.listingId)
      .in(
        'key',
        cleared.map((k) => COVERAGE_DB_KEYS[k]),
      );
    if (error) throw new Error(`Coverage clear failed: ${error.message}`);
  }

  if (upserts.length > 0) {
    const { error } = await admin
      .from('provider_coverage_facts')
      .upsert(upserts, { onConflict: 'listing_id,key' });
    if (error) throw new Error(`Coverage write failed: ${error.message}`);
  }

  const { data: afterRows, error: aErr } = await admin
    .from('provider_coverage_facts')
    .select('key, value, source, as_of, note')
    .eq('listing_id', req.listingId);
  if (aErr) throw new Error(`Could not re-read coverage facts: ${aErr.message}`);
  const after = rowsToCoverage(afterRows);

  const auditId = await recordModerationAudit(admin, {
    action: 'coverage_update',
    listingId: req.listingId,
    reason: req.reason,
    actor: req.actor,
    details: {
      before,
      after,
      changed: COVERAGE_ORDER.filter((key) => req.values[key] !== undefined),
      cleared,
      listingName: listing.name,
    },
  });

  return { before, after, auditId, cleared };
}
