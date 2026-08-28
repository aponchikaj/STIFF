import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import type { Lane } from '../chart/types';
import {
  compressInputLog,
  decodeInputLog,
  decompressInputLog,
  encodeInputLog,
  fromBase64,
  toBase64,
} from './input-codec';
import type { InputEvent } from './input';

function log(...events: [number, Lane, 'press' | 'release'][]): InputEvent[] {
  return events.map(([tMs, lane, type]) => ({ tMs, lane, type }));
}

/** A realistic run: four lanes, presses and releases, three minutes of it. */
function realisticLog(seconds: number): InputEvent[] {
  const events: InputEvent[] = [];
  let t = 0;
  let i = 0;
  while (t < seconds * 1000) {
    const lane = (i % 4) as Lane;
    events.push({ tMs: t, lane, type: 'press' });
    events.push({ tMs: t + 40, lane, type: 'release' });
    t += 90 + (i % 7) * 10;
    i++;
  }
  return events.sort((a, b) => a.tMs - b.tMs);
}

describe('input codec — round trip', () => {
  test('an empty log survives', () => {
    assert.deepEqual(decodeInputLog(encodeInputLog([])), []);
  });

  test('a single press survives', () => {
    const events = log([1234, 2, 'press']);
    assert.deepEqual(decodeInputLog(encodeInputLog(events)), events);
  });

  test('every lane and both types survive', () => {
    const events = log(
      [0, 0, 'press'],
      [10, 1, 'press'],
      [20, 2, 'release'],
      [30, 3, 'release'],
    );
    assert.deepEqual(decodeInputLog(encodeInputLog(events)), events);
  });

  test('simultaneous events survive', () => {
    // A jump is two presses on the same millisecond, and a zero delta is the
    // case a delta encoding most easily gets wrong.
    const events = log([500, 0, 'press'], [500, 2, 'press']);
    assert.deepEqual(decodeInputLog(encodeInputLog(events)), events);
  });

  test('a long gap survives the varint', () => {
    const events = log([0, 0, 'press'], [200_000, 3, 'press']);
    assert.deepEqual(decodeInputLog(encodeInputLog(events)), events);
  });

  test('a full run survives', () => {
    const events = realisticLog(180);
    assert.deepEqual(decodeInputLog(encodeInputLog(events)), events);
  });
});

describe('input codec — size', () => {
  test('a three-minute run is a few kilobytes gzipped', async () => {
    const events = realisticLog(180);
    const raw = JSON.stringify(events).length;
    const packed = encodeInputLog(events).length;
    const gzipped = (await compressInputLog(events)).length;

    // The claim in the brief, checked rather than asserted. If this ever
    // regresses it means the encoding changed shape, not that the run got
    // longer.
    assert.ok(gzipped < 8_000, `gzipped ${gzipped} bytes`);
    assert.ok(packed < raw / 8, `packed ${packed} vs json ${raw}`);
  });

  test('most events cost two bytes', () => {
    // Consecutive inputs are tens of milliseconds apart, so the delta fits in
    // one varint byte and the flags in one more. That is the whole reason for
    // delta encoding.
    const events = realisticLog(30);
    const bytes = encodeInputLog(events).length;
    assert.ok(bytes <= events.length * 3, `${bytes} for ${events.length}`);
  });
});

describe('input codec — gzip and transport', () => {
  test('compress and decompress round-trip', async () => {
    const events = realisticLog(20);
    const packed = await compressInputLog(events);
    assert.deepEqual(await decompressInputLog(packed), events);
  });

  test('base64 round-trips the compressed bytes exactly', async () => {
    const events = realisticLog(5);
    const packed = await compressInputLog(events);
    const restored = fromBase64(toBase64(packed));
    assert.deepEqual([...restored], [...packed]);
    assert.deepEqual(await decompressInputLog(restored), events);
  });
});

describe('input codec — refusing bad input', () => {
  test('an out-of-order log cannot be encoded', () => {
    assert.throws(() => encodeInputLog(log([100, 0, 'press'], [50, 0, 'press'])));
  });

  test('a fractional time cannot be encoded', () => {
    assert.throws(() => encodeInputLog(log([100.5, 0, 'press'])));
  });

  test('a truncated log is refused, not guessed at', () => {
    const bytes = encodeInputLog(log([1000, 1, 'press']));
    assert.throws(() => decodeInputLog(bytes.slice(0, bytes.length - 1)));
  });

  test('a bad gzip payload fails cleanly and leaves nothing dangling', async () => {
    // Regression: the transform's write side also rejects when the input is
    // not gzip. Unawaited, that became an unhandled rejection which surfaced
    // as a failure in whatever test ran next — and in a server process, as a
    // crash. The failure must come from here and nowhere else.
    await assert.rejects(decompressInputLog(Uint8Array.from([1, 2, 3])));

    // The next operation still works, which is the part that was broken.
    const events = realisticLog(2);
    assert.deepEqual(
      await decompressInputLog(await compressInputLog(events)),
      events,
    );
  });

  test('unknown flag bits are refused', () => {
    // A byte the encoder could never produce means the log came from
    // somewhere else, and decoding it as if it were valid is worse than
    // rejecting the submission.
    assert.throws(() => decodeInputLog(Uint8Array.from([0, 0xff])));
  });
});
