// -----------------------------------------------------------------------------
// The single source of truth for how a validation state is spoken to users.
//
// SAFETY-CRITICAL (§4, §14). Honest labeling is a non-negotiable. Rules encoded
// here, enforced by the fact that every UI surface imports from this file:
//   * Never say "verified" or "high confidence" for self-reported data.
//   * "high confidence" is reserved for the `sourced` state ONLY.
//   * Unconfirmed data reads "self-reported / awaiting verification".
//   * A dissented claim reads as under re-review, never as good.
//
// If you find yourself hand-writing a status string in a component, stop and add
// it here instead. One vocabulary, one place.
//
// The label texts are quoted verbatim in docs/manual-at-testing.md (marked
// "[exact wording matters]") — if you change them, update the run sheet too.
// -----------------------------------------------------------------------------
import type { AttributeState, AttributeStatus, RepresentationSource } from './types';

export interface LabelPresentation {
  /** Short human label. */
  text: string;
  /** Longer plain-language explanation (cognitive accessibility, §5). */
  description: string;
  /** Stable token for CSS / test hooks. Not shown to users. */
  tone: 'unverified' | 'partial' | 'verified' | 'sourced' | 'disputed';
  /** True only where a strong trust claim is honest (§4). */
  isTrustworthyClaim: boolean;
}

export function presentState(status: AttributeStatus): LabelPresentation {
  const n = status.agreeCount;

  switch (status.state) {
    case 'community_verified':
      return {
        text: 'Community-verified',
        description: `Confirmed by ${n} independent first-person visits.`,
        tone: 'verified',
        isTrustworthyClaim: true,
      };

    case 'sourced':
      return {
        text: 'Sourced',
        description:
          status.sourcedNote?.trim()
            ? `High confidence — backed by: ${status.sourcedNote.trim()}.`
            : 'High confidence — backed by a certification, audit, or partner.',
        tone: 'sourced',
        isTrustworthyClaim: true,
      };

    case 'disputed':
      return {
        text: 'Disputed — under re-review',
        description:
          'Someone reported this is NOT accessible from their own visit, so the claim is frozen pending re-review. Do not rely on it.',
        tone: 'disputed',
        isTrustworthyClaim: false,
      };

    case 'community_confirmations':
      return {
        text: n === 1 ? '1 community confirmation' : `${n} community confirmations`,
        description:
          'Reported by first-person visits, but below the confirmation bar. Not yet community-verified.',
        tone: 'partial',
        isTrustworthyClaim: false,
      };

    case 'self_reported':
    default:
      return {
        text: 'Self-reported / awaiting verification',
        description:
          'Reported but not yet confirmed by community visits. Treat as unverified.',
        tone: 'unverified',
        isTrustworthyClaim: false,
      };
  }
}

// -----------------------------------------------------------------------------
// Representation (§1, §12) — a SEPARATE axis from attribute validation above.
//
// "Self-attested" is a claim about WHO SPOKE, not a hedge. Saying it when nobody
// spoke is a lie in the trust-building direction, which is the one direction
// this project cannot afford (§2, §7). Production shipped exactly that: every
// true `disabled_owned` rendered "(self-attested)", including 8 seeded listings
// whose own review notes said attestation was still needed.
//
// So the boolean is not enough to render. Provenance decides:
//   * no claim, or unknown provenance -> null, publish NOTHING. Unknown must
//     degrade to silence, never to a claim. This is what makes the fix hold even
//     for rows imported before provenance existed.
//   * 'self_attested' -> "(self-attested)", the honest weak label.
//   * 'sourced'       -> "(sourced)" plus the citation, the honest STRONG label.
//     A government certification is better evidence than a checkbox; §4 reserves
//     the `sourced` state for exactly this and it should not be downgraded.
// -----------------------------------------------------------------------------
export type RepresentationAxis = 'owned' | 'led';

export interface RepresentationPresentation {
  /** Short tag text, e.g. "Disabled-owned (sourced)". */
  text: string;
  /** Just the parenthetical, for call sites that render the axis name already. */
  sourceLabel: 'self-attested' | 'sourced';
  /** The axis definition in plain language (§5), always shown on detail pages. */
  definition: string;
  /** Where the claim came from, in plain language. Never omitted. */
  provenance: string;
  tone: 'sourced' | 'unverified';
  /** True only for `sourced` — mirrors LabelPresentation.isTrustworthyClaim. */
  isTrustworthyClaim: boolean;
}

/**
 * The plain-language definition of an axis, independent of whether any claim
 * exists. Detail pages show the definition even when the answer is "Not
 * attested", so a reader learns what the axis MEANS either way (§5).
 */
export function representationDefinition(axis: RepresentationAxis): string {
  return AXIS_COPY[axis].definition;
}

const AXIS_COPY: Record<RepresentationAxis, { label: string; definition: string }> = {
  owned: {
    label: 'Disabled-owned',
    definition: 'a disabled person owns 51% or more',
  },
  led: {
    label: 'Disabled-led',
    definition: 'a disabled person holds primary leadership',
  },
};

export function presentRepresentation(
  axis: RepresentationAxis,
  claimed: boolean,
  source: RepresentationSource | null | undefined,
  note?: string | null,
): RepresentationPresentation | null {
  // FAIL SAFE. No claim, or a claim with no recorded provenance, publishes
  // nothing at all. Do not "helpfully" fall back to self-attested here — that
  // fallback IS the bug (migration 0012).
  if (!claimed || !source) return null;

  const { label, definition } = AXIS_COPY[axis];

  if (source === 'sourced') {
    const cite = note?.trim();
    return {
      text: `${label} (sourced)`,
      sourceLabel: 'sourced',
      definition,
      provenance: cite
        ? `Backed by: ${cite}. Not a self-attestation — the business has not told us directly.`
        : 'Backed by a certification, audit, or partner organization. Not a self-attestation.',
      tone: 'sourced',
      isTrustworthyClaim: true,
    };
  }

  return {
    text: `${label} (self-attested)`,
    sourceLabel: 'self-attested',
    definition,
    provenance: 'The business told us this themselves. No medical proof is ever required, or asked for.',
    tone: 'unverified',
    isTrustworthyClaim: false,
  };
}

// Staleness is orthogonal to state (§4, time-decay). A claim can be
// community-verified AND stale — surface both, never hide staleness.
export function staleness(status: AttributeStatus): string | null {
  if (!status.isStale) return null;
  return 'Last confirmed a while ago — access facts change; needs re-confirmation.';
}

// Convenience for tests / assertions: the exact allowed vocabulary.
export const ALLOWED_STATES: AttributeState[] = [
  'self_reported',
  'community_confirmations',
  'community_verified',
  'sourced',
  'disputed',
];
