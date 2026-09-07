import { BadRequestException, Injectable } from '@nestjs/common';
import { Gender, Prisma, User } from '@prisma/client';
import { dateOfBirthMatchesQid } from '@drivemarket/shared/domain-rules';
import type { CustomerProfileDto } from '../../../shared/src/types/customer-platform';
import { ActivityService } from '../common/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhone } from '../sms/sms.service';
import { composeName, mergeAddressJson, parseIsoDate, toCustomerProfileDto, type AddressPatch } from './customer-profile';
import { mergeNotificationPreferences, type NotificationPreferencesPatch } from './notification-preferences';

export type UpdateCustomerProfileInput = {
  first_name?: string | null;
  last_name?: string | null;
  gender?: Gender | null;
  date_of_birth?: string | null;
  nationality?: string | null;
  phone?: string | null;
  preferred_language?: 'en' | 'ar';
  notification_preferences?: NotificationPreferencesPatch;
  address?: AddressPatch;
};

function cleanOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  profile(user: User): CustomerProfileDto {
    return toCustomerProfileDto(user);
  }

  async updateProfile(user: User, input: UpdateCustomerProfileInput): Promise<CustomerProfileDto> {
    const data: Prisma.UserUpdateInput = {};
    const changed: string[] = [];

    if (input.first_name !== undefined) {
      data.firstName = cleanOrNull(input.first_name);
      changed.push('first_name');
    }
    if (input.last_name !== undefined) {
      data.lastName = cleanOrNull(input.last_name);
      changed.push('last_name');
    }
    if (input.gender !== undefined) {
      data.gender = input.gender ?? null;
      changed.push('gender');
    }
    if (input.date_of_birth !== undefined) {
      const raw = cleanOrNull(input.date_of_birth);
      if (!raw) {
        data.dateOfBirth = null;
      } else {
        const dob = parseIsoDate(raw);
        if (!dob || dob.getTime() > Date.now()) throw new BadRequestException('date_of_birth_invalid');
        // Same cross-check the apply flow runs: the QID encodes the birth year.
        if (user.qid && dateOfBirthMatchesQid(raw, user.qid) === false) {
          throw new BadRequestException('dob_qid_mismatch');
        }
        data.dateOfBirth = dob;
      }
      changed.push('date_of_birth');
    }
    if (input.nationality !== undefined) {
      data.nationality = cleanOrNull(input.nationality);
      changed.push('nationality');
    }
    if (input.phone !== undefined) {
      const raw = cleanOrNull(input.phone);
      if (!raw) {
        data.phone = null;
      } else {
        const normalized = normalizePhone(raw);
        if (!normalized) throw new BadRequestException('phone_invalid');
        data.phone = normalized;
      }
      changed.push('phone');
    }
    if (input.preferred_language !== undefined) {
      data.preferredLanguage = input.preferred_language;
      changed.push('preferred_language');
    }
    if (input.notification_preferences !== undefined) {
      data.notificationPreferences = mergeNotificationPreferences(
        user.notificationPreferences,
        input.notification_preferences,
      ) as Prisma.InputJsonValue;
      changed.push('notification_preferences');
    }
    if (input.address !== undefined) {
      data.address = mergeAddressJson(user.address, input.address) as Prisma.InputJsonValue;
      changed.push('address');
    }

    // Display name follows the structured name once both halves are known.
    if (input.first_name !== undefined || input.last_name !== undefined) {
      const first = input.first_name !== undefined ? cleanOrNull(input.first_name) : user.firstName;
      const last = input.last_name !== undefined ? cleanOrNull(input.last_name) : user.lastName;
      const name = composeName(first, last);
      if (name) {
        data.name = name;
        changed.push('name');
      }
    }

    if (!changed.length) return toCustomerProfileDto(user);

    const updated = await this.prisma.user.update({ where: { id: user.id }, data });
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'user',
      entityId: user.id,
      action: 'profile_updated',
      metadata: { fields: changed },
    });
    return toCustomerProfileDto(updated);
  }
}
