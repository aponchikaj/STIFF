import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListAuditDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsIn(['POST', 'PUT', 'PATCH', 'DELETE'])
  method?: string;

  /** Substring match on the request path, e.g. "orders". */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  path?: string;
}
