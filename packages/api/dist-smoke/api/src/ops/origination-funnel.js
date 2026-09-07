"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FUNNEL_APPLICATION_CAP = exports.DEFAULT_FUNNEL_WINDOW_DAYS = exports.UNASSIGNED_LABEL = exports.UNASSIGNED_KEY = exports.APPROVAL_TARGET_STATUSES = exports.ORIGINATION_FUNNEL_GROUPS = void 0;
exports.resolveFunnelRange = resolveFunnelRange;
exports.median = median;
exports.firstApprovalAt = firstApprovalAt;
exports.firstRejectionAt = firstRejectionAt;
exports.resolveFunnelBranchId = resolveFunnelBranchId;
exports.aggregateOriginationFunnel = aggregateOriginationFunnel;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
exports.ORIGINATION_FUNNEL_GROUPS = ['company', 'branch', 'agent'];
exports.APPROVAL_TARGET_STATUSES = [
    client_1.ApplicationStatus.contract_signing_required,
    client_1.ApplicationStatus.partner_processing,
    client_1.ApplicationStatus.pending_finance_activation,
    client_1.ApplicationStatus.active,
];
exports.UNASSIGNED_KEY = 'unassigned';
exports.UNASSIGNED_LABEL = 'Unassigned';
exports.DEFAULT_FUNNEL_WINDOW_DAYS = 30;
exports.FUNNEL_APPLICATION_CAP = 20_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
function parseBoundary(value, endOfDay) {
    const trimmed = value.trim();
    const date = DATE_ONLY.test(trimmed)
        ? new Date(`${trimmed}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
        : new Date(trimmed);
    if (Number.isNaN(date.getTime()))
        throw new common_1.BadRequestException('invalid_date_range');
    return date;
}
function resolveFunnelRange(from, to, now = new Date()) {
    const toDate = to ? parseBoundary(to, true) : now;
    const fromDate = from
        ? parseBoundary(from, false)
        : new Date(toDate.getTime() - exports.DEFAULT_FUNNEL_WINDOW_DAYS * 86_400_000);
    if (fromDate.getTime() > toDate.getTime())
        throw new common_1.BadRequestException('invalid_date_range');
    return { from: fromDate, to: toDate };
}
function median(values) {
    if (!values.length)
        return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function firstApprovalAt(transitions) {
    let first = null;
    for (const t of transitions) {
        if (t.fromValue !== client_1.ApplicationStatus.under_review)
            continue;
        if (!t.toValue || !exports.APPROVAL_TARGET_STATUSES.includes(t.toValue))
            continue;
        if (!first || t.createdAt.getTime() < first.getTime())
            first = t.createdAt;
    }
    return first;
}
function firstRejectionAt(transitions) {
    let first = null;
    for (const t of transitions) {
        if (t.toValue !== client_1.ApplicationStatus.rejected)
            continue;
        if (!first || t.createdAt.getTime() < first.getTime())
            first = t.createdAt;
    }
    return first;
}
function resolveFunnelBranchId(app, agents) {
    if (app.branchId)
        return app.branchId;
    if (app.agentUserId)
        return agents.get(app.agentUserId)?.homeBranchId ?? null;
    return null;
}
function newBucket(descriptor) {
    return { ...descriptor, drafts: 0, submitted: 0, approved: 0, activated: 0, rejected: 0, durations: [] };
}
function inRange(date, from, to) {
    if (!date)
        return false;
    const t = date.getTime();
    return t >= from.getTime() && t <= to.getTime();
}
function round(value, digits) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}
function describeGroup(app, groupBy, labels) {
    const companyName = labels.companies.get(app.companyId)?.name ?? null;
    const unassigned = {
        key: `${exports.UNASSIGNED_KEY}:${app.companyId}`,
        label: exports.UNASSIGNED_LABEL,
        company_name: companyName,
        branch_name: null,
    };
    if (groupBy === 'company') {
        return { key: app.companyId, label: companyName ?? app.companyId, company_name: companyName, branch_name: null };
    }
    if (groupBy === 'branch') {
        const branchId = resolveFunnelBranchId(app, labels.agents);
        if (!branchId)
            return unassigned;
        const branch = labels.branches.get(branchId);
        const branchName = branch?.name ?? branchId;
        return {
            key: branchId,
            label: branchName,
            company_name: (branch && labels.companies.get(branch.companyId)?.name) ?? companyName,
            branch_name: branchName,
        };
    }
    if (!app.agentUserId)
        return unassigned;
    const agent = labels.agents.get(app.agentUserId);
    const homeBranch = agent?.homeBranchId ? labels.branches.get(agent.homeBranchId) : undefined;
    return {
        key: app.agentUserId,
        label: agent?.name ?? app.agentUserId,
        company_name: companyName,
        branch_name: homeBranch?.name ?? null,
    };
}
function finalize(bucket) {
    const med = median(bucket.durations);
    return {
        key: bucket.key,
        label: bucket.label,
        company_name: bucket.company_name,
        branch_name: bucket.branch_name,
        drafts: bucket.drafts,
        submitted: bucket.submitted,
        approved: bucket.approved,
        activated: bucket.activated,
        rejected: bucket.rejected,
        approval_rate: bucket.submitted ? round(Math.min(1, bucket.approved / bucket.submitted), 4) : null,
        median_approval_hours: med === null ? null : round(med, 1),
        under_24h_rate: bucket.durations.length
            ? round(bucket.durations.filter((hours) => hours <= 24).length / bucket.durations.length, 4)
            : null,
    };
}
function aggregateOriginationFunnel(input) {
    const { from, to, groupBy, labels } = input;
    const transitionsByApp = new Map();
    for (const t of input.transitions) {
        const list = transitionsByApp.get(t.applicationId);
        if (list)
            list.push(t);
        else
            transitionsByApp.set(t.applicationId, [t]);
    }
    const buckets = new Map();
    const totals = newBucket({ key: 'total', label: 'Total', company_name: null, branch_name: null });
    for (const app of input.applications) {
        const descriptor = describeGroup(app, groupBy, labels);
        let bucket = buckets.get(descriptor.key);
        if (!bucket) {
            bucket = newBucket(descriptor);
            buckets.set(descriptor.key, bucket);
        }
        const transitions = transitionsByApp.get(app.id) ?? [];
        const approvedAt = firstApprovalAt(transitions);
        const rejectedAt = firstRejectionAt(transitions) ?? (app.status === client_1.ApplicationStatus.rejected ? app.updatedAt : null);
        const drafts = app.status === client_1.ApplicationStatus.draft && inRange(app.createdAt, from, to) ? 1 : 0;
        const submitted = inRange(app.submittedAt, from, to) ? 1 : 0;
        const approved = inRange(approvedAt, from, to) ? 1 : 0;
        const activated = inRange(app.activatedAt, from, to) ? 1 : 0;
        const rejected = inRange(rejectedAt, from, to) ? 1 : 0;
        const duration = approved && approvedAt && app.submittedAt
            ? Math.max(0, (approvedAt.getTime() - app.submittedAt.getTime()) / 3_600_000)
            : null;
        for (const target of [bucket, totals]) {
            target.drafts += drafts;
            target.submitted += submitted;
            target.approved += approved;
            target.activated += activated;
            target.rejected += rejected;
            if (duration !== null)
                target.durations.push(duration);
        }
    }
    const rows = [...buckets.values()]
        .map(finalize)
        .sort((a, b) => b.submitted - a.submitted || b.drafts - a.drafts || a.label.localeCompare(b.label));
    const { key: _key, label: _label, ...totalsRow } = finalize(totals);
    return {
        group_by: groupBy,
        from: from.toISOString(),
        to: to.toISOString(),
        rows,
        totals: totalsRow,
    };
}
//# sourceMappingURL=origination-funnel.js.map