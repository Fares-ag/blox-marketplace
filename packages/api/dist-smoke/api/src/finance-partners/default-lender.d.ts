export type DefaultLenderCandidate = {
    id: string;
    isDefaultLender: boolean;
};
export type DefaultLenderPlan = {
    clearIds: string[];
    targetIsDefault: boolean;
    changed: boolean;
};
export declare function planDefaultLenderSwitch(partners: DefaultLenderCandidate[], targetId: string, requested: boolean | undefined): DefaultLenderPlan;
export declare function applyDefaultLenderPlan<T extends DefaultLenderCandidate>(partners: T[], targetId: string, plan: DefaultLenderPlan): T[];
export declare function assertDefaultLenderEligible(partner: {
    active: boolean;
}, isDefault: boolean): void;
