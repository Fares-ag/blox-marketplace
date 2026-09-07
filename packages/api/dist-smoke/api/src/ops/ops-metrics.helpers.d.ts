export declare function weekBuckets(count: number): Array<{
    label: string;
    start: Date;
    end: Date;
}>;
export declare function countInRange<T extends {
    createdAt: Date;
}>(items: T[], start: Date, end: Date): number;
