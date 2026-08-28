import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import {
  median,
  medianOffsetMs,
  METRONOME_INTERVAL_MS,
  offsetToNearestBeat,
  rejectOutliers,
  spreadMs,
} from './calibration';

describe('offsetToNearestBeat', () => {
  test('a tap just after a click is a small positive', () => {
    assert.equal(offsetToNearestBeat(12), 12);
    assert.equal(offsetToNearestBeat(METRONOME_INTERVAL_MS + 12), 12);
  });

  test('a tap just before a click is a small negative, not a huge positive', () => {
    // The whole reason for the wrap: most players anticipate the beat, and
    // without it they would calibrate to nearly a whole beat of error.
    assert.equal(offsetToNearestBeat(METRONOME_INTERVAL_MS - 20), -20);
    assert.equal(offsetToNearestBeat(2 * METRONOME_INTERVAL_MS - 20), -20);
  });

  test('exactly on the beat is zero', () => {
    assert.equal(offsetToNearestBeat(0), 0);
    assert.equal(offsetToNearestBeat(METRONOME_INTERVAL_MS * 5), 0);
  });

  test('a negative elapsed time still wraps into range', () => {
    const value = offsetToNearestBeat(-20);
    assert.equal(value, -20);
  });

  test('never reports more than half an interval of error', () => {
    for (let t = 0; t < METRONOME_INTERVAL_MS * 3; t += 7) {
      const value = offsetToNearestBeat(t);
      assert.ok(Math.abs(value) <= METRONOME_INTERVAL_MS / 2);
    }
  });
});

describe('rejectOutliers', () => {
  test('drops a wild tap that a mean would not survive', () => {
    // Eleven taps around 30ms and one at 400 — a sneeze, not a measurement.
    const samples = [28, 31, 29, 33, 30, 27, 32, 30, 29, 31, 30, 400];
    const kept = rejectOutliers(samples);
    assert.ok(!kept.includes(400));
    assert.equal(kept.length, samples.length - 1);
  });

  test('a mean would have been dragged badly by that tap', () => {
    const samples = [28, 31, 29, 33, 30, 27, 32, 30, 29, 31, 30, 400];
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    assert.ok(mean > 60, 'the point of the test is that the mean is wrong');
    assert.equal(medianOffsetMs(samples), 30);
  });

  test('keeps everything when the player is perfectly consistent', () => {
    const samples = [20, 20, 20, 20, 20, 20];
    assert.deepEqual(rejectOutliers(samples), samples);
    assert.equal(medianOffsetMs(samples), 20);
  });

  test('too few samples to judge are all kept', () => {
    assert.deepEqual(rejectOutliers([5, 500]), [5, 500]);
  });
});

describe('medianOffsetMs', () => {
  test('no taps means no answer, not zero', () => {
    // Zero is a legitimate calibration result, so "we do not know" has to be
    // representable as something else.
    assert.equal(medianOffsetMs([]), null);
  });

  test('rounds to a whole millisecond', () => {
    assert.equal(medianOffsetMs([10, 11]), 11);
    assert.equal(Number.isInteger(medianOffsetMs([3, 4, 5, 9]) ?? 0), true);
  });

  test('falls back to the raw samples when almost everything is an outlier', () => {
    // A player tapping at random should still get a number rather than one
    // derived from the two taps that happened to agree.
    const chaos = [-200, -150, 0, 140, 220, 310];
    const result = medianOffsetMs(chaos);
    assert.ok(result !== null);
    assert.equal(result, Math.round(median(chaos)));
  });

  test('handles negative offsets from a player who taps early', () => {
    assert.equal(medianOffsetMs([-40, -38, -42, -39, -41, -40]), -40);
  });
});

describe('spreadMs', () => {
  test('a steady tapper has a small spread', () => {
    assert.ok(spreadMs([30, 31, 29, 30, 31, 29]) <= 1);
  });

  test('a ragged tapper has a large one', () => {
    assert.ok(spreadMs([0, 60, -55, 70, -40, 50]) > 20);
  });

  test('one sample has no spread to report', () => {
    assert.equal(spreadMs([30]), 0);
  });
});
