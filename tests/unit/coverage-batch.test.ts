// Bulk coverage: the call-sheet CSV loop (migration 0016).
//
// Two things carry real risk here and get most of the attention:
//   1. A hand-written CSV parser. A spreadsheet WILL emit quoted commas in a
//      note field, and a parser that mis-splits one row writes one practice's
//      answers onto another.
//   2. Blank-means-leave-unchanged. If blank ever came to mean "clear", one
//      half-finished call sheet would silently wipe every fact it didn't
//      mention.
import { describe, it, expect } from 'vitest';
import { csvField, parseCsv, parseCoverageBatch, toCsv } from '../../src/lib/coverage-batch';

const ACTOR = 'ops-cli:tester';

function sheet(rows: string[]): string {
  return ['listing_id,name,new_patients,medicaid,medicare,telehealth,source,as_of,note,reason', ...rows].join('\n');
}

describe('parseCsv', () => {
  it('reads a plain table', () => {
    expect(parseCsv('a,b\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps a quoted comma inside one field', () => {
    // The realistic case: a note like "NY State of Health, August 2026".
    const [, row] = parseCsv('a,b\n"one, two",three\n');
    expect(row).toEqual(['one, two', 'three']);
  });

  it('unescapes a doubled quote', () => {
    const [, row] = parseCsv('a\n"she said ""yes"""\n');
    expect(row).toEqual(['she said "yes"']);
  });

  it('keeps a newline inside a quoted field', () => {
    const rows = parseCsv('a,b\n"line one\nline two",x\n');
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe('line one\nline two');
  });

  it('handles CRLF, a trailing newline, and blank spacer rows', () => {
    expect(parseCsv('a,b\r\n1,2\r\n\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('strips the BOM Excel writes', () => {
    // Without this the first header becomes "﻿listing_id" and no column matches.
    expect(parseCsv('﻿listing_id,name\nx,y\n')[0][0]).toBe('listing_id');
  });

  it('preserves empty fields rather than collapsing them', () => {
    expect(parseCsv('a,b,c\n1,,3\n')[1]).toEqual(['1', '', '3']);
  });

  it('round-trips through toCsv', () => {
    const rows = [['id-1', 'Practice, The', 'he said "no"', null]];
    const parsed = parseCsv(toCsv(['a', 'b', 'c', 'd'], rows));
    expect(parsed[1]).toEqual(['id-1', 'Practice, The', 'he said "no"', '']);
  });

  it('quotes only when it must', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('has,comma')).toBe('"has,comma"');
    expect(csvField(null)).toBe('');
  });
});

describe('parseCoverageBatch', () => {
  it('reads a filled row into a write request', () => {
    const { rows, problems } = parseCoverageBatch(
      sheet(['id-1,Lakeshore,yes,yes,no,yes,self_attested,2026-08-01,,called them']),
      { actor: ACTOR },
    );
    expect(problems).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].request.values).toEqual({
      acceptingNewPatients: true,
      acceptsMedicaid: true,
      acceptsMedicare: false,
      offersTelehealth: true,
    });
    expect(rows[0].request.asOf).toBe('2026-08-01');
    expect(rows[0].declaredName).toBe('Lakeshore');
  });

  it('treats a BLANK cell as leave-unchanged, not as clear', () => {
    // The decision that protects a half-worked call sheet.
    const { rows } = parseCoverageBatch(
      sheet(['id-1,Lakeshore,yes,,,,self_attested,2026-08-01,,called them']),
      { actor: ACTOR },
    );
    expect(rows[0].request.values).toEqual({ acceptingNewPatients: true });
    expect('acceptsMedicaid' in rows[0].request.values).toBe(false);
  });

  it('treats "unknown" as an explicit clear', () => {
    const { rows } = parseCoverageBatch(
      sheet(['id-1,Lakeshore,unknown,,,,self_attested,2026-08-01,,retracting']),
      { actor: ACTOR },
    );
    expect(rows[0].request.values.acceptingNewPatients).toBe('unknown');
  });

  it('skips an entirely blank row quietly — an unreached practice is normal', () => {
    const { rows, problems } = parseCoverageBatch(
      sheet([
        'id-1,Lakeshore,yes,,,,self_attested,2026-08-01,,called them',
        'id-2,Unreached,,,,,self_attested,,,',
      ]),
      { actor: ACTOR },
    );
    expect(problems).toEqual([]);
    expect(rows).toHaveLength(1);
  });

  it('rejects a junk cell rather than guessing', () => {
    const { problems } = parseCoverageBatch(
      sheet(['id-1,Lakeshore,maybe,,,,self_attested,2026-08-01,,x']),
      { actor: ACTOR },
    );
    expect(problems[0]).toMatch(/new_patients must be yes, no, unknown, or blank/);
  });

  it('refuses a duplicated listing_id rather than letting the last row win', () => {
    const { problems } = parseCoverageBatch(
      sheet([
        'id-1,Lakeshore,yes,,,,self_attested,2026-08-01,,x',
        'id-1,Lakeshore,no,,,,self_attested,2026-08-01,,x',
      ]),
      { actor: ACTOR },
    );
    expect(problems[0]).toMatch(/appears more than once/);
  });

  it('reports EVERY problem, with file line numbers', () => {
    const { problems } = parseCoverageBatch(
      sheet([
        'id-1,A,maybe,,,,self_attested,2026-08-01,,x',
        ',B,yes,,,,self_attested,2026-08-01,,x',
        'id-3,C,,perhaps,,,self_attested,2026-08-01,,x',
      ]),
      { actor: ACTOR },
    );
    expect(problems).toHaveLength(3);
    expect(problems[0]).toMatch(/^Row 2:/);
    expect(problems[1]).toMatch(/^Row 3:/);
    expect(problems[2]).toMatch(/^Row 4:/);
  });

  it('refuses a file missing required columns', () => {
    const { problems } = parseCoverageBatch('name,medicaid\nx,yes\n', { actor: ACTOR });
    expect(problems[0]).toMatch(/Missing required column\(s\): listing_id, source, as_of/);
  });

  it('falls back to --reason when the row has none', () => {
    const { rows } = parseCoverageBatch(
      sheet(['id-1,Lakeshore,yes,,,,self_attested,2026-08-01,,']),
      { actor: ACTOR, defaultReason: 'August calling campaign' },
    );
    expect(rows[0].request.reason).toBe('August calling campaign');
  });

  it('tolerates reordered and upper-case headers', () => {
    const csv = 'Name,LISTING_ID,Medicaid,Source,As_Of,Reason\nLakeshore,id-1,yes,sourced,2026-08-01,directory\n';
    const { rows, problems } = parseCoverageBatch(csv, { actor: ACTOR });
    expect(problems).toEqual([]);
    expect(rows[0].request.listingId).toBe('id-1');
    expect(rows[0].request.values).toEqual({ acceptsMedicaid: true });
    expect(rows[0].request.source).toBe('sourced');
  });

  it('handles an empty file honestly', () => {
    expect(parseCoverageBatch('', { actor: ACTOR }).problems).toEqual(['The file is empty.']);
  });
});
