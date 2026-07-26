// The evidence-photo pipeline, pinned (§6 privacy, §5 low-bandwidth).
//
// WHY THIS EXISTS. `sharp` decodes ATTACKER-SUPPLIED bytes in
// src/pages/api/confirmations.ts — a contributor's uploaded photo is the
// intended input. That makes sharp both a security-sensitive dependency (it must
// be kept current: libvips CVEs land there) and a privacy-critical one: the
// promise on the upload form is "Location and device data are removed from your
// photo before it is stored", and the ONLY thing that makes that true is sharp
// dropping metadata on re-encode. A major sharp bump could quietly change that
// default and nothing else in the suite would notice.
//
// ⚠️ MIRRORS src/pages/api/confirmations.ts (the `if (hasPhoto)` block).
// The pipeline is duplicated here rather than imported because it lives inline
// in the route handler. CHANGE THEM TOGETHER — same rule as the consensus
// formula in seed.ts / 0001_init.sql.
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';

// A source photo carrying what a real phone carries: the camera make/model and
// real GPS coordinates.
//
// GPS tags go under IFD3 — that is the GPS IFD. sharp accepts an unknown `GPS`
// key silently and writes NOTHING for it, which would make the whole
// location-stripping assertion below vacuous. `withGps` guards against exactly
// that by letting the caller produce an otherwise-identical photo without
// location, so the test can prove the GPS block is really there to begin with.
async function phonePhoto(
  width = 3000,
  height = 2000,
  { withGps = true }: { withGps?: boolean } = {},
): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#4a7c59' } })
    .jpeg()
    .withExif({
      IFD0: { Make: 'TestPhone', Model: 'TestCam' },
      ...(withGps
        ? {
            IFD3: {
              GPSLatitudeRef: 'N',
              GPSLatitude: '42/1 53/1 0/1',
              GPSLongitudeRef: 'W',
              GPSLongitude: '78/1 52/1 0/1',
            },
          }
        : {}),
    })
    .toBuffer();
}

// Orientation needs its own fixture: an Orientation tag written through
// withExif() does NOT read back as `metadata().orientation` (verified — it
// reads as 1), so a rotation test built on phonePhoto() would silently assert
// nothing. withMetadata({orientation}) is the setter rotate() actually honors.
async function sidewaysPhoto(width = 3000, height = 2000): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#4a7c59' } })
    .jpeg()
    .withMetadata({ orientation: 6 }) // 6 = rotate 90° CW on display
    .toBuffer();
}

// Verbatim from confirmations.ts — two outputs from one decode pass.
async function evidencePipeline(input: Buffer): Promise<{ cleaned: Buffer; thumb: Buffer }> {
  const base = sharp(input).rotate();
  const [cleaned, thumb] = await Promise.all([
    base
      .clone()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer(),
    base
      .clone()
      .resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer(),
  ]);
  return { cleaned, thumb };
}

describe('evidence photo pipeline', () => {
  it('strips EXIF and GPS from both outputs — the §6 promise on the upload form', async () => {
    const source = await phonePhoto();
    const withoutGps = await phonePhoto(3000, 2000, { withGps: false });

    // Preconditions. Without these the assertions below can pass vacuously:
    // the fixture must carry EXIF at all, and it must genuinely carry a GPS
    // block (proven by it being strictly larger than the same photo without one).
    const srcMeta = await sharp(source).metadata();
    const noGpsMeta = await sharp(withoutGps).metadata();
    expect(srcMeta.exif).toBeTruthy();
    expect(srcMeta.exif!.length).toBeGreaterThan(noGpsMeta.exif!.length);

    const { cleaned, thumb } = await evidencePipeline(source);

    for (const buf of [cleaned, thumb]) {
      const meta = await sharp(buf).metadata();
      // No EXIF at all is the strongest form of "location removed" — there is
      // no GPS IFD left to read because there is no EXIF segment left.
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      const raw = buf.toString('latin1');
      expect(raw).not.toContain('Exif\0\0'); // no APP1 marker
      expect(raw).not.toContain('TestPhone'); // no camera make
    }
  });

  it('bakes orientation in rather than carrying the tag forward', async () => {
    const source = await sidewaysPhoto(3000, 2000);
    // Precondition: the fixture must really be marked sideways, or this proves nothing.
    expect((await sharp(source).metadata()).orientation).toBe(6);

    const { cleaned } = await evidencePipeline(source);
    const meta = await sharp(cleaned).metadata();
    // rotate() applies the tag, so the stored pixels are upright and no viewer
    // has to honor a tag we just stripped.
    expect(meta.orientation === undefined || meta.orientation === 1).toBe(true);
    expect(meta.height).toBeGreaterThan(meta.width!);
  });

  it('caps the full photo at 1600px and the thumbnail at 320px (§5 bandwidth)', async () => {
    const { cleaned, thumb } = await evidencePipeline(await phonePhoto(3000, 2000));
    const full = await sharp(cleaned).metadata();
    const small = await sharp(thumb).metadata();

    expect(full.format).toBe('jpeg');
    expect(small.format).toBe('jpeg');
    expect(Math.max(full.width!, full.height!)).toBeLessThanOrEqual(1600);
    expect(Math.max(small.width!, small.height!)).toBeLessThanOrEqual(320);
    // The thumbnail is the one that has to stay small on a metered connection.
    expect(thumb.length).toBeLessThan(cleaned.length);
  });

  it('never enlarges a photo that is already small', async () => {
    const { cleaned } = await evidencePipeline(
      await sharp({ create: { width: 120, height: 90, channels: 3, background: '#333' } })
        .jpeg()
        .toBuffer(),
    );
    const meta = await sharp(cleaned).metadata();
    expect(meta.width).toBe(120);
    expect(meta.height).toBe(90);
  });

  it('rejects bytes that are not an image, rather than passing them through', async () => {
    // The endpoint wraps this in try/catch and redirects with ?status=error;
    // what matters here is that sharp refuses instead of emitting something.
    await expect(evidencePipeline(Buffer.from('this is not an image'))).rejects.toThrow();
  });
});
