// Bulk provider coverage: parsing a filled-in call sheet (migration 0016).
//
// THE WORKFLOW THIS SERVES. Someone rings a batch of WNY practices over a week
// and records what they are told. That produces a SPREADSHEET, not JSON — so the
// interchange format is CSV, and the same file round-trips: export a call sheet
// pre-filled with what we currently hold, fill in the answers, import it back.
//
// BLANK MEANS "LEAVE UNCHANGED", NEVER "CLEAR". This is the single most
// consequential decision in the file. A call sheet is always partly filled —
// you got through to twelve of forty practices, and you didn't ask every
// practice every question. If blank meant "set to unknown", one half-finished
// sheet would silently wipe every fact it didn't mention. To clear a fact you
// type `unknown`, which is a decision someone made, not the absence of one.
//
// That choice USED to re-open a trap: with one shared source/date per provider
// (migration 0014), leaving a published fact blank while stamping a new date
// relabelled it with provenance nobody gave it, so every row had to be checked
// by `carriedOverFlags` and operators were made to re-state facts they had never
// asked about. Migration 0017 gave each fact its own source and date, so a
// partial row is now simply safe and that guard is gone. Blank means blank.
//
// VALIDATE THE WHOLE BATCH BEFORE WRITING ANY OF IT — the same posture as
// seed-import.mjs ("refuses unknown attribute keys instead of silently dropping
// them"). A forty-row import that half-applies is worse than one that refuses.
import type { CoverageInput, CoverageWriteRequest } from './coverage-write';
import type { CoverageSource } from './types';

/** Columns the call sheet uses, in order. `name` is a human/safety column. */
export const CALL_SHEET_COLUMNS = [
  'listing_id',
  'name',
  'new_patients',
  'medicaid',
  'medicare',
  'telehealth',
  'source',
  'as_of',
  'note',
  'reason',
] as const;

const FLAG_COLUMNS: [string, keyof CoverageWriteRequest['values']][] = [
  ['new_patients', 'acceptingNewPatients'],
  ['medicaid', 'acceptsMedicaid'],
  ['medicare', 'acceptsMedicare'],
  ['telehealth', 'offersTelehealth'],
];

/**
 * Minimal RFC 4180 CSV reader: quoted fields, doubled quotes inside them, and
 * commas or newlines within quotes. Hand-written because the repo has no CSV
 * dependency and this is the only place that needs one — but a spreadsheet WILL
 * emit quoted commas in a note field, so the quoting rules are not optional.
 * Handles CRLF and a trailing newline.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  // Strip a UTF-8 BOM — Excel writes one, and it would corrupt the first header.
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    // Skip rows that are entirely empty (a trailing newline, a blank spacer).
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // an escaped quote
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === ',') {
      endField();
      i += 1;
    } else if (ch === '\r') {
      i += 1; // CRLF: the \n does the work
    } else if (ch === '\n') {
      endRow();
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

/** Render one CSV field, quoting only when it must be. */
export function csvField(value: string | null | undefined): string {
  const v = value ?? '';
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Render a full CSV document from a header and rows. */
export function toCsv(header: readonly string[], rows: (string | null)[][]): string {
  return [header.map(csvField).join(','), ...rows.map((r) => r.map(csvField).join(','))].join('\n') + '\n';
}

export interface ParsedBatchRow {
  /** 1-based row number in the FILE (header is row 1) — for error messages. */
  line: number;
  /** The name column as typed, for the row-shift safety check. */
  declaredName: string | null;
  request: CoverageWriteRequest;
}

export interface ParsedBatch {
  rows: ParsedBatchRow[];
  problems: string[];
}

/** yes/no/unknown -> tri-state. Blank returns undefined (leave unchanged). */
function parseCell(raw: string): CoverageInput | undefined | 'invalid' {
  const v = raw.trim().toLowerCase();
  if (v === '') return undefined;
  if (v === 'yes' || v === 'y' || v === 'true') return true;
  if (v === 'no' || v === 'n' || v === 'false') return false;
  if (v === 'unknown' || v === 'clear') return 'unknown';
  return 'invalid';
}

/**
 * Turn a parsed call sheet into write requests.
 *
 * Collects EVERY problem across the whole file rather than stopping at the
 * first — an operator fixing a forty-row sheet should get one list, not forty
 * runs.
 */
export function parseCoverageBatch(
  csv: string,
  opts: { actor: string; defaultReason?: string },
): ParsedBatch {
  const table = parseCsv(csv);
  const problems: string[] = [];
  const rows: ParsedBatchRow[] = [];

  if (table.length === 0) return { rows, problems: ['The file is empty.'] };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const missing = ['listing_id', 'source', 'as_of'].filter((c) => !header.includes(c));
  if (missing.length > 0) {
    return { rows, problems: [`Missing required column(s): ${missing.join(', ')}.`] };
  }
  const col = (name: string) => header.indexOf(name);
  const cell = (r: string[], name: string) => {
    const idx = col(name);
    return idx === -1 ? '' : (r[idx] ?? '');
  };

  const seen = new Set<string>();

  for (let r = 1; r < table.length; r += 1) {
    const line = r + 1; // 1-based, header is line 1
    const raw = table[r];
    const listingId = cell(raw, 'listing_id').trim();
    if (!listingId) {
      problems.push(`Row ${line}: no listing_id.`);
      continue;
    }
    // A duplicated id means two rows fight over the same record and the last
    // one silently wins — refuse rather than pick.
    if (seen.has(listingId)) {
      problems.push(`Row ${line}: listing_id ${listingId} appears more than once.`);
      continue;
    }
    seen.add(listingId);

    const values: CoverageWriteRequest['values'] = {};
    let cellError = false;
    for (const [column, key] of FLAG_COLUMNS) {
      const parsed = parseCell(cell(raw, column));
      if (parsed === 'invalid') {
        problems.push(
          `Row ${line}: ${column} must be yes, no, unknown, or blank (got "${cell(raw, column).trim()}").`,
        );
        cellError = true;
        continue;
      }
      // undefined = blank = leave unchanged. See the header note.
      if (parsed !== undefined) values[key] = parsed;
    }
    if (cellError) continue;

    if (Object.keys(values).length === 0) {
      // Every flag blank: nothing to do. Not an error — an unreached practice is
      // the normal state of a partly-worked call sheet. Skip it quietly.
      continue;
    }

    const reason = (cell(raw, 'reason').trim() || opts.defaultReason || '').trim();
    const request: CoverageWriteRequest = {
      listingId,
      values,
      source: (cell(raw, 'source').trim() || 'self_attested') as CoverageSource,
      asOf: cell(raw, 'as_of').trim(),
      note: cell(raw, 'note').trim() || null,
      reason,
      actor: opts.actor,
    };

    rows.push({ line, declaredName: cell(raw, 'name').trim() || null, request });
  }

  if (rows.length === 0 && problems.length === 0) {
    problems.push('No rows had any coverage answers filled in.');
  }
  return { rows, problems };
}
