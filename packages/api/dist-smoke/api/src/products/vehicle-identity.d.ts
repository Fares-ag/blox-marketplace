export type VehicleIdentity = {
    vin?: string | null;
    chassisNumber?: string | null;
    engineNumber?: string | null;
};
export type VehicleIdentityField = 'vin' | 'chassis_number' | 'engine_number';
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
export declare function normalizeIdentityValue(value: string | null | undefined): string | null | undefined;
export declare function hasIdentityValue(value: string | null | undefined): boolean;
export declare function missingVehicleIdentityFields(product: VehicleIdentity): VehicleIdentityField[];
export declare function vehicleIdentityComplete(product: VehicleIdentity): boolean;
export declare function resolveVehicleIdentityInput(dto: VehicleIdentityInput): ResolvedVehicleIdentityInput;
