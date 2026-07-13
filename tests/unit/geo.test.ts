import { describe, expect, it } from 'vitest';
import { parseCoordinates } from '../../src/lib/geo';

describe('parseCoordinates', () => {
  it('returns no coordinates when both are blank (the normal case)', () => {
    expect(parseCoordinates('', '')).toEqual({ coords: null });
    expect(parseCoordinates('  ', null)).toEqual({ coords: null });
    expect(parseCoordinates(undefined, undefined)).toEqual({ coords: null });
  });

  it('parses a valid pair (trimming whitespace)', () => {
    expect(parseCoordinates('42.9180', '-78.8784')).toEqual({
      coords: { lat: 42.918, lng: -78.8784 },
    });
    expect(parseCoordinates('  0 ', ' 0 ')).toEqual({ coords: { lat: 0, lng: 0 } });
  });

  it('rejects a half-filled pair (one without the other)', () => {
    expect(parseCoordinates('42.9', '')).toEqual({ error: 'invalid' });
    expect(parseCoordinates('', '-78.8')).toEqual({ error: 'invalid' });
  });

  it('rejects non-numeric input', () => {
    expect(parseCoordinates('north', 'west')).toEqual({ error: 'invalid' });
    expect(parseCoordinates('42.9', 'abc')).toEqual({ error: 'invalid' });
  });

  it('rejects out-of-range values', () => {
    expect(parseCoordinates('91', '0')).toEqual({ error: 'invalid' }); // lat > 90
    expect(parseCoordinates('-90.1', '0')).toEqual({ error: 'invalid' });
    expect(parseCoordinates('0', '181')).toEqual({ error: 'invalid' }); // lng > 180
    expect(parseCoordinates('0', '-180.5')).toEqual({ error: 'invalid' });
  });

  it('accepts the exact range bounds', () => {
    expect(parseCoordinates('90', '180')).toEqual({ coords: { lat: 90, lng: 180 } });
    expect(parseCoordinates('-90', '-180')).toEqual({ coords: { lat: -90, lng: -180 } });
  });
});
