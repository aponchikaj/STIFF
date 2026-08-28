import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AnalysisResult, SectionPlan } from '@stiff/game-core';

/**
 * The only place a language model touches a chart.
 *
 * It never sees audio, and it never sees a note. It gets a table of maybe
 * twenty rows — how long each section is, how loud, how busy — and answers a
 * question models are actually good at: which part is the intro, which is the
 * drop, who should lead. The deterministic charter does everything else.
 *
 * That split is not caution for its own sake. Onset detection is a solved
 * signal-processing problem with an exactly correct answer; asking a model to
 * place notes produces output that looks plausible and is off the beat. And a
 * twenty-row prompt is cheap, fast, and small enough to validate strictly.
 *
 * Every failure path falls back to a deterministic plan. A model being slow,
 * rate-limited, or creative with its JSON must never stop a chart being
 * generated.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Bumped whenever the prompt changes, and stored on the chart it produced. */
export const PROMPT_VERSION = 'v1';

const SYSTEM_PROMPT = `You plan sections for a four-lane rhythm game chart.

You are given one row per section of a song: its index, its length, its mean
loudness (0-1), and how many note onsets the analysis found in it.

Return JSON only, exactly this shape:
{"sections":[{"index":<int>,"role":"intro"|"build"|"drop"|"chorus"|"outro","intensity":<0..1>,"lead":"player"|"opponent"}]}

Rules:
- One entry per section given, same indices, no extras.
- intensity tracks how busy that section should feel. Loud, dense sections get
  high values; quiet ones get low.
- lead alternates to make call-and-response. The opponent usually leads an
  intro; the player usually leads a drop.
- No prose, no explanation, no markdown fence.`;

@Injectable()
export class SectionPlanService {
  private readonly logger = new Logger(SectionPlanService.name);

  constructor(private readonly config: ConfigService) {}

  get model(): string {
    return this.config.get<string>('GROQ_MODEL') ?? 'openai/gpt-oss-120b';
  }

  get configured(): boolean {
    return Boolean(this.config.get<string>('GROQ_API_KEY'));
  }

  /**
   * Asks for a plan, and returns a deterministic one if anything goes wrong.
   *
   * The caller cannot tell the difference except through `source`, which is
   * recorded on the chart so a batch of bad charts can be traced to the model
   * that planned them.
   */
  async plan(
    analysis: AnalysisResult,
  ): Promise<{ plan: SectionPlan; source: 'ai' | 'fallback'; model?: string }> {
    if (!this.configured) {
      return { plan: fallbackPlan(analysis), source: 'fallback' };
    }

    try {
      const raw = await this.ask(analysis);
      const plan = validatePlan(raw, analysis);
      return { plan, source: 'ai', model: this.model };
    } catch (error) {
      this.logger.warn(
        `section plan fell back to deterministic: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return { plan: fallbackPlan(analysis), source: 'fallback' };
    }
  }

  private async ask(analysis: AnalysisResult): Promise<unknown> {
    const rows = analysis.sections
      .map(
        (s) =>
          `${s.index}: ${(s.startMs / 1000).toFixed(1)}-${(s.endMs / 1000).toFixed(1)}s rms ${s.rms.toFixed(3)} onsets ${s.onsetCount}`,
      )
      .join('\n');

    // Bounded, because an unreachable model must not hold a request open.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch(GROQ_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.config.get<string>('GROQ_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          // Deterministic: the same analysis should plan the same way twice.
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `${analysis.sections.length} sections, ${analysis.bpm.toFixed(1)} BPM.\n${rows}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`groq responded ${response.status}`);
      }

      const body = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = body.choices?.[0]?.message?.content;
      if (!content) throw new Error('groq returned no content');

      return JSON.parse(content);
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Strict validation of whatever came back.
 *
 * A model is an untrusted input. Anything malformed, out of range, or
 * referring to a section that does not exist is a fallback rather than
 * something to coerce into shape — the charter's invariants would catch a bad
 * plan later, but failing here says *why*.
 */
export function validatePlan(
  raw: unknown,
  analysis: AnalysisResult,
): SectionPlan {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('plan is not an object');
  }
  const sections = (raw as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) throw new Error('plan has no sections array');
  if (sections.length !== analysis.sections.length) {
    throw new Error(
      `plan has ${sections.length} sections, analysis has ${analysis.sections.length}`,
    );
  }

  const valid = new Set(analysis.sections.map((s) => s.index));
  const roles = ['intro', 'build', 'drop', 'chorus', 'outro'];
  const out: SectionPlan['sections'] = [];

  for (const entry of sections as Record<string, unknown>[]) {
    const index = entry.index;
    const role = entry.role;
    const intensity = entry.intensity;
    const lead = entry.lead;

    if (typeof index !== 'number' || !valid.has(index)) {
      throw new Error(`plan refers to unknown section ${String(index)}`);
    }
    if (typeof role !== 'string' || !roles.includes(role)) {
      throw new Error(`unknown role ${String(role)}`);
    }
    if (typeof intensity !== 'number' || intensity < 0 || intensity > 1) {
      throw new Error(`intensity ${String(intensity)} is out of range`);
    }
    if (lead !== 'player' && lead !== 'opponent') {
      throw new Error(`unknown lead ${String(lead)}`);
    }

    out.push({
      index,
      role: role as SectionPlan['sections'][number]['role'],
      intensity,
      lead,
    });
  }

  return { sections: out };
}

/**
 * The plan used when there is no model, or it failed.
 *
 * Derived from the analysis alone: loudness relative to the loudest section
 * decides intensity, and the sides alternate so there is still call and
 * response. Flatter than a good model's plan, and a perfectly playable chart.
 */
export function fallbackPlan(analysis: AnalysisResult): SectionPlan {
  const loudest = Math.max(...analysis.sections.map((s) => s.rms), 0.0001);

  return {
    sections: analysis.sections.map((section, i) => {
      const intensity = Math.max(0, Math.min(1, section.rms / loudest));
      return {
        index: section.index,
        role:
          i === 0
            ? ('intro' as const)
            : i === analysis.sections.length - 1
              ? ('outro' as const)
              : intensity > 0.75
                ? ('drop' as const)
                : ('build' as const),
        intensity,
        lead: i % 2 === 0 ? ('opponent' as const) : ('player' as const),
      };
    }),
  };
}
