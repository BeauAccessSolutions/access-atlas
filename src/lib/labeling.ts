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
import type { AttributeState, AttributeStatus } from './types';

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
