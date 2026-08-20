import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { resolvePagination, toPaginatedResponse } from './pagination.dto';

describe('pagination.dto', () => {
  it('clamps limit and normalizes offset', () => {
    expect(resolvePagination({ limit: 999, offset: -5 }, { maxLimit: 100, defaultLimit: 50 })).toEqual({
      limit: 100,
      offset: 0,
    });
  });

  it('applies defaults when query params are omitted', () => {
    expect(resolvePagination({})).toEqual({ limit: 50, offset: 0 });
  });

  it('builds the paginated envelope', () => {
    expect(toPaginatedResponse(['a'], 10, 5, 0)).toEqual({
      total: 10,
      limit: 5,
      offset: 0,
      items: ['a'],
    });
  });
});
