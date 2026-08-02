// "Questions to ask before you go" — the ask-ahead script (§5 plain language).
//
// NAMING, deliberately: this is NOT called a "call-ahead script". Phoning is
// itself an access barrier for Deaf and hard-of-hearing people, for people with
// speech disabilities, and for people whose anxiety or processing needs make an
// unscripted live call expensive. So the page is modality-neutral — the same
// questions work by phone, email, text or a contact form — and it never tells
// anyone to pick up a phone.
//
// WHY THE COPY LIVES IN TYPESCRIPT and not in the attribute catalog (which
// migration 0013 moved into the migration chain): the catalog is *validation*
// data — which facts exist and whose lived experience weights them — and it
// changes rarely. This is *interface copy*, it is explicitly not yet
// community-reviewed, and it will churn. Making a wording fix require a
// migration would slow down exactly the iteration this text most needs. The
// drift risk that motivated putting the catalog in one home is handled instead
// by tests/unit/call-ahead.test.ts, which fails if the catalog and this file
// ever disagree about which attributes exist.
//
// The `ask` line is what a person can say or write, in the present tense. It is
// deliberately NOT the catalog's `question_text`, which is a past-tense
// first-person question about a visit that already happened ("On your visit,
// could you enter with zero steps?") and reads as nonsense on a phone call.
//
// The `followUp` line is the point of the whole feature. "Are you accessible?"
// reliably gets a confident, useless yes. The follow-up is the specific thing
// to ask next so the answer means something.
import type { AttributeStatus } from './types';

export interface AskAheadCopy {
  /** What to say or write, present tense, plain language. */
  ask: string;
  /** What to ask next so a vague "yes, we're accessible" becomes a real answer. */
  followUp: string;
}

/**
 * Keyed by attribute key. Every key in the catalog must appear here — enforced
 * by tests/unit/call-ahead.test.ts.
 *
 * Some follow-ups state what the ADA requires (interpreter provision, the two
 * questions staff may ask about a service animal). Those are accurate, widely
 * published general information, and knowing them is often the difference
 * between being served and being turned away. They are general information, not
 * legal advice, and the page says so.
 */
export const ASK_AHEAD: Record<string, AskAheadCopy> = {
  entrance_step_free: {
    ask: 'Is there a way in without any steps — either level with the sidewalk, or a ramp?',
    followUp:
      'If they say yes, ask whether that is the main door or a different one, and whether it is kept unlocked while you are open.',
  },
  accessible_restroom: {
    ask: 'Do you have a wheelchair-accessible restroom that customers can use?',
    followUp:
      'If they say yes, ask whether the doorway is wide enough for a wheelchair, and whether anything is being stored inside it.',
  },
  accessible_parking: {
    ask: 'Is there marked accessible parking, and how far is it from the entrance?',
    followUp:
      'If they say yes, ask whether it is van-accessible (the wider space with the striped area beside it), and whether there is a curb cut between it and the door.',
  },
  height_adjustable_exam_table: {
    ask: 'Do you have an exam table that lowers, so I can transfer onto it from my wheelchair?',
    followUp:
      'If they say yes, ask how low it goes, and whether someone working on the day of my appointment knows how to operate it.',
  },
  accessible_scale: {
    ask: 'Do you have a scale I can use without standing — one I can roll onto, or a seated scale?',
    followUp:
      'If they say no, ask whether my weight can be recorded another way, or taken somewhere else, rather than skipped or guessed.',
  },
  communicated_directly: {
    ask: 'If I come with someone else, will your staff speak to me directly rather than to them?',
    followUp:
      'It is fair to say this plainly when you arrive: please talk to me, not to the person with me.',
  },
  staff_knew_equipment: {
    ask: 'Will someone working on the day of my appointment be trained to use your accessible equipment?',
    followUp:
      'If they are not sure, ask them to check the schedule — or to book me for a time when that person is in.',
  },
  interpreter_on_request: {
    ask: 'I need an ASL interpreter for my appointment. Can you arrange one, at no cost to me?',
    followUp:
      'Ask how much notice they need, and get the booking confirmed in writing. Under the ADA, arranging and paying for the interpreter is the provider’s responsibility, not yours — and a family member is not a substitute.',
  },
  staff_communicate_in_writing: {
    ask: 'Are your staff willing to communicate in writing — notes, or typing on a phone or tablet?',
    followUp:
      'If they say yes, ask whether that applies at the front desk too, not only once someone has taken me aside.',
  },
  captions_on_screens: {
    ask: 'Are the captions turned on for your TVs or video screens?',
    followUp:
      'If they do not know, ask whether staff can turn captions on when someone asks.',
  },
  service_animal_welcomed: {
    ask: 'I use a service animal. Will there be any problem bringing them in?',
    followUp:
      'If they hesitate: staff may only ask two things — whether the animal is required because of a disability, and what task it is trained to do. They may not ask what your disability is, ask to see documentation, or charge you extra.',
  },
  staff_read_aloud: {
    ask: 'If I cannot read your printed menu or forms, will staff read them to me?',
    followUp:
      'If they say yes, ask whether forms can also be sent ahead of time in a format a screen reader can read.',
  },
  quiet_waiting_space: {
    ask: 'Is there a quieter place to wait, away from noise and crowds?',
    followUp:
      'If there is not, ask whether I can wait outside or in a car, and be texted or fetched when it is my turn.',
  },
  plain_language_help: {
    ask: 'If I need something explained in plain language, or help filling in a form, will staff do that?',
    followUp:
      'If they say yes, ask whether I can have extra time, and take the instructions away in writing rather than having to remember them.',
  },
  seating_available: {
    ask: 'Is there somewhere to sit while waiting, and roughly how long is the wait?',
    followUp:
      'If seating is limited, ask whether I can be seated when I arrive rather than standing in a queue.',
  },
};

/** Why this question is worth asking — drives ordering and the honest note. */
export type AskReason =
  | 'disputed' // someone reported a problem: the live red flag
  | 'stale' // last confirmed too long ago (§4 time-decay)
  | 'self_reported' // claimed, but no first-person visit backs it
  | 'untracked' // nobody has reported on it at all
  | 'partly_confirmed'; // some agreement, still under the bar

export interface AskAheadItem {
  attributeKey: string;
  label: string;
  ask: string;
  followUp: string;
  reason: AskReason;
  /** ISO date of the last agreeing confirmation, when there is one. */
  lastConfirmedAt: string | null;
}

/** A fact the community has already settled — shown so nobody asks needlessly. */
export interface SettledItem {
  attributeKey: string;
  label: string;
  /** 'community_verified' | 'sourced' — the two states worth trusting (§4). */
  state: AttributeStatus['state'];
  lastConfirmedAt: string | null;
}

// Most urgent first. A disputed fact is an active warning; an untracked one is
// merely unknown; a partly-confirmed one already has evidence behind it.
const REASON_ORDER: AskReason[] = [
  'disputed',
  'stale',
  'self_reported',
  'untracked',
  'partly_confirmed',
];

function reasonFor(status: AttributeStatus): AskReason | null {
  if (status.state === 'disputed') return 'disputed';
  // Staleness outranks the state: a fact confirmed three times in 2019 is not a
  // fact about today (§4 time-decay). `sourced` is checked after, so a stale
  // sourced claim is still surfaced for re-asking.
  if (status.isStale) return 'stale';
  if (status.state === 'sourced' || status.state === 'community_verified') return null;
  if (status.state === 'self_reported') return 'self_reported';
  return 'partly_confirmed';
}

/**
 * Split a listing's accessibility facts into "worth asking about" and "already
 * answered", ordered by urgency.
 *
 * Pure: takes what the page already loaded, so it is unit-testable without a DB.
 * `defs` is the full catalog for the listing's kind, so facts nobody has
 * reported on still produce a question — those are the ones most worth asking,
 * since the community has told you nothing.
 */
export function buildAskAhead(
  statuses: AttributeStatus[],
  defs: { key: string; label: string }[],
): { ask: AskAheadItem[]; settled: SettledItem[] } {
  const ask: AskAheadItem[] = [];
  const settled: SettledItem[] = [];
  const seen = new Set<string>();

  for (const status of statuses) {
    const copy = ASK_AHEAD[status.attributeKey];
    if (!copy) continue; // an attribute with no copy yet: silently skip, never render a blank
    seen.add(status.attributeKey);

    const reason = reasonFor(status);
    if (reason === null) {
      settled.push({
        attributeKey: status.attributeKey,
        label: status.label,
        state: status.state,
        lastConfirmedAt: status.lastConfirmedAt,
      });
      continue;
    }
    ask.push({
      attributeKey: status.attributeKey,
      label: status.label,
      ask: copy.ask,
      followUp: copy.followUp,
      reason,
      lastConfirmedAt: status.lastConfirmedAt,
    });
  }

  for (const def of defs) {
    if (seen.has(def.key)) continue;
    const copy = ASK_AHEAD[def.key];
    if (!copy) continue;
    ask.push({
      attributeKey: def.key,
      label: def.label,
      ask: copy.ask,
      followUp: copy.followUp,
      reason: 'untracked',
      lastConfirmedAt: null,
    });
  }

  ask.sort((a, b) => {
    const byReason = REASON_ORDER.indexOf(a.reason) - REASON_ORDER.indexOf(b.reason);
    return byReason !== 0 ? byReason : a.label.localeCompare(b.label);
  });
  settled.sort((a, b) => a.label.localeCompare(b.label));

  return { ask, settled };
}

/** Plain-language note explaining why a question made the list (§5). */
export function reasonNote(reason: AskReason): string {
  switch (reason) {
    case 'disputed':
      return 'Someone reported a problem with this. Worth asking about first.';
    case 'stale':
      return 'Last confirmed a while ago — access facts change, so this one is worth re-checking.';
    case 'self_reported':
      return 'Claimed, but no visitor has confirmed it yet.';
    case 'untracked':
      return 'Nobody has reported on this at all.';
    case 'partly_confirmed':
      return 'Some visitors have confirmed this, but not enough yet to be community-verified.';
  }
}
