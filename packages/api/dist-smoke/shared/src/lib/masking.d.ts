export declare function maskQid(value: string | null | undefined): string;
export declare function maskPhone(value: string | null | undefined): string;
export declare function maskIban(value: string | null | undefined): string;
export declare function maskEmail(value: string | null | undefined): string;
export declare function maskName(value: string | null | undefined): string;
export type MaskableSnapshot = Record<string, unknown>;
export declare function maskCustomerSnapshot(snapshot: MaskableSnapshot | null | undefined): MaskableSnapshot | null;
