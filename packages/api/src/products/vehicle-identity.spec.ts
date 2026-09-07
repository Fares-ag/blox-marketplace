import { describe, expect, it } from 'vitest';
import {
  missingVehicleIdentityFields,
  normalizeIdentityValue,
  resolveVehicleIdentityInput,
  vehicleIdentityComplete,
} from './vehicle-identity';

describe('vehicle identity', () => {
  it('is complete only when vin, chassis and engine numbers are all non-empty', () => {
    expect(vehicleIdentityComplete({ vin: 'WVW123', chassisNumber: 'CH1', engineNumber: 'EN1' })).toBe(true);
    expect(vehicleIdentityComplete({ vin: 'WVW123', chassisNumber: 'CH1', engineNumber: '  ' })).toBe(false);
    expect(vehicleIdentityComplete({ vin: null, chassisNumber: 'CH1', engineNumber: 'EN1' })).toBe(false);
    expect(vehicleIdentityComplete({})).toBe(false);
  });

  it('lists the missing fields in wire casing', () => {
    expect(missingVehicleIdentityFields({ vin: 'X' })).toEqual(['chassis_number', 'engine_number']);
    expect(missingVehicleIdentityFields({ vin: '', chassisNumber: 'C', engineNumber: 'E' })).toEqual(['vin']);
  });

  it('normalises payload values: undefined keeps, empty clears, strings are trimmed', () => {
    expect(normalizeIdentityValue(undefined)).toBeUndefined();
    expect(normalizeIdentityValue(null)).toBeNull();
    expect(normalizeIdentityValue('   ')).toBeNull();
    expect(normalizeIdentityValue(' EN-42 ')).toBe('EN-42');
  });

  it('accepts both snake_case and camelCase identity fields, snake_case winning', () => {
    expect(resolveVehicleIdentityInput({ engine_number: 'E1', chassisNumber: 'C1' })).toEqual({
      vin: undefined,
      chassisNumber: 'C1',
      engineNumber: 'E1',
    });
    expect(resolveVehicleIdentityInput({ engine_number: 'snake', engineNumber: 'camel' }).engineNumber).toBe(
      'snake',
    );
    expect(resolveVehicleIdentityInput({ vin: 'V', chassis_number: '' })).toEqual({
      vin: 'V',
      chassisNumber: null,
      engineNumber: undefined,
    });
  });
});
