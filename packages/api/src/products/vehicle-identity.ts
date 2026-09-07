/**
 * Vehicle identity (LOS FSD inventory rules): VIN, chassis number and engine
 * number must all be present before a listing can be reserved by a submitted
 * application. Pure helpers shared by the dealer/ops product DTOs.
 */
export type VehicleIdentity = {
  vin?: string | null;
  chassisNumber?: string | null;
  engineNumber?: string | null;
};

export type VehicleIdentityField = 'vin' | 'chassis_number' | 'engine_number';

/** Payload fields accepted for identity, in either casing. */
export type VehicleIdentityInput = {
  vin?: string | null;
  chassisNumber?: string | null;
  chassis_number?: string | null;
  engineNumber?: string | null;
  engine_number?: string | null;
};

export type ResolvedVehicleIdentityInput = {
  vin?: string | null;
  chassisNumber?: string | null;
  engineNumber?: string | null;
};

/** `undefined` = field not sent (keep), `null`/'' = clear, otherwise trimmed. */
export function normalizeIdentityValue(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function hasIdentityValue(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function missingVehicleIdentityFields(product: VehicleIdentity): VehicleIdentityField[] {
  const missing: VehicleIdentityField[] = [];
  if (!hasIdentityValue(product.vin)) missing.push('vin');
  if (!hasIdentityValue(product.chassisNumber)) missing.push('chassis_number');
  if (!hasIdentityValue(product.engineNumber)) missing.push('engine_number');
  return missing;
}

export function vehicleIdentityComplete(product: VehicleIdentity): boolean {
  return missingVehicleIdentityFields(product).length === 0;
}

/**
 * Reads identity fields from a create/update payload. snake_case wins when
 * both spellings are present; absent fields stay `undefined` so Prisma leaves
 * the column untouched.
 */
export function resolveVehicleIdentityInput(dto: VehicleIdentityInput): ResolvedVehicleIdentityInput {
  const pick = (snake: string | null | undefined, camel: string | null | undefined) =>
    snake !== undefined ? snake : camel;
  return {
    vin: normalizeIdentityValue(dto.vin),
    chassisNumber: normalizeIdentityValue(pick(dto.chassis_number, dto.chassisNumber)),
    engineNumber: normalizeIdentityValue(pick(dto.engine_number, dto.engineNumber)),
  };
}
