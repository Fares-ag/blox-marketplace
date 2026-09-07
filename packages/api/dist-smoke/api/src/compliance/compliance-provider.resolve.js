"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isComplianceDevProviderEnabled = isComplianceDevProviderEnabled;
exports.resolveComplianceProviderKind = resolveComplianceProviderKind;
exports.resolveComplianceProvider = resolveComplianceProvider;
function isComplianceDevProviderEnabled(config) {
    if (process.env.NODE_ENV === 'production')
        return false;
    const flag = config.get('COMPLIANCE_DEV_PROVIDER');
    return flag === 'true' || flag === '1';
}
function resolveComplianceProviderKind(config) {
    const explicit = config.get('COMPLIANCE_PROVIDER')?.trim().toLowerCase();
    if (explicit === 'synthetic' || explicit === 'dev-recorded' || explicit === 'dev') {
        return 'synthetic';
    }
    if (explicit === 'stub')
        return 'stub';
    if (isComplianceDevProviderEnabled(config))
        return 'synthetic';
    return 'stub';
}
function resolveComplianceProvider(config, stub, dev) {
    return resolveComplianceProviderKind(config) === 'synthetic' ? dev : stub;
}
//# sourceMappingURL=compliance-provider.resolve.js.map