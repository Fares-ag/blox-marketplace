import { ApplicationStatus } from '@prisma/client';
export type OriginationFunnelGroupBy = 'company' | 'branch' | 'agent';
export declare const ORIGINATION_FUNNEL_GROUPS: readonly OriginationFunnelGroupBy[];
export declare const APPROVAL_TARGET_STATUSES: readonly ApplicationStatus[];
export declare const UNASSIGNED_KEY = "unassigned";
export declare const UNASSIGNED_LABEL = "Unassigned";
export declare const DEFAULT_FUNNEL_WINDOW_DAYS = 30;
export declare const FUNNEL_APPLICATION_CAP = 20000;
export type FunnelApplication = {
    id: string;
    companyId: string;
    branchId: string | null;
    agentUserId: string | null;
    status: ApplicationStatus;
    createdAt: Date;
    submittedAt: Date | null;
    activatedAt: Date | null;
    updatedAt: Date;
};
export type FunnelTransition = {
    applicationId: string;
    fromValue: string | null;
    toValue: string | null;
    createdAt: Date;
};
export type FunnelLabels = {
    companies: Map<string, {
        name: string;
    }>;
    branches: Map<string, {
        name: string;
        companyId: string;
    }>;
    agents: Map<string, {
        name: string;
        homeBranchId: string | null;
    }>;
};
export type OriginationFunnelRow = {
    key: string;
    label: string;
    company_name?: string | null;
    branch_name?: string | null;
    drafts: number;
    submitted: number;
    approved: number;
    activated: number;
    rejected: number;
    approval_rate: number | null;
    median_approval_hours: number | null;
    under_24h_rate: number | null;
};
export type OriginationFunnelTotals = Omit<OriginationFunnelRow, 'key' | 'label'>;
export type OriginationFunnelDto = {
    group_by: OriginationFunnelGroupBy;
    from: string;
    to: string;
    rows: OriginationFunnelRow[];
    totals: OriginationFunnelTotals;
};
export declare function resolveFunnelRange(from?: string, to?: string, now?: Date): {
    from: Date;
    to: Date;
};
export declare function median(values: number[]): number | null;
export declare function firstApprovalAt(transitions: FunnelTransition[]): Date | null;
export declare function firstRejectionAt(transitions: FunnelTransition[]): Date | null;
export declare function resolveFunnelBranchId(app: Pick<FunnelApplication, 'branchId' | 'agentUserId'>, agents: FunnelLabels['agents']): string | null;
export declare function aggregateOriginationFunnel(input: {
    applications: FunnelApplication[];
    transitions: FunnelTransition[];
    groupBy: OriginationFunnelGroupBy;
    from: Date;
    to: Date;
    labels: FunnelLabels;
}): OriginationFunnelDto;
