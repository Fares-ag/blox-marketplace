/**
 * Compare computed ownership.ts projection vs the ownership register.
 * Alert (exit 1) when drift exceeds 1 unit.
 *
 * Run: npm -w @drivemarket/api run db:reconcile-ownership-register
 */
import { PrismaClient } from '@prisma/client';
import { calculateOwnershipTimeline } from '@drivemarket/shared/ownership';
import { ownershipPctFromUnits } from '@drivemarket/shared/units';

const prisma = new PrismaClient();

async function main() {
  const registers = await prisma.ownershipRegister.findMany({
    include: {
      application: {
        select: {
          id: true,
          pricingSnapshot: true,
          paymentSchedules: true,
          paymentEvents: true,
        },
      },
    },
  });

  const drifts: Array<{ id: string; computed: number; register: number }> = [];
  for (const register of registers) {
    const timeline = calculateOwnershipTimeline(
      register.application.pricingSnapshot as Record<string, unknown>,
      register.application.paymentSchedules.map((s) => ({
        sequence: s.sequence,
        dueDate: s.dueDate.toISOString(),
        amount: Number(s.amount),
        paidAmount: Number(s.paidAmount),
        status: s.status,
        id: s.id,
      })),
      register.application.paymentEvents.map((e) => ({
        type: e.type as 'installment' | 'down_payment' | 'reversal' | 'waive',
        amount: Number(e.amount),
        scheduleId: e.scheduleId,
      })),
    );
    const registerPct = ownershipPctFromUnits(register.customerUnits, register.totalUnits);
    if (Math.abs(timeline.currentOwnership - registerPct) > 1) {
      drifts.push({ id: register.applicationId, computed: timeline.currentOwnership, register: registerPct });
    }
  }

  if (drifts.length) {
    console.error(`Ownership drift on ${drifts.length} applications`);
    for (const d of drifts.slice(0, 20)) {
      console.error(`  ${d.id} computed=${d.computed} register=${d.register}`);
    }
    process.exit(1);
  }
  console.log(`Reconciled ${registers.length} registers — no drift`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
