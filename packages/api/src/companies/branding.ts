import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/**
 * Wire shape of `Company.branding` — mirrors `CompanyBrandingDto` in
 * `@drivemarket/shared` (snake_case, every key present, null when unset).
 */
export type CompanyBranding = {
  primary: string | null;
  accent: string | null;
  logo_url: string | null;
  display_name: string | null;
  tagline: string | null;
};

/** PATCH payload: `undefined` keeps the stored value, `null`/'' clears it. */
export type CompanyBrandingPatch = Partial<Record<keyof CompanyBranding, string | null | undefined>>;

export const BRANDING_KEYS: Array<keyof CompanyBranding> = [
  'primary',
  'accent',
  'logo_url',
  'display_name',
  'tagline',
];

/** Older rows were written by hand in camelCase; read them transparently. */
const LEGACY_KEYS: Record<string, keyof CompanyBranding> = {
  logoUrl: 'logo_url',
  displayName: 'display_name',
  primaryColor: 'primary',
  accentColor: 'accent',
};

const HEX_COLOUR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const LOGO_URL = /^(?:https?:\/\/|\/)[^\s<>"']+$/i;

export function isHexColour(value: string): boolean {
  return HEX_COLOUR.test(value.trim());
}

/** `#ABC` → `#aabbcc`; throws `invalid_hex_colour` for anything but a 3/6-digit hex colour. */
export function normalizeHexColour(value: string): string {
  const trimmed = value.trim();
  if (!HEX_COLOUR.test(trimmed)) throw new BadRequestException('invalid_hex_colour');
  const hex = trimmed.slice(1).toLowerCase();
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  return `#${full}`;
}

function cleanText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readStored(raw: Prisma.JsonValue | null | undefined): Partial<CompanyBranding> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Partial<CompanyBranding> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const target = (BRANDING_KEYS as string[]).includes(key)
      ? (key as keyof CompanyBranding)
      : LEGACY_KEYS[key];
    if (!target || typeof value !== 'string') continue;
    out[target] = cleanText(value);
  }
  return out;
}

function hasAnyValue(branding: CompanyBranding): boolean {
  return BRANDING_KEYS.some((key) => branding[key] != null);
}

/**
 * Stored JSON → wire DTO. `logo_url` falls back to `Company.logoUrl` so both
 * the legacy column and the branding block agree; null when nothing is set.
 */
export function toBrandingDto(
  raw: Prisma.JsonValue | null | undefined,
  fallbackLogoUrl?: string | null,
): CompanyBranding | null {
  const stored = readStored(raw);
  const dto: CompanyBranding = {
    primary: stored.primary ?? null,
    accent: stored.accent ?? null,
    logo_url: stored.logo_url ?? cleanText(fallbackLogoUrl),
    display_name: stored.display_name ?? null,
    tagline: stored.tagline ?? null,
  };
  return hasAnyValue(dto) ? dto : null;
}

/**
 * Applies a PATCH over the stored branding. Only fields present in the patch
 * change; colours in the patch are validated and normalised to `#rrggbb`.
 * Returns null when the result carries no value (store as DB null).
 */
export function mergeBranding(
  raw: Prisma.JsonValue | null | undefined,
  patch: CompanyBrandingPatch,
): CompanyBranding | null {
  const stored = readStored(raw);
  const next: CompanyBranding = {
    primary: stored.primary ?? null,
    accent: stored.accent ?? null,
    logo_url: stored.logo_url ?? null,
    display_name: stored.display_name ?? null,
    tagline: stored.tagline ?? null,
  };
  for (const key of BRANDING_KEYS) {
    if (patch[key] === undefined) continue;
    next[key] = cleanText(patch[key]);
  }
  if (patch.primary !== undefined && next.primary) next.primary = normalizeHexColour(next.primary);
  if (patch.accent !== undefined && next.accent) next.accent = normalizeHexColour(next.accent);
  if (patch.logo_url !== undefined && next.logo_url && !LOGO_URL.test(next.logo_url)) {
    throw new BadRequestException('invalid_logo_url');
  }
  return hasAnyValue(next) ? next : null;
}
