import {
  readJpegOrientation,
  readJpegSize,
  rotationFor,
  suggestRotation,
} from './exif';

/**
 * Builds a JPEG just real enough to walk: SOI, an EXIF APP1 with one IFD entry,
 * an SOF0 frame header, then SOS. No entropy data, because nothing here
 * decodes pixels.
 */
function jpeg({
  orientation,
  width = 4000,
  height = 3000,
  littleEndian = true,
}: {
  orientation?: number;
  width?: number;
  height?: number;
  littleEndian?: boolean;
} = {}): Buffer {
  const parts: Buffer[] = [Buffer.from([0xff, 0xd8])];

  if (orientation !== undefined) {
    // TIFF header, one-entry IFD0, then the four-byte "next IFD" pointer.
    const tiff = Buffer.alloc(8 + 2 + 12 + 4);
    const u16 = (at: number, value: number) =>
      littleEndian
        ? tiff.writeUInt16LE(value, at)
        : tiff.writeUInt16BE(value, at);
    const u32 = (at: number, value: number) =>
      littleEndian
        ? tiff.writeUInt32LE(value, at)
        : tiff.writeUInt32BE(value, at);

    tiff.write(littleEndian ? 'II' : 'MM', 0, 'ascii');
    u16(2, 0x002a);
    u32(4, 8); // IFD0 starts right after the header
    u16(8, 1); // one entry
    u16(10, 0x0112); // Orientation
    u16(12, 3); // SHORT
    u32(14, 1); // count
    u16(18, orientation);
    u32(22, 0); // no next IFD

    const payload = Buffer.concat([Buffer.from('Exif\0\0', 'ascii'), tiff]);
    const app1 = Buffer.alloc(4);
    app1.writeUInt16BE(0xffe1, 0);
    app1.writeUInt16BE(payload.length + 2, 2);
    parts.push(app1, payload);
  }

  const sof = Buffer.alloc(4 + 6);
  sof.writeUInt16BE(0xffc0, 0);
  sof.writeUInt16BE(8, 2); // segment length
  sof.writeUInt8(8, 4); // sample precision
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  parts.push(sof);

  parts.push(Buffer.from([0xff, 0xda, 0x00, 0x02]));
  return Buffer.concat(parts);
}

describe('rotationFor', () => {
  it.each([
    [1, 0],
    [3, 180],
    [6, 90],
    [8, 270],
  ])('maps orientation %i to %i degrees', (orientation, degrees) => {
    expect(rotationFor(orientation)).toBe(degrees);
  });

  it.each([2, 4, 5, 7])(
    'leaves the mirrored orientation %i alone',
    (orientation) => {
      // A mirror is not a rotation. Leaving it as-is beats turning it
      // confidently the wrong way.
      expect(rotationFor(orientation)).toBe(0);
    },
  );

  it('treats a missing tag as upright', () => {
    expect(rotationFor(null)).toBe(0);
  });
});

describe('readJpegOrientation', () => {
  it('reads a little-endian tag', () => {
    expect(readJpegOrientation(jpeg({ orientation: 6 }))).toBe(6);
  });

  it('reads a big-endian tag', () => {
    expect(
      readJpegOrientation(jpeg({ orientation: 8, littleEndian: false })),
    ).toBe(8);
  });

  it('returns null when there is no EXIF at all', () => {
    expect(readJpegOrientation(jpeg())).toBeNull();
  });

  it('returns null for something that is not a JPEG', () => {
    expect(
      readJpegOrientation(Buffer.from('this is a png, honestly')),
    ).toBeNull();
  });

  it('does not walk off the end of a truncated file', () => {
    const truncated = jpeg({ orientation: 6 }).subarray(0, 12);
    expect(readJpegOrientation(truncated)).toBeNull();
  });
});

describe('readJpegSize', () => {
  it('reads the stored dimensions from the frame header', () => {
    expect(readJpegSize(jpeg({ width: 4032, height: 3024 }))).toEqual({
      width: 4032,
      height: 3024,
    });
  });

  it('skips the EXIF segment on the way', () => {
    expect(
      readJpegSize(jpeg({ orientation: 6, width: 4032, height: 3024 })),
    ).toEqual({ width: 4032, height: 3024 });
  });
});

describe('suggestRotation', () => {
  const sideways = { orientation: 6, width: 4032, height: 3024 };

  it('suggests the quarter turn when the host stored the pixels as they were', () => {
    // Same dimensions the file itself carries: nothing has been applied yet.
    expect(suggestRotation(jpeg(sideways), { width: 4032, height: 3024 })).toBe(
      90,
    );
  });

  it('suggests nothing when the host already turned it', () => {
    // Swapped dimensions mean the orientation tag has been honoured on
    // ingest. Applying it again would turn the shot twice, and both halves
    // look correct on their own.
    expect(suggestRotation(jpeg(sideways), { width: 3024, height: 4032 })).toBe(
      0,
    );
  });

  it('takes the tag at face value with no dimensions to compare', () => {
    expect(suggestRotation(jpeg(sideways))).toBe(90);
    expect(suggestRotation(jpeg(sideways), { width: null, height: null })).toBe(
      90,
    );
  });

  it('does not second-guess a half turn, where dimensions cannot tell', () => {
    // 180 leaves width and height alone, so the comparison proves nothing.
    expect(
      suggestRotation(jpeg({ orientation: 3, width: 4032, height: 3024 }), {
        width: 4032,
        height: 3024,
      }),
    ).toBe(180);
  });

  it('leaves an upright file upright', () => {
    expect(suggestRotation(jpeg({ orientation: 1 }))).toBe(0);
    expect(suggestRotation(jpeg())).toBe(0);
  });
});
