import { ConflictException } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { assertRowsUpdated, transitionApplication } from './guarded-transitions';

describe('guarded-transitions', () => {
  it('throws stale_transition when update count is 0', () => {
    expect(() => assertRowsUpdated(0)).toThrow(ConflictException);
    expect(() => assertRowsUpdated(0)).toThrow('stale_transition');
  });

  it('throws vehicle_unavailable when reservation guard fails', () => {
    expect(() => assertRowsUpdated(0, 'vehicle_unavailable')).toThrow('vehicle_unavailable');
  });

  it('simulates a second concurrent transition attempt after status already advanced', async () => {
    const tx = {
      application: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    await expect(
      transitionApplication(tx as never, 'app-1', ApplicationStatus.under_review, {
        status: ApplicationStatus.contract_signing_required,
      }),
    ).rejects.toMatchObject({ message: 'stale_transition' });

    expect(tx.application.updateMany).toHaveBeenCalledWith({
      where: { id: 'app-1', status: ApplicationStatus.under_review },
      data: { status: ApplicationStatus.contract_signing_required },
    });
  });
});
