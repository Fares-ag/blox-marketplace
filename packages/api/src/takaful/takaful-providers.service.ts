import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TakafulProvider, User } from '@prisma/client';
import type { TakafulProviderDto, TakafulQuoteDto } from '../../../shared/src/types/customer-platform';
import { ActivityService } from '../common/activity.service';
import { isUniqueConstraintError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { quoteTakaful, ridersToJson, toTakafulProviderDto, type TakafulCoverage } from './takaful-quote';

export type TakafulRiderInput = { code: string; label: string; label_ar?: string | null; annual_amount: number };

export type TakafulProviderInput = {
  code?: string;
  name?: string;
  name_ar?: string | null;
  comprehensive_rate_pct?: number;
  third_party_annual?: number | null;
  min_contribution?: number | null;
  riders?: TakafulRiderInput[];
  contact_phone?: string | null;
  contact_email?: string | null;
  website?: string | null;
  notes?: string | null;
  active?: boolean;
  sort_order?: number;
};

export type CreateTakafulProviderInput = TakafulProviderInput & {
  code: string;
  name: string;
  comprehensive_rate_pct: number;
};

function optionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Takaful provider master (admin-maintained rate cards) and the public
 * indicative quote comparison built from it.
 */
@Injectable()
export class TakafulProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  /** Public: one indicative quote per active provider that can price the cover, cheapest first. */
  async quotes(coverage: TakafulCoverage, vehiclePrice: number | null): Promise<TakafulQuoteDto[]> {
    if (coverage === 'comprehensive' && !(vehiclePrice && vehiclePrice > 0)) {
      throw new BadRequestException('vehicle_price_required');
    }
    const rows = await this.prisma.takafulProvider.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return quoteTakaful(rows.map(toTakafulProviderDto), coverage, vehiclePrice);
  }

  // ---- Admin ----

  async list(): Promise<TakafulProviderDto[]> {
    const rows = await this.prisma.takafulProvider.findMany({
      orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toTakafulProviderDto);
  }

  async get(id: string): Promise<TakafulProviderDto> {
    return toTakafulProviderDto(await this.require(id));
  }

  async create(actor: User, input: CreateTakafulProviderInput): Promise<TakafulProviderDto> {
    let created: TakafulProvider;
    try {
      created = await this.prisma.takafulProvider.create({
        data: {
          code: input.code.trim().toLowerCase(),
          name: input.name.trim(),
          nameAr: optionalText(input.name_ar),
          comprehensiveRatePct: input.comprehensive_rate_pct,
          thirdPartyAnnual: input.third_party_annual ?? null,
          minContribution: input.min_contribution ?? null,
          riders: input.riders ? ridersToJson(input.riders) : undefined,
          contactPhone: optionalText(input.contact_phone),
          contactEmail: optionalText(input.contact_email),
          website: optionalText(input.website),
          notes: optionalText(input.notes),
          active: input.active ?? true,
          sortOrder: input.sort_order ?? 0,
        },
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) throw new ConflictException('takaful_provider_code_exists');
      throw err;
    }
    await this.activity.log({
      actorUserId: actor.id,
      entityType: 'takaful_provider',
      entityId: created.id,
      action: 'takaful_provider_created',
      toValue: created.code,
      metadata: {
        comprehensive_rate_pct: input.comprehensive_rate_pct,
        third_party_annual: input.third_party_annual ?? null,
        active: created.active,
      },
    });
    return toTakafulProviderDto(created);
  }

  async update(actor: User, id: string, input: TakafulProviderInput): Promise<TakafulProviderDto> {
    const existing = await this.require(id);
    const data: Prisma.TakafulProviderUpdateInput = {
      ...(input.code !== undefined ? { code: input.code.trim().toLowerCase() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.name_ar !== undefined ? { nameAr: optionalText(input.name_ar) } : {}),
      ...(input.comprehensive_rate_pct !== undefined ? { comprehensiveRatePct: input.comprehensive_rate_pct } : {}),
      ...(input.third_party_annual !== undefined ? { thirdPartyAnnual: input.third_party_annual } : {}),
      ...(input.min_contribution !== undefined ? { minContribution: input.min_contribution } : {}),
      ...(input.riders !== undefined ? { riders: ridersToJson(input.riders) } : {}),
      ...(input.contact_phone !== undefined ? { contactPhone: optionalText(input.contact_phone) } : {}),
      ...(input.contact_email !== undefined ? { contactEmail: optionalText(input.contact_email) } : {}),
      ...(input.website !== undefined ? { website: optionalText(input.website) } : {}),
      ...(input.notes !== undefined ? { notes: optionalText(input.notes) } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.sort_order !== undefined ? { sortOrder: input.sort_order } : {}),
    };
    if (!Object.keys(data).length) return toTakafulProviderDto(existing);

    let updated: TakafulProvider;
    try {
      updated = await this.prisma.takafulProvider.update({ where: { id: existing.id }, data });
    } catch (err) {
      if (isUniqueConstraintError(err)) throw new ConflictException('takaful_provider_code_exists');
      throw err;
    }
    await this.activity.log({
      actorUserId: actor.id,
      entityType: 'takaful_provider',
      entityId: existing.id,
      action: 'takaful_provider_updated',
      fromValue: existing.active ? 'active' : 'inactive',
      toValue: updated.active ? 'active' : 'inactive',
      metadata: { fields: Object.keys(data) },
    });
    return toTakafulProviderDto(updated);
  }

  private async require(id: string): Promise<TakafulProvider> {
    const row = await this.prisma.takafulProvider.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('takaful_provider_not_found');
    return row;
  }
}
