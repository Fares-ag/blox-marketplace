export declare class PaginationQueryDto {
    limit?: number;
    offset?: number;
}
export type PaginationResolveOptions = {
    defaultLimit?: number;
    maxLimit?: number;
};
export declare function resolvePagination(query: PaginationQueryDto, opts?: PaginationResolveOptions): {
    limit: number;
    offset: number;
};
export declare function toPaginatedResponse<T>(items: T[], total: number, limit: number, offset: number): {
    total: number;
    limit: number;
    offset: number;
    items: T[];
};
