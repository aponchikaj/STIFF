import {
  authorChart,
  DIFFICULTIES,
  hashChart,
  type Chart as ChartData,
} from '@stiff/game-core';
import type { EntityManager } from 'typeorm';
import { GameCharacter } from '../entities/character.entity';
import { Chart } from '../entities/chart.entity';
import { EconomyConfig } from '../entities/economy-config.entity';
import { Item } from '../entities/item.entity';
import { Level, LevelSong } from '../entities/level.entity';
import { Song } from '../entities/song.entity';
import { Stage } from '../entities/stage.entity';

/**
 * Seed content for the rhythm game.
 *
 * **Why there is no third-party music here.** The brief asks for two
 * royalty-free songs. I have not shipped any, and the reason is the schema:
 * `game_songs.licenseNote` is NOT NULL with no default precisely so that a
 * track can never exist without a verified answer to "where did this come from
 * and what may we do with it". Writing a licence claim I cannot verify would
 * be the first lie in a column built to prevent exactly that.
 *
 * So the two seed songs are **metronomic engine fixtures**, and their licence
 * note says so honestly. That turns out to be the more useful thing anyway:
 * every note lands on an exact known millisecond, which is what the Phase 3
 * headless harness needs to assert scores arithmetically. Real music arrives
 * through the admin panel with a real licence note attached.
 *
 * The audio objects themselves do not exist yet — `audioInstKey` is null and
 * the songs are `status: 'draft'`, so nothing here is playable or servable
 * until stems are uploaded. That is deliberate rather than pending: a song row
 * claiming `ready` with no audio behind it would be the same kind of lie.
 *
 * Idempotent: everything upserts on its slug, so running this twice changes
 * nothing.
 */

export interface SeedReport {
  characters: number;
  stages: number;
  songs: number;
  charts: number;
  levels: number;
  items: number;
  configKeys: number;
}

const NOTE_LANES = ['Left', 'Down', 'Up', 'Right'] as const;

/** Placeholder frame maps. Real offsets are tuned in the admin panel. */
function animationSet() {
  const base = { fps: 24, loop: false, offsetX: 0, offsetY: 0 };
  return {
    idle: { prefix: 'idle', fps: 24, loop: true, offsetX: 0, offsetY: 0 },
    ...Object.fromEntries(
      NOTE_LANES.flatMap((lane) => [
        [`sing${lane}`, { ...base, prefix: `sing${lane}` }],
        [`miss${lane}`, { ...base, prefix: `miss${lane}` }],
      ]),
    ),
    win: { ...base, prefix: 'win' },
    lose: { ...base, prefix: 'lose' },
  };
}

export async function seedGame(manager: EntityManager): Promise<SeedReport> {
  // -- Characters ----------------------------------------------------------
  // Original to this project. No FNF character, name or likeness is used or
  // referenced; the naming comes from brand.md, where the asterisk is "the
  // spark of creativity".
  const characters = await upsertAll(manager, GameCharacter, 'slug', [
    {
      slug: 'spark',
      name: 'SPARK',
      isPlayable: true,
      isOpponent: false,
      animations: animationSet(),
    },
    {
      slug: 'static',
      name: 'STATIC',
      isPlayable: false,
      isOpponent: true,
      animations: animationSet(),
    },
  ]);

  // -- Stage ---------------------------------------------------------------
  // A screen-printing room: the brand makes clothes, so the scenery is the
  // press it makes them on.
  const stages = await upsertAll(manager, Stage, 'slug', [
    {
      slug: 'the-press',
      name: 'THE PRESS',
      baseZoom: 1,
      layers: [
        {
          assetKey: 'stages/press/back',
          parallaxX: 0.2,
          parallaxY: 0.1,
          beatScale: 1,
        },
        {
          assetKey: 'stages/press/racks',
          parallaxX: 0.6,
          parallaxY: 0.3,
          beatScale: 1.01,
        },
        {
          assetKey: 'stages/press/carousel',
          parallaxX: 1,
          parallaxY: 1,
          beatScale: 1.03,
        },
      ],
    },
  ]);

  // -- Songs ---------------------------------------------------------------
  const songSpecs = [
    {
      slug: 'test-pattern',
      title: 'TEST PATTERN',
      bpm: 120,
      durationMs: 60_000,
    },
    {
      slug: 'pressure-test',
      title: 'PRESSURE TEST',
      bpm: 174,
      durationMs: 90_000,
    },
  ];

  const songs = await upsertAll(
    manager,
    Song,
    'slug',
    songSpecs.map((s) => ({
      ...s,
      artist: 'STIFF',
      credit: 'Generated metronome, no recorded material.',
      licenseNote:
        'Engine test fixture. No third-party audio: this entry exists so the ' +
        'chart runtime and the replay validator can be exercised against known ' +
        'note times. Audio stems are not attached and the song is not playable.',
      sourceType: 'upload' as const,
      bpmIsManual: true,
      // Null on purpose — no stems exist. `draft` keeps it unservable.
      audioInstKey: null,
      audioVoicesKey: null,
      status: 'draft' as const,
    })),
  );

  // -- Charts --------------------------------------------------------------
  let chartCount = 0;
  for (const song of songs) {
    const spec = songSpecs.find((s) => s.slug === song.slug);
    if (!spec) continue;

    for (const difficulty of DIFFICULTIES) {
      const { notes, npsPeak, npsAvg } = authorChart(
        difficulty,
        spec.bpm,
        spec.durationMs,
      );

      const chartData: ChartData = {
        version: 1,
        songId: song.id,
        difficulty,
        bpmChanges: [{ beat: 0, bpm: spec.bpm }],
        scrollSpeed: 2.4,
        notes,
        events: [],
        meta: { generator: 'manual', npsPeak, npsAvg },
      };
      // The same hash function the replay validator will use. Computing it
      // here rather than storing a placeholder means the seed proves the
      // shared package works end to end.
      const chartHash = await hashChart(chartData);

      const repo = manager.getRepository(Chart);
      const existing = await repo.findOne({
        where: { songId: song.id, difficulty, version: 1 },
      });
      const row = repo.create({
        ...(existing ?? {}),
        songId: song.id,
        difficulty,
        version: 1,
        notes,
        events: [],
        bpmChanges: chartData.bpmChanges,
        scrollSpeed: 2.4,
        chartHash,
        npsPeak,
        npsAvg,
        generatedBy: 'manual' as const,
        // Draft, not approved: approval is a human act and the CHECK
        // constraint would demand an approver id we have no business inventing.
        status: 'draft' as const,
      });
      await repo.save(row);
      chartCount++;
    }
  }

  // -- Level ---------------------------------------------------------------
  const spark = characters.find((c) => c.slug === 'spark');
  const staticChar = characters.find((c) => c.slug === 'static');
  const press = stages[0];

  const levels = await upsertAll(manager, Level, 'slug', [
    {
      slug: 'proof',
      name: 'PROOF',
      position: 0,
      playerCharacterId: spark?.id ?? null,
      opponentCharacterId: staticChar?.id ?? null,
      stageId: press?.id ?? null,
      // Unpublished: nothing is playable until real audio exists.
      isPublished: false,
      unlockRule: null,
    },
  ]);

  const level = levels[0];
  if (level) {
    const repo = manager.getRepository(LevelSong);
    for (const [position, song] of songs.entries()) {
      const existing = await repo.findOne({
        where: { levelId: level.id, songId: song.id },
      });
      if (!existing) {
        await repo.save(
          repo.create({ levelId: level.id, songId: song.id, position }),
        );
      }
    }
  }

  // -- Shop --------------------------------------------------------------
  // Free defaults only. Everything a player starts with, so the locker and
  // loadout have something valid to point at before anyone spends a coin.
  const items = await upsertAll(manager, Item, 'slug', [
    {
      slug: 'notes-default',
      name: 'STANDARD ARROWS',
      type: 'noteSkin' as const,
      rarity: 'common' as const,
      priceCoins: 0,
      description: 'The four lanes as they ship.',
      assetRefs: { atlas: 'notes/default' },
    },
    {
      slug: 'ui-mono',
      name: 'MONO',
      type: 'uiTheme' as const,
      rarity: 'common' as const,
      priceCoins: 0,
      description: 'Black, white, and the lane colours. Nothing else.',
      assetRefs: { theme: 'ui/mono' },
    },
    {
      slug: 'plate-blank',
      name: 'BLANK PLATE',
      type: 'namePlate' as const,
      rarity: 'common' as const,
      priceCoins: 0,
      description: 'A name and nothing around it.',
      assetRefs: { plate: 'plates/blank' },
    },
  ]);

  // -- Economy tunables ----------------------------------------------------
  // Values, not code, so retuning is an admin action with an audit trail.
  const configKeys = await upsertConfig(manager, {
    // Coins awarded at 100% accuracy, scaled by the accuracy curve below.
    'payout.base': { easy: 20, normal: 35, hard: 60, extreme: 100 },
    // Multiplier by rank. Anything below C earns nothing.
    'payout.rankMultiplier': {
      P: 1.5,
      S: 1.25,
      A: 1.1,
      B: 1,
      C: 0.75,
      D: 0,
      F: 0,
    },
    // Nth clear of the same chart on the same day earns this share. Stops a
    // player farming the easiest chart in a loop.
    'payout.diminishing': [1, 1, 1, 0.5, 0.25, 0.1, 0],
    'payout.dailyCapCoins': 2000,
  });

  return {
    characters: characters.length,
    stages: stages.length,
    songs: songs.length,
    charts: chartCount,
    levels: levels.length,
    items: items.length,
    configKeys,
  };
}

/** Upsert on a natural key, returning the persisted rows. */
async function upsertAll<T extends object>(
  manager: EntityManager,
  entity: new () => T,
  key: keyof T & string,
  rows: Partial<T>[],
): Promise<T[]> {
  const repo = manager.getRepository(entity);
  const saved: T[] = [];
  for (const row of rows) {
    const existing = await repo.findOne({
      where: { [key]: row[key] } as never,
    });
    saved.push(
      await repo.save(repo.create({ ...(existing ?? {}), ...row } as T)),
    );
  }
  return saved;
}

async function upsertConfig(
  manager: EntityManager,
  entries: Record<string, unknown>,
): Promise<number> {
  const repo = manager.getRepository(EconomyConfig);
  for (const [key, value] of Object.entries(entries)) {
    const existing = await repo.findOne({ where: { key } });
    // Never overwrite a value someone has tuned in the panel.
    if (existing) continue;
    await repo.save(repo.create({ key, value }));
  }
  return Object.keys(entries).length;
}
