import { IsIn, IsString, IsUUID, Length } from 'class-validator';
import type { ItemType } from '../entities/item.entity';

const SLOTS = [
  'skin',
  'noteSkin',
  'uiTheme',
  'namePlate',
  'hypeChar',
  'trail',
] as const;

export class PurchaseDto {
  @IsUUID()
  itemId: string;

  /**
   * Supplied by the client and unique per intent, so a retried request is the
   * same purchase rather than a second one.
   */
  @IsString()
  @Length(8, 160)
  idempotencyKey: string;
}

export class EquipDto {
  @IsIn(SLOTS)
  slot: ItemType;

  @IsUUID()
  itemId: string;
}
