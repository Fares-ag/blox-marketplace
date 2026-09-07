"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRANCH_INCLUDE = void 0;
exports.toBranchDto = toBranchDto;
exports.toBranchRefDto = toBranchRefDto;
exports.BRANCH_INCLUDE = {
    _count: { select: { staff: { where: { isActive: true } } } },
};
function toBranchDto(branch) {
    return {
        id: branch.id,
        company_id: branch.companyId,
        code: branch.code,
        name: branch.name,
        city: branch.city,
        address: branch.address,
        phone: branch.phone,
        active: branch.active,
        staff_count: branch._count?.staff ?? 0,
        created_at: branch.createdAt.toISOString(),
    };
}
function toBranchRefDto(branch) {
    if (!branch)
        return null;
    return { id: branch.id, code: branch.code, name: branch.name };
}
//# sourceMappingURL=branch-response.dto.js.map