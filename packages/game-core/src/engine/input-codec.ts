import type { Lane } from '../chart/types';
import type { InputEvent } from './input';

/**
 * The wire format for a replay.
 *
 * A three-minute Extreme run is a few thousand events. Sent as JSON that is
 * ~150KB per submission; delta-encoded and gzipped it is a couple of
 * kilobytes, which matters because every run posts one and the server stores
 * it for review.
 *
 * Layout, per event:
 *
 *   varint  milliseconds since the previous event (never negative — the log
 *           is sorted, which `validateInputLog` enforces)
 *   byte    (lane << 1) | (type === 'release' ? 1 : 0)
 *
 * Deltas rather than absolute times because consecutive inputs are usually
 * tens of milliseconds apart, so almost every one fits in a single varint
 * byte. Absolute timestamps in a three-minute song need three.
 *
 * The format is deliberately dumb: no compression tricks of its own, no
 * dictionary, nothing that has to agree between two versions of the client.
 * Gzip does the actual compressing, and gzip is in every browser and in Node.
 */

export function encodeInputLog(events: readonly InputEvent[]): Uint8Array {
  const bytes: number[] = [];
  let previous = 0;

  for (const event of events) {
    const delta = event.tMs - previous;
    if (delta < 0) {
      throw new Error('encodeInputLog: events must be sorted by time');
    }
    if (!Number.isInteger(delta)) {
      throw new Error('encodeInputLog: times must be whole milliseconds');
    }
    writeVarint(bytes, delta);
    bytes.push((event.lane << 1) | (event.type === 'release' ? 1 : 0));
    previous = event.tMs;
  }

  return Uint8Array.from(bytes);
}

export function decodeInputLog(bytes: Uint8Array): InputEvent[] {
  const events: InputEvent[] = [];
  let offset = 0;
  let time = 0;

  while (offset < bytes.length) {
    const [delta, next] = readVarint(bytes, offset);
    offset = next;

    const flags = bytes[offset];
    if (flags === undefined) {
      throw new Error('decodeInputLog: truncated log');
    }
    offset += 1;

    time += delta;
    const lane = (flags >> 1) & 0b11;
    // Two bits of lane and one of type fill three; anything above is a log
    // that was not produced by `encodeInputLog`, and guessing is worse than
    // refusing.
    if (flags > 0b111) throw new Error('decodeInputLog: unknown event flags');

    events.push({
      tMs: time,
      lane: lane as Lane,
      type: (flags & 1) === 1 ? 'release' : 'press',
    });
  }

  return events;
}

/**
 * Gzip via `CompressionStream`, which exists in browsers and in Node 18+.
 *
 * One implementation for both sides rather than `zlib` on the server and a
 * stream in the client — the compressed bytes have to round-trip exactly, and
 * two libraries is two chances for them not to.
 */
export async function compressInputLog(
  events: readonly InputEvent[],
): Promise<Uint8Array> {
  return gzip(encodeInputLog(events));
}

export async function decompressInputLog(
  bytes: Uint8Array,
): Promise<InputEvent[]> {
  return decodeInputLog(await gunzip(bytes));
}

export async function gzip(input: Uint8Array): Promise<Uint8Array> {
  return pipeThrough(input, new CompressionStream('gzip'));
}

export async function gunzip(input: Uint8Array): Promise<Uint8Array> {
  return pipeThrough(input, new DecompressionStream('gzip'));
}

/**
 * Reader/writer rather than `Blob(...).stream().pipeThrough(...)`, which would
 * drag in two more browser types for no benefit. See `web-globals.d.ts` for
 * why this package declares its web globals by hand instead of loading the
 * DOM lib.
 */
async function pipeThrough(
  input: Uint8Array,
  transform: WebTransformStream,
): Promise<Uint8Array> {
  const writer = transform.writable.getWriter();
  // The catch is load-bearing. When the input is not valid gzip the transform
  // errors, and both sides of it reject: the read below throws the useful
  // error, while this one would go unhandled and take the Node process down
  // under `--unhandled-rejections=throw`. Swallowing it here loses nothing —
  // the failure still surfaces from the reader.
  const written = writer
    .write(input)
    .then(() => writer.close())
    .catch(() => undefined);

  const reader = transform.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  await written;

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Base64 for JSON transport, without pulling in a dependency for it. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function writeVarint(out: number[], value: number): void {
  let remaining = value;
  while (remaining >= 0x80) {
    out.push((remaining & 0x7f) | 0x80);
    remaining >>>= 7;
  }
  out.push(remaining);
}

function readVarint(bytes: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let cursor = offset;

  for (;;) {
    const byte = bytes[cursor];
    if (byte === undefined) throw new Error('decodeInputLog: truncated varint');
    cursor += 1;
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
    // Five groups of seven bits covers a 32-bit delta, which is 49 days.
    // Anything longer is malformed rather than a very patient player.
    if (shift > 28) throw new Error('decodeInputLog: varint too long');
  }

  return [result >>> 0, cursor];
}
