import { describe, expect, it, vi } from 'vitest';
import { HTTP_REQUEST_TIMEOUT_CODE } from '../common/fetch-with-timeout';
import { JobsService } from './jobs.service';

describe('JobsService.runZohoRetry', () => {
  function buildService(deps: {
    syncApplicationToZoho: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  }) {
    const health = { recordSuccess: vi.fn(), checkStale: vi.fn(), registerJob: vi.fn() };
    return {
      service: new JobsService(
        { get: () => undefined } as never,
        { addCronJob: vi.fn() } as never,
        health as never,
        {} as never,
        {} as never,
        {} as never,
        { syncApplicationToZoho: deps.syncApplicationToZoho } as never,
        {} as never,
        { application: { findMany: deps.findMany } } as never,
      ),
      health,
    };
  }

  it('continues the batch when one item times out and the next succeeds', async () => {
    const syncApplicationToZoho = vi
      .fn()
      .mockResolvedValueOnce({ zohoLeadId: null, error: HTTP_REQUEST_TIMEOUT_CODE })
      .mockResolvedValueOnce({ zohoLeadId: 'lead-2' });
    const findMany = vi.fn().mockResolvedValue([{ id: 'app-1' }, { id: 'app-2' }]);

    const { service, health } = buildService({ syncApplicationToZoho, findMany });
    const result = await service.runZohoRetry();

    expect(result).toEqual({ attempted: 2, succeeded: 1, failed: 1 });
    expect(syncApplicationToZoho).toHaveBeenCalledTimes(2);
    expect(health.recordSuccess).toHaveBeenCalledWith('zoho-retry');
  });

  it('continues the batch when one item throws unexpectedly', async () => {
    const syncApplicationToZoho = vi
      .fn()
      .mockRejectedValueOnce(new Error('unexpected'))
      .mockResolvedValueOnce({ zohoLeadId: 'lead-2' });
    const findMany = vi.fn().mockResolvedValue([{ id: 'app-1' }, { id: 'app-2' }]);

    const { service } = buildService({ syncApplicationToZoho, findMany });
    const result = await service.runZohoRetry();

    expect(result).toEqual({ attempted: 2, succeeded: 1, failed: 1 });
    expect(syncApplicationToZoho).toHaveBeenCalledTimes(2);
  });
});
