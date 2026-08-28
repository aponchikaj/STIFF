import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { UpdateGameSettingsDto } from './dto/settings.dto';
import {
  GameUserSettings,
  type DeviceClass,
} from './entities/user-settings.entity';

/** Sent to a player who has never calibrated on this kind of device. */
export const DEFAULT_SETTINGS = {
  audioOffsetMs: 0,
  visualOffsetMs: 0,
  scrollSpeed: 2.4,
  reducedMotion: false,
  laneColorMode: 'default' as const,
  keybinds: {
    '0': ['KeyD', 'ArrowLeft'],
    '1': ['KeyF', 'ArrowDown'],
    '2': ['KeyJ', 'ArrowUp'],
    '3': ['KeyK', 'ArrowRight'],
  },
};

@Injectable()
export class GameSettingsService {
  constructor(
    @InjectRepository(GameUserSettings)
    private readonly repo: Repository<GameUserSettings>,
  ) {}

  /**
   * Never creates a row on read.
   *
   * A missing row means "has not calibrated on this device class", which is
   * what triggers the first-run flow. Writing defaults on first read would
   * make `calibratedAt` null on a row that exists, which is the same thing
   * expressed less clearly — and would fill the table with rows for people who
   * opened the settings page once.
   */
  async forUser(
    userId: string,
    deviceClass: DeviceClass,
  ): Promise<GameUserSettings | null> {
    return this.repo.findOne({ where: { userId, deviceClass } });
  }

  async resolved(userId: string, deviceClass: DeviceClass) {
    const stored = await this.forUser(userId, deviceClass);
    return {
      deviceClass,
      audioOffsetMs: stored?.audioOffsetMs ?? DEFAULT_SETTINGS.audioOffsetMs,
      visualOffsetMs: stored?.visualOffsetMs ?? DEFAULT_SETTINGS.visualOffsetMs,
      scrollSpeed: stored?.scrollSpeed ?? DEFAULT_SETTINGS.scrollSpeed,
      reducedMotion: stored?.reducedMotion ?? DEFAULT_SETTINGS.reducedMotion,
      laneColorMode: stored?.laneColorMode ?? DEFAULT_SETTINGS.laneColorMode,
      keybinds:
        stored && Object.keys(stored.keybinds).length > 0
          ? stored.keybinds
          : DEFAULT_SETTINGS.keybinds,
      calibratedAt: stored?.calibratedAt ?? null,
      needsCalibration: !stored?.calibratedAt,
    };
  }

  async update(userId: string, dto: UpdateGameSettingsDto) {
    const { deviceClass, calibrated, ...changes } = dto;
    const existing = await this.forUser(userId, deviceClass);

    const row = this.repo.create({
      ...(existing ?? {
        userId,
        deviceClass,
        keybinds: DEFAULT_SETTINGS.keybinds,
      }),
      ...pruneUndefined(changes),
    });

    // Only the calibration flow stamps this, and nothing ever clears it — an
    // offset a player worked for should not vanish because they opened
    // settings and changed the scroll speed.
    if (calibrated) row.calibratedAt = new Date();

    await this.repo.save(row);
    return this.resolved(userId, deviceClass);
  }
}

function pruneUndefined<T extends object>(value: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) out[key as keyof T] = entry as T[keyof T];
  }
  return out;
}
