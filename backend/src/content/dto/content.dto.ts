import { IsObject } from 'class-validator';

export class UpdateContentDto {
  @IsObject()
  value: Record<string, unknown>;
}
