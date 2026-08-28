import {
  IsBase64,
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class StartRunDto {
  @IsUUID()
  chartId: string;

  /** No-fail practice: never validated, never on a leaderboard, never coins. */
  @IsOptional()
  @IsBoolean()
  practiceMode?: boolean;
}

export class SubmitRunDto {
  @IsUUID()
  runToken: string;

  /**
   * Gzipped, delta-encoded input log, base64 for transport.
   *
   * Capped so a submission cannot be used to post megabytes at the API. A
   * three-minute Extreme run packs to a few kilobytes, so 512KB of base64 is
   * two orders of magnitude of headroom and still a hard stop.
   */
  @IsBase64()
  @MaxLength(512 * 1024)
  inputLog: string;

  /** Compared against the server's own replay, then discarded. */
  @IsInt()
  clientScore: number;

  @IsInt()
  @Min(0)
  @Max(60 * 60 * 1000)
  elapsedMs: number;
}
