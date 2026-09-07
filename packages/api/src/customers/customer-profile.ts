import type { User } from '@prisma/client';
import { maskQid, parseQid } from '@drivemarket/shared/domain-rules';
import type { CustomerAddressDto, CustomerProfileDto } from '../../../shared/src/types/customer-platform';
import { resolveNotificationPreferences } from './notification-preferences';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 'YYYY-MM-DD' → UTC-midnight Date, or null when the string is not a real calendar date. */
export function parseIsoDate(value: string | null | undefined): Date | null {
  const match = ISO_DATE.exec(String(value ?? '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

export function formatIsoDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Stored address JSON (camelCase keys, same as the application snapshot) → wire DTO. */
export function addressFromJson(raw: unknown): CustomerAddressDto | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const dto: CustomerAddressDto = {
    line1: cleanString(a.line1),
    area: cleanString(a.area),
    city: cleanString(a.city),
    zone: cleanString(a.zone),
    po_box: cleanString(a.poBox ?? a.po_box),
  };
  return Object.values(dto).some((v) => v !== null) ? dto : null;
}

export type AddressPatch = {
  line1?: string | null;
  area?: string | null;
  city?: string | null;
  zone?: string | null;
  po_box?: string | null;
};

/** Merge a PATCH body onto the stored address. Fields absent from the patch are kept; explicit nulls clear. */
export function mergeAddressJson(current: unknown, patch: AddressPatch): Record<string, string | null> {
  const existing = addressFromJson(current) ?? { line1: null, area: null, city: null, zone: null, po_box: null };
  const pick = (key: keyof AddressPatch, stored: string | null | undefined): string | null =>
    key in patch ? cleanString(patch[key]) : (stored ?? null);
  return {
    line1: pick('line1', existing.line1),
    area: pick('area', existing.area),
    city: pick('city', existing.city),
    zone: pick('zone', existing.zone),
    poBox: pick('po_box', existing.po_box),
  };
}

/** "First Last" when both parts are present, otherwise null (leave `name` alone). */
export function composeName(first: string | null | undefined, last: string | null | undefined): string | null {
  const f = first?.trim();
  const l = last?.trim();
  return f && l ? `${f} ${l}` : null;
}

/** `qid` is the plaintext read through `IdentityService.readQid(user)` — never `user.qid` directly. */
export function toCustomerProfileDto(user: User, qid: string | null): CustomerProfileDto {
  const parsed = qid ? parseQid(qid) : null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    first_name: user.firstName ?? null,
    last_name: user.lastName ?? null,
    gender: user.gender ?? null,
    date_of_birth: formatIsoDate(user.dateOfBirth),
    nationality: user.nationality ?? null,
    residency: parsed?.valid ? parsed.residency : null,
    phone: user.phone ?? null,
    qid_masked: qid ? maskQid(qid) || null : null,
    preferred_language: user.preferredLanguage === 'ar' ? 'ar' : 'en',
    notification_preferences: resolveNotificationPreferences(user.notificationPreferences),
    address: addressFromJson(user.address),
  };
}
