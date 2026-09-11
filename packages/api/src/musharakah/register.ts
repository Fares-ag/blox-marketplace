import { BadRequestException } from '@nestjs/common';
import {
  OwnershipRegisterEventType,
  Prisma,
  RentPoolEntryType,
  type PrismaClient,
} from '@prisma/client';
import {
  applyUnitPurchase,
  isMature,
  unitsFromDownPayment,
  type UnitSplit,
} from '@drivemarket/shared/units';

export type RegisterDb = Prisma.TransactionClient | PrismaClient;

export type RegisterSnapshot = {
  id: string;
  applicationId: string;
  totalUnits: number;
  customerUnits: number;
  bloxUnits: number;
  vehiclePrice: Prisma.Decimal;
  unitNominalValue: Prisma.Decimal;
  maturedAt: Date | null;
};

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function splitFromPricing(pricing: Record<string, unknown>): UnitSplit {
  const vehiclePrice = Number(pricing.list_price ?? 0);
  const downPayment = Number(pricing.down_payment ?? 0);
  return unitsFromDownPayment(vehiclePrice, downPayment);
}

export async function findRegister(db: RegisterDb, applicationId: string): Promise<RegisterSnapshot | null> {
  return db.ownershipRegister.findUnique({ where: { applicationId } });
}

export async function openRegister(
  db: RegisterDb,
  input: {
    applicationId: string;
    pricing: Record<string, unknown>;
    actorUserId?: string | null;
    paymentEventId?: string | null;
  },
): Promise<RegisterSnapshot> {
  const existing = await findRegister(db, input.applicationId);
  if (existing) return existing;

  const split = splitFromPricing(input.pricing);
  const register = await db.ownershipRegister.create({
    data: {
      applicationId: input.applicationId,
      totalUnits: split.totalUnits,
      customerUnits: split.customerUnits,
      bloxUnits: split.bloxUnits,
      vehiclePrice: new Prisma.Decimal(String(split.vehiclePrice)),
      unitNominalValue: new Prisma.Decimal(String(split.unitNominalValue)),
    },
  });

  await db.ownershipRegisterEntry.create({
    data: {
      registerId: register.id,
      eventType: OwnershipRegisterEventType.open,
      unitsDelta: split.customerUnits,
      customerUnitsAfter: split.customerUnits,
      bloxUnitsAfter: split.bloxUnits,
      paymentEventId: input.paymentEventId ?? null,
      actorUserId: input.actorUserId ?? null,
      metadata: asJson({ source: 'open' }),
    },
  });

  if (split.customerUnits > 0) {
    await db.ownershipRegisterEntry.create({
      data: {
        registerId: register.id,
        eventType: OwnershipRegisterEventType.initial_contribution,
        unitsDelta: split.customerUnits,
        customerUnitsAfter: split.customerUnits,
        bloxUnitsAfter: split.bloxUnits,
        paymentEventId: input.paymentEventId ?? null,
        actorUserId: input.actorUserId ?? null,
        metadata: asJson({ source: 'initial_contribution' }),
      },
    });
  }

  return register;
}

export async function appendRegisterEntry(
  db: RegisterDb,
  input: {
    applicationId: string;
    eventType: OwnershipRegisterEventType;
    unitsDelta: number;
    paymentEventId?: string | null;
    actorUserId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<RegisterSnapshot> {
  const register = await db.ownershipRegister.findUnique({ where: { applicationId: input.applicationId } });
  if (!register) {
    throw new BadRequestException('ownership_register_missing');
  }

  const next = applyUnitPurchase(
    {
      totalUnits: register.totalUnits,
      customerUnits: register.customerUnits,
      bloxUnits: register.bloxUnits,
    },
    input.unitsDelta,
  );
  const matured = isMature(next.bloxUnits);

  const updated = await db.ownershipRegister.update({
    where: { id: register.id },
    data: {
      customerUnits: next.customerUnits,
      bloxUnits: next.bloxUnits,
      maturedAt: matured ? (register.maturedAt ?? new Date()) : register.maturedAt,
    },
  });

  await db.ownershipRegisterEntry.create({
    data: {
      registerId: register.id,
      eventType: input.eventType,
      unitsDelta: input.unitsDelta,
      customerUnitsAfter: next.customerUnits,
      bloxUnitsAfter: next.bloxUnits,
      paymentEventId: input.paymentEventId ?? null,
      actorUserId: input.actorUserId ?? null,
      metadata: input.metadata ? asJson(input.metadata) : undefined,
    },
  });

  return updated;
}

export async function zeroRemainingUnits(
  db: RegisterDb,
  input: {
    applicationId: string;
    eventType: OwnershipRegisterEventType;
    paymentEventId?: string | null;
    actorUserId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<RegisterSnapshot | null> {
  const register = await findRegister(db, input.applicationId);
  if (!register) return null;
  if (register.bloxUnits <= 0) return register;
  return appendRegisterEntry(db, {
    ...input,
    unitsDelta: register.bloxUnits,
  });
}

export async function recordRentPool(
  db: RegisterDb,
  input: {
    applicationId: string;
    type: RentPoolEntryType;
    amount: Prisma.Decimal | number;
    period?: number | null;
    paymentEventId?: string | null;
    actorUserId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const amount =
    input.amount instanceof Prisma.Decimal ? input.amount : new Prisma.Decimal(String(input.amount));
  if (amount.lte(0)) return;
  await db.rentPoolLedgerEntry.create({
    data: {
      applicationId: input.applicationId,
      type: input.type,
      amount,
      period: input.period ?? null,
      paymentEventId: input.paymentEventId ?? null,
      actorUserId: input.actorUserId ?? null,
      metadata: input.metadata ? asJson(input.metadata) : undefined,
    },
  });
}

export function registerDto(register: RegisterSnapshot) {
  return {
    application_id: register.applicationId,
    total_units: register.totalUnits,
    customer_units: register.customerUnits,
    blox_units: register.bloxUnits,
    vehicle_price: Number(register.vehiclePrice),
    unit_nominal_value: Number(register.unitNominalValue),
    matured: isMature(register.bloxUnits),
    matured_at: register.maturedAt?.toISOString() ?? null,
  };
}
