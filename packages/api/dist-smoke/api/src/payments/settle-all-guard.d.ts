export type SettleAllProbe = {
    scheduleId?: string | null;
    dueDate?: string | null;
    custom1?: string | null;
};
export declare function isSettleAllRequest(probe: SettleAllProbe): boolean;
export declare function assertNotSettleAll(probe: SettleAllProbe): void;
