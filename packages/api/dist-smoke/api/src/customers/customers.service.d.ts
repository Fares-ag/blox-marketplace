import { Gender, User } from '@prisma/client';
import type { CustomerProfileDto } from '../../../shared/src/types/customer-platform';
import { ActivityService } from '../common/activity.service';
import { IdentityService } from '../common/identity.service';
import { PrismaService } from '../prisma/prisma.service';
import { type AddressPatch } from './customer-profile';
import { type NotificationPreferencesPatch } from './notification-preferences';
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
export declare class CustomersService {
    private readonly prisma;
    private readonly activity;
    private readonly identity;
    constructor(prisma: PrismaService, activity: ActivityService, identity: IdentityService);
    profile(user: User): CustomerProfileDto;
    updateProfile(user: User, input: UpdateCustomerProfileInput): Promise<CustomerProfileDto>;
}
