import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import type {
  DeviceClass,
  LaneColorMode,
} from '../entities/user-settings.entity';

const DEVICE_CLASSES = ['desktop', 'mobile', 'tablet'] as const;
const LANE_COLOR_MODES = [
  'default',
  'highContrast',
  'deuteranopia',
  'protanopia',
] as const;

export class DeviceClassQuery {
  @IsIn(DEVICE_CLASSES)
  deviceClass: DeviceClass;
}

/**
 * Bounds mirror the CHECK constraints on `game_user_settings`.
 *
 * Duplicated deliberately: the database constraint is the guarantee, and this
 * is the one that produces a 400 with a readable message instead of a 500 from
 * a violated constraint.
 */
export class UpdateGameSettingsDto {
  @IsIn(DEVICE_CLASSES)
  deviceClass: DeviceClass;

  @IsOptional()
  @IsInt()
  @Min(-1000)
  @Max(1000)
  audioOffsetMs?: number;

  @IsOptional()
  @IsInt()
  @Min(-1000)
  @Max(1000)
  visualOffsetMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(10)
  scrollSpeed?: number;

  @IsOptional()
  @IsBoolean()
  reducedMotion?: boolean;

  @IsOptional()
  @IsIn(LANE_COLOR_MODES)
  laneColorMode?: LaneColorMode;

  /**
   * True when this update is the result of finishing the calibration flow.
   * Stamps `calibratedAt`, which is what stops the first-run prompt coming
   * back. A plain settings edit leaves it alone — nothing silently resets it.
   */
  @IsOptional()
  @IsBoolean()
  calibrated?: boolean;
}
