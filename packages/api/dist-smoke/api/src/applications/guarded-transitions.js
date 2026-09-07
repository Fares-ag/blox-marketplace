"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertRowsUpdated = assertRowsUpdated;
exports.transitionApplication = transitionApplication;
const common_1 = require("@nestjs/common");
function assertRowsUpdated(count, code = 'stale_transition') {
    if (count === 0) {
        throw new common_1.ConflictException(code);
    }
}
async function transitionApplication(tx, id, fromStatus, data) {
    const result = await tx.application.updateMany({
        where: { id, status: fromStatus },
        data,
    });
    assertRowsUpdated(result.count, 'stale_transition');
}
//# sourceMappingURL=guarded-transitions.js.map