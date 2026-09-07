"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeIdentityValue = normalizeIdentityValue;
exports.hasIdentityValue = hasIdentityValue;
exports.missingVehicleIdentityFields = missingVehicleIdentityFields;
exports.vehicleIdentityComplete = vehicleIdentityComplete;
exports.resolveVehicleIdentityInput = resolveVehicleIdentityInput;
function normalizeIdentityValue(value) {
    if (value === undefined)
        return undefined;
    if (value === null)
        return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}
function hasIdentityValue(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
function missingVehicleIdentityFields(product) {
    const missing = [];
    if (!hasIdentityValue(product.vin))
        missing.push('vin');
    if (!hasIdentityValue(product.chassisNumber))
        missing.push('chassis_number');
    if (!hasIdentityValue(product.engineNumber))
        missing.push('engine_number');
    return missing;
}
function vehicleIdentityComplete(product) {
    return missingVehicleIdentityFields(product).length === 0;
}
function resolveVehicleIdentityInput(dto) {
    const pick = (snake, camel) => snake !== undefined ? snake : camel;
    return {
        vin: normalizeIdentityValue(dto.vin),
        chassisNumber: normalizeIdentityValue(pick(dto.chassis_number, dto.chassisNumber)),
        engineNumber: normalizeIdentityValue(pick(dto.engine_number, dto.engineNumber)),
    };
}
//# sourceMappingURL=vehicle-identity.js.map