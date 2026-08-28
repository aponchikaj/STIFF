import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  analyze,
  DIFFICULTIES,
  generateChart,
  hashChart,
  validateChart,
  type AnalysisResult,
  type Difficulty,
} from '@stiff/game-core';
import { Repository } from 'typeorm';
import { AudioDecodeService } from './audio-decode.service';
import { Chart } from './entities/chart.entity';
import { Song } from './entities/song.entity';
import { PROMPT_VERSION, SectionPlanService } from './section-plan.service';

/**
 * The two stages, wired together.
 *
 * Stage A — decode and analyse — is expensive and its answer does not depend on
 * difficulty, so it runs once per song and is stored. Stage B runs per
 * difficulty and is cheap, which is why regenerating one difficulty does not
 * re-listen to the track.
 */
@Injectable()
export class ChartPipelineService {
  constructor(
    @InjectRepository(Song) private readonly songs: Repository<Song>,
    @InjectRepository(Chart) private readonly charts: Repository<Chart>,
    private readonly decoder: AudioDecodeService,
    private readonly planner: SectionPlanService,
  ) {}

  /**
   * Stage A. Stores the result on the song.
   *
   * A manually corrected tempo is passed through as an override rather than
   * being re-detected, so running analysis again never silently discards
   * someone's correction.
   */
  async analyzeSong(songId: string, audio: Buffer): Promise<AnalysisResult> {
    const song = await this.songs.findOne({ where: { id: songId } });
    if (!song) throw new NotFoundException('Song not found');

    const { samples, sampleRate, durationMs } =
      await this.decoder.decode(audio);
    if (samples.length === 0) {
      throw new BadRequestException('Decoded to no audio');
    }

    const result = analyze(samples, sampleRate, {
      ...(song.bpmIsManual ? { bpmOverride: song.bpm } : {}),
    });

    song.analysis = result;
    song.durationMs = durationMs;
    if (!song.bpmIsManual) song.bpm = result.bpm;
    song.status = 'ready';
    await this.songs.save(song);

    return result;
  }

  /**
   * Stage B, for one difficulty or all four.
   *
   * Everything lands as a draft. A generated chart that has not been looked at
   * is not a published chart, however well it validates — the invariants say
   * it is playable, not that it is good.
   */
  async generateCharts(
    songId: string,
    difficulties: Difficulty[] = [...DIFFICULTIES],
  ): Promise<
    { difficulty: Difficulty; chartId: string; problems: string[] }[]
  > {
    const song = await this.songs.findOne({ where: { id: songId } });
    if (!song) throw new NotFoundException('Song not found');
    if (!song.analysis) {
      throw new BadRequestException(
        'Analyse the song before generating charts',
      );
    }

    const analysis = song.analysis;
    const { plan, source, model } = await this.planner.plan(analysis);

    const results: {
      difficulty: Difficulty;
      chartId: string;
      problems: string[];
    }[] = [];

    for (const difficulty of difficulties) {
      const chart = generateChart(song.id, difficulty, analysis, { plan });
      const problems = validateChart(chart, analysis.durationMs);
      const chartHash = await hashChart(chart);

      // A new version rather than an edit: an approved chart is immutable, and
      // regenerating must never rewrite the notes under a run already scored
      // against them.
      const latest = await this.charts.findOne({
        where: { songId: song.id, difficulty },
        order: { version: 'DESC' },
      });

      const row = await this.charts.save(
        this.charts.create({
          songId: song.id,
          difficulty,
          version: (latest?.version ?? 0) + 1,
          notes: chart.notes,
          events: chart.events,
          bpmChanges: chart.bpmChanges,
          scrollSpeed: chart.scrollSpeed,
          chartHash,
          npsPeak: chart.meta.npsPeak,
          npsAvg: chart.meta.npsAvg,
          generatedBy: source === 'ai' ? 'ai' : 'manual',
          generatorModel: model ?? null,
          generatorPromptVersion: source === 'ai' ? PROMPT_VERSION : null,
          status: 'draft',
        }),
      );

      results.push({ difficulty, chartId: row.id, problems });
    }

    return results;
  }
}
