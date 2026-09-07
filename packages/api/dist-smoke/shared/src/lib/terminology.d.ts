export type ForbiddenTermHit = {
    term: string;
    index: number;
    context: string;
};
export declare const FORBIDDEN_TERMS: ReadonlyArray<{
    term: string;
    pattern: RegExp;
}>;
export declare function findForbiddenTerms(text: string): ForbiddenTermHit[];
export declare function findForbiddenTermsInObject(value: unknown, path?: string[]): Array<{
    path: string;
    hit: ForbiddenTermHit;
}>;
