/**
 * Reading a JPEG's own idea of which way up it is.
 *
 * Phones almost never rotate pixels. They write the sensor's readout and set
 * an EXIF orientation tag saying how to turn it for display, and anything that
 * ignores the tag shows a person lying down. Today that is corrected by hand
 * in the admin panel, one shot at a time, after publishing.
 *
 * Two readings, both from the file's own bytes and neither needing a decoder:
 * the orientation tag, and the true stored pixel dimensions from the frame
 * header. The second is what makes the first safe to act on — see
 * `suggestRotation`.
 */

/** Clockwise degrees to apply at delivery. */
export type Rotation = 0 | 90 | 180 | 270;

/**
 * EXIF orientation to clockwise degrees.
 *
 * Only the four rotations are mapped. Values 2, 4, 5 and 7 involve a mirror,
 * which a rotation cannot express and which a camera essentially never emits;
 * treating them as upright leaves the shot as it is rather than turning it
 * confidently the wrong way.
 */
export function rotationFor(orientation: number | null): Rotation {
  switch (orientation) {
    case 3:
      return 180;
    case 6:
      return 90;
    case 8:
      return 270;
    default:
      return 0;
  }
}

/** Reads the EXIF orientation tag (1..8), or null if there isn't one. */
export function readJpegOrientation(buffer: Buffer): number | null {
  const app1 = findApp1(buffer);
  if (app1 === null) return null;

  // "Exif\0\0", then a TIFF header whose first two bytes name the byte order.
  const tiff = app1 + 6;
  if (tiff + 8 > buffer.length) return null;

  const order = buffer.toString('ascii', tiff, tiff + 2);
  if (order !== 'II' && order !== 'MM') return null;
  const little = order === 'II';

  const u16 = (at: number) =>
    little ? buffer.readUInt16LE(at) : buffer.readUInt16BE(at);
  const u32 = (at: number) =>
    little ? buffer.readUInt32LE(at) : buffer.readUInt32BE(at);

  if (u16(tiff + 2) !== 0x002a) return null;

  const ifd0 = tiff + u32(tiff + 4);
  if (ifd0 + 2 > buffer.length) return null;

  const entries = u16(ifd0);
  for (let i = 0; i < entries; i += 1) {
    // Each directory entry is 12 bytes: tag, type, count, then the value.
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > buffer.length) return null;
    if (u16(entry) !== 0x0112) continue;

    const value = u16(entry + 8);
    return value >= 1 && value <= 8 ? value : null;
  }
  return null;
}

/**
 * The stored pixel size, from the JPEG's frame header.
 *
 * This is the size before any orientation tag is honoured, which is exactly
 * what makes it useful: it is the only way to tell whether something upstream
 * has already turned the image.
 */
export function readJpegSize(
  buffer: Buffer,
): { width: number; height: number } | null {
  return walkSegments(buffer, (marker, at, length) => {
    // Every SOF variant except the four that are not frame headers: DHT
    // (0xC4), JPG (0xC8) and DAC (0xCC) share the 0xC0-0xCF block.
    const isFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (!isFrame || length < 7) return undefined;
    return {
      height: buffer.readUInt16BE(at + 3),
      width: buffer.readUInt16BE(at + 5),
    };
  });
}

function findApp1(buffer: Buffer): number | null {
  const found = walkSegments(buffer, (marker, at, length) => {
    if (marker !== 0xe1 || length < 8) return undefined;
    // A JPEG can carry several APP1 segments; only the Exif one counts.
    return buffer.toString('ascii', at + 2, at + 6) === 'Exif'
      ? at + 2
      : undefined;
  });
  return found ?? null;
}

/**
 * Walks the JPEG marker chain, handing each segment to `visit`.
 *
 * Stops at the start of scan: everything after it is entropy-coded image data
 * with no marker structure to walk, and reading it as markers finds garbage.
 */
function walkSegments<T>(
  buffer: Buffer,
  visit: (marker: number, payloadAt: number, length: number) => T | undefined,
): T | null {
  if (buffer.length < 4 || buffer.readUInt16BE(0) !== 0xffd8) return null;

  let at = 2;
  while (at + 4 <= buffer.length) {
    if (buffer[at] !== 0xff) return null;
    const marker = buffer[at + 1];
    // Standalone markers carry no length word.
    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      at += 2;
      continue;
    }
    if (marker === 0xda) return null;

    const length = buffer.readUInt16BE(at + 2);
    if (length < 2 || at + 2 + length > buffer.length) return null;

    const found = visit(marker, at + 2, length);
    if (found !== undefined) return found;

    at += 2 + length;
  }
  return null;
}

/**
 * The rotation to pre-fill for a freshly uploaded file.
 *
 * The subtlety is that image hosts sometimes honour the orientation tag on
 * ingest and store the pixels already turned. Applying our own rotation on top
 * of that turns the shot twice, and the second turn is invisible in code
 * review because both halves are individually correct.
 *
 * The stored dimensions settle it. If the file says "quarter turn" and the
 * host reports the same width and height the file itself carries, nothing has
 * been applied and the rotation is still needed. If the host reports them
 * swapped, it has already done the work and the answer is zero.
 *
 * With no host dimensions to compare against, the tag is taken at face value.
 */
export function suggestRotation(
  buffer: Buffer,
  stored?: { width: number | null; height: number | null },
): Rotation {
  const rotation = rotationFor(readJpegOrientation(buffer));
  if (rotation !== 90 && rotation !== 270) return rotation;

  const own = readJpegSize(buffer);
  if (!own || !stored?.width || !stored.height) return rotation;

  const alreadyTurned =
    stored.width === own.height && stored.height === own.width;
  return alreadyTurned ? 0 : rotation;
}
