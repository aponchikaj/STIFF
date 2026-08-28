import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chart } from './entities/chart.entity';
import { Song } from './entities/song.entity';

/**
 * What is playable, and the notes to play it with.
 *
 * "Playable" means an approved chart, and nothing else is ever served — a
 * draft chart has not been reviewed and may violate the difficulty invariants
 * the generator is supposed to enforce.
 */
@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Song) private readonly songs: Repository<Song>,
    @InjectRepository(Chart) private readonly charts: Repository<Chart>,
  ) {}

  /**
   * The song list, with one entry per approved difficulty.
   *
   * Notes are deliberately not included. A chart is tens of kilobytes of JSON
   * and the select screen needs none of it; sending them all would make the
   * menu slower than the game.
   */
  async listSongs(): Promise<unknown[]> {
    const charts = await this.charts.find({
      where: { status: 'approved' },
      relations: { song: true },
      order: { difficulty: 'ASC' },
    });

    const bySong = new Map<string, Record<string, unknown>>();
    for (const chart of charts) {
      const song = chart.song;
      const entry = bySong.get(song.id) ?? {
        id: song.id,
        slug: song.slug,
        title: song.title,
        artist: song.artist,
        credit: song.credit,
        licenseNote: song.licenseNote,
        bpm: song.bpm,
        durationMs: song.durationMs,
        // Null means there is no audio object yet: the seed fixtures are
        // synthesised in the client rather than streamed.
        audioInstKey: song.audioInstKey,
        audioVoicesKey: song.audioVoicesKey,
        charts: [] as unknown[],
      };
      (entry.charts as unknown[]).push({
        id: chart.id,
        difficulty: chart.difficulty,
        chartHash: chart.chartHash,
        npsPeak: chart.npsPeak,
        npsAvg: chart.npsAvg,
        noteCount: chart.notes.length,
      });
      bySong.set(song.id, entry);
    }

    return [...bySong.values()];
  }

  /** The full chart, notes included. Only ever an approved one. */
  async chart(id: string) {
    const chart = await this.charts.findOne({
      where: { id, status: 'approved' },
      relations: { song: true },
    });
    if (!chart) throw new NotFoundException('Chart not found or not published');

    return {
      id: chart.id,
      songId: chart.songId,
      difficulty: chart.difficulty,
      chartHash: chart.chartHash,
      scrollSpeed: chart.scrollSpeed,
      bpmChanges: chart.bpmChanges,
      notes: chart.notes,
      events: chart.events,
      song: {
        id: chart.song.id,
        slug: chart.song.slug,
        title: chart.song.title,
        artist: chart.song.artist,
        bpm: chart.song.bpm,
        durationMs: chart.song.durationMs,
        audioInstKey: chart.song.audioInstKey,
        audioVoicesKey: chart.song.audioVoicesKey,
      },
    };
  }
}
