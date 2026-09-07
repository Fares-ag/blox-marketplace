type MulterLikeError = Error & {
    code?: string;
};
export declare function applyMulterErrorMiddleware(expressApp: {
    use: (...handlers: unknown[]) => unknown;
}, multer: {
    MulterError: new (...args: unknown[]) => MulterLikeError;
}): void;
export {};
