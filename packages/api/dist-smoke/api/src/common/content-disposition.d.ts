export declare function buildContentDisposition(filename: string, type?: 'attachment' | 'inline'): string;
export declare function setFileDownloadHeaders(res: {
    setHeader: (name: string, value: string) => void;
}, contentType: string, filename: string, disposition?: 'attachment' | 'inline'): void;
