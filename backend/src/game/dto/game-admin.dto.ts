import {
  IsDefined,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import type { RejectionAction } from '../entities/run-rejection.entity';

export class ReviewRejectionDto {
  @IsIn(['dismissed', 'voided', 'suspended'])
  action: RejectionAction;
}

export class RemoveEntryDto {
  /**
   * Required, and long enough to be a sentence. A removal nobody can explain
   * later is indistinguishable from a mistake.
   */
  @IsString()
  @Length(4, 500)
  reason: string;
}

export class AdjustCoinsDto {
  /**
   * Bounded in both directions. An adjustment is a correction, and a six-digit
   * one is a typo — the cap is what stops a slipped keypress minting a fortune
   * that then has to be explained in the ledger forever.
   */
  @IsInt()
  @Min(-100_000)
  @Max(100_000)
  delta: number;

  @IsString()
  @Length(4, 500)
  note: string;
}

export class GrantItemDto {
  @IsUUID()
  itemId: string;
}

export class WriteConfigDto {
  @IsString()
  @Length(1, 64)
  key: string;

  /** Shape depends on the key; each is validated where it is consumed. */
  @IsDefined()
  value: unknown;
}
