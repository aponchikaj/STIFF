import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { analyze } from '../analysis/analyze';
import type { AnalysisResult, SectionPlan } from '../analysis/types';
import { generateChart, SHAPES, validateChart } from './generate';
import { DIFFICULTIES } from './types';

const SR = 22_050;

function clickTrack(bpm: number, seconds: number, frequency = 1000): Float32Array {
  const samples = new Float32Array(Math.floor(seconds * SR));
  const beatSamples = Math.round((60 / bpm) * SR);
  const clickLength = Math.round(0.03 * SR);
  for (let start = 0; start + clickLength < samples.length; start += beatSamples) {
    for (let i = 0; i < clickLength; i++) {
      samples[start + i] =
        0.8 * Math.exp(-8 * (i / clickLength)) *
        Math.sin((2 * Math.PI * frequency * i) / SR);
    }
  }
  return samples;
}

function fixture(): AnalysisResult {
  return analyze(clickTrack(140, 40), SR);
}

describe('generateChart', () => {
  const analysis = fixture();

  for (const difficulty of DIFFICULTIES) {
    test(`${difficulty} produces a chart that validates`, () => {
      const chart = generateChart('song-1', difficulty, analysis);
      assert.deepEqual(validateChart(chart, analysis.durationMs), []);
    });

    test(`${difficulty} respects its NPS cap`, () => {
      const chart = generateChart('song-1', difficulty, analysis);
      assert.ok(chart.meta.npsPeak <= SHAPES[difficulty].maxNps);
    });

    test(`${difficulty} respects its gap floor`, () => {
      const chart = generateChart('song-1', difficulty, analysis);
      const player = chart.notes.filter((n) => n.side === 'player');
      const times = [...new Set(player.map((n) => n.t))].sort((a, b) => a - b);
      for (let i = 1; i < times.length; i++) {
        assert.ok(times[i]! - times[i - 1]! >= SHAPES[difficulty].minGapMs);
      }
    });
  }

  test('a fractional cap is enforced as a whole-note count', () => {
    // `normal` caps at 5.5 NPS and the window holds whole notes, so five is
    // the limit and six is a violation. A real 128 BPM track produced exactly
    // six before the cap was floored; a click track never hit the boundary.
    const dense = analyze(clickTrack(240, 30), SR);
    for (const difficulty of DIFFICULTIES) {
      const chart = generateChart('s', difficulty, dense, {
        plan: {
          sections: dense.sections.map((section) => ({
            index: section.index,
            role: 'drop' as const,
            intensity: 1,
            lead: 'player' as const,
          })),
        },
      });
      assert.ok(
        chart.meta.npsPeak <= Math.floor(SHAPES[difficulty].maxNps),
        `${difficulty} peaked at ${chart.meta.npsPeak} against ${SHAPES[difficulty].maxNps}`,
      );
      assert.deepEqual(validateChart(chart, dense.durationMs), []);
    }
  });

  test('harder difficulties are denser', () => {
    const counts = DIFFICULTIES.map(
      (d) => generateChart('s', d, analysis).notes.length,
    );
    for (let i = 1; i < counts.length; i++) {
      assert.ok(
        counts[i]! >= counts[i - 1]!,
        `${DIFFICULTIES[i]} (${counts[i]}) is sparser than ${DIFFICULTIES[i - 1]} (${counts[i - 1]})`,
      );
    }
  });

  test('easy contains no jacks', () => {
    const chart = generateChart('s', 'easy', analysis);
    const lanes = chart.notes.filter((n) => n.side === 'player').map((n) => n.lane);
    for (let i = 1; i < lanes.length; i++) {
      assert.notEqual(lanes[i], lanes[i - 1]);
    }
  });

  test('is deterministic', () => {
    assert.deepEqual(
      generateChart('s', 'hard', analysis).notes,
      generateChart('s', 'hard', analysis).notes,
    );
  });

  test('every note lands on an onset', () => {
    // The generator selects from what the analysis heard; it never invents a
    // time of its own.
    const chart = generateChart('s', 'extreme', analysis);
    const onsetTimes = new Set(analysis.onsets.map((o) => o.ms));
    for (const note of chart.notes) assert.ok(onsetTimes.has(note.t));
  });

  test('a silent track produces an empty chart, not a crash', () => {
    const silence = analyze(new Float32Array(SR * 5), SR);
    const chart = generateChart('s', 'normal', silence);
    assert.equal(chart.notes.length, 0);
    // And it is honestly reported as unusable rather than approved empty.
    assert.ok(validateChart(chart, silence.durationMs).includes('chart is empty'));
  });
});

describe('generateChart — the section plan', () => {
  const analysis = fixture();

  function plan(intensity: number, lead: 'player' | 'opponent'): SectionPlan {
    return {
      sections: analysis.sections.map((section) => ({
        index: section.index,
        role: 'drop' as const,
        intensity,
        lead,
      })),
    };
  }

  test('a high-intensity plan admits more notes than a low one', () => {
    const quiet = generateChart('s', 'hard', analysis, {
      plan: plan(0.1, 'player'),
    });
    const loud = generateChart('s', 'hard', analysis, {
      plan: plan(1, 'player'),
    });
    assert.ok(
      loud.notes.length > quiet.notes.length,
      `${loud.notes.length} vs ${quiet.notes.length}`,
    );
  });

  test('an opponent-led plan puts the notes on the other side', () => {
    const chart = generateChart('s', 'hard', analysis, {
      plan: plan(1, 'opponent'),
    });
    assert.ok(chart.notes.every((n) => n.side === 'opponent'));
  });

  test('a plan cannot push a chart past its difficulty cap', () => {
    // The model is not trusted to keep the chart playable — the repair pass
    // enforces the cap whatever the plan asked for.
    const chart = generateChart('s', 'easy', analysis, {
      plan: plan(1, 'player'),
    });
    assert.ok(chart.meta.npsPeak <= SHAPES.easy.maxNps);
    assert.deepEqual(validateChart(chart, analysis.durationMs), []);
  });

  test('a plan referring to sections that do not exist is ignored', () => {
    const bogus: SectionPlan = {
      sections: [{ index: 99, role: 'drop', intensity: 1, lead: 'opponent' }],
    };
    const chart = generateChart('s', 'normal', analysis, { plan: bogus });
    assert.deepEqual(validateChart(chart, analysis.durationMs), []);
  });

  test('marks provenance so a bad batch is traceable', () => {
    assert.equal(generateChart('s', 'hard', analysis).meta.generator, 'manual');
    assert.equal(
      generateChart('s', 'hard', analysis, { plan: plan(0.5, 'player') }).meta
        .generator,
      'ai',
    );
  });
});

describe('validateChart', () => {
  const analysis = fixture();

  test('catches unsorted notes', () => {
    const chart = generateChart('s', 'normal', analysis);
    chart.notes = [...chart.notes].reverse();
    assert.ok(validateChart(chart, analysis.durationMs).some((p) => p.includes('sorted')));
  });

  test('catches a duplicate', () => {
    const chart = generateChart('s', 'normal', analysis);
    const first = chart.notes[0]!;
    chart.notes = [first, { ...first }, ...chart.notes.slice(1)];
    assert.ok(validateChart(chart, analysis.durationMs).some((p) => p.includes('duplicate')));
  });

  test('catches a note past the end of the song', () => {
    const chart = generateChart('s', 'normal', analysis);
    chart.notes = [...chart.notes, { t: analysis.durationMs + 5_000, lane: 0, side: 'player' }];
    assert.ok(validateChart(chart, analysis.durationMs).some((p) => p.includes('outside')));
  });

  test('catches a fractional time', () => {
    const chart = generateChart('s', 'normal', analysis);
    chart.notes = [{ t: 100.5, lane: 0, side: 'player' }];
    assert.ok(validateChart(chart, analysis.durationMs).some((p) => p.includes('whole milliseconds')));
  });
});
