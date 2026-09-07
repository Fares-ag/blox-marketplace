import type { Prisma } from '@prisma/client';
export type CompanyBranding = {
    primary: string | null;
    accent: string | null;
    logo_url: string | null;
    display_name: string | null;
    tagline: string | null;
};
export type CompanyBrandingPatch = Partial<Record<keyof CompanyBranding, string | null | undefined>>;
export declare const BRANDING_KEYS: Array<keyof CompanyBranding>;
export declare function isHexColour(value: string): boolean;
export declare function normalizeHexColour(value: string): string;
export declare function toBrandingDto(raw: Prisma.JsonValue | null | undefined, fallbackLogoUrl?: string | null): CompanyBranding | null;
export declare function mergeBranding(raw: Prisma.JsonValue | null | undefined, patch: CompanyBrandingPatch): CompanyBranding | null;
