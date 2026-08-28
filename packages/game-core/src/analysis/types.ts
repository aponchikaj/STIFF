/**
 * What Stage A produces from an audio file, and Stage B turns into notes.
 *
 * Stored once per song and reused for all four difficulties — the expensive
 * part is listening to the audio, and that answer does not change with
 * difficulty.
 *
 * Everything here is a plain number. No audio, no buffers, no references to a
 * decoder: this is the whole reason the pipeline splits where it does. The
 * analysis is deterministic and testable, and the language model downstream
 * never sees a sample.
 */

/** Which part of the spectrum an onset came from — decides its lane. */
export type Band = 'low' | 'mid' | 'high';

export interface Onset {
  /** Milliseconds from the start of the song. Integer. */
  ms: number;
  /** Position on the beat grid, fractional. Beat 4.5 is an off-beat eighth. */
  beat: number;
  /** 0..1, relative to the loudest onset in the track. */
  strength: number;
  band: Band;
}

export interface Section {
  index: number;
  startMs: number;
  endMs: number;
  /** Mean RMS across the section, 0..1. */
  rms: number;
  onsetCount: number;
}

export interface AnalysisResult {
  /** Detected tempo. A song with no discernible beat still gets a number. */
  bpm: number;
  /** How much to trust `bpm`, 0..1, from the autocorrelation peak's clarity. */
  bpmConfidence: number;
  durationMs: number;
  sampleRate: number;
  /** Beat times in milliseconds, from the first detected beat. */
  beatGrid: number[];
  sections: Section[];
  onsets: Onset[];
}

/** What the language model is allowed to decide. Notes are not on the list. */
export interface SectionPlan {
  sections: {
    index: number;
    role: 'intro' | 'build' | 'drop' | 'chorus' | 'outro';
    /** 0..1. Scales the onset-strength threshold for the section. */
    intensity: number;
    lead: 'player' | 'opponent';
  }[];
}
