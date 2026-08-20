import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export type PaginationResolveOptions = {
  defaultLimit?: number;
  maxLimit?: number;
};

export function resolvePagination(
  query: PaginationQueryDto,
  opts: PaginationResolveOptions = {},
): { limit: number; offset: number } {
  const maxLimit = opts.maxLimit ?? 200;
  const defaultLimit = opts.defaultLimit ?? 50;
  const limit = Math.min(Math.max(query.limit ?? defaultLimit, 1), maxLimit);
  const offset = Math.max(query.offset ?? 0, 0);
  return { limit, offset };
}

export function toPaginatedResponse<T>(
  items: T[],
  total: number,
  limit: number,
  offset: number,
) {
  return { total, limit, offset, items };
}
