"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomersService = void 0;
const common_1 = require("@nestjs/common");
const domain_rules_1 = require("@drivemarket/shared/domain-rules");
const activity_service_1 = require("../common/activity.service");
const identity_service_1 = require("../common/identity.service");
const prisma_service_1 = require("../prisma/prisma.service");
const sms_service_1 = require("../sms/sms.service");
const customer_profile_1 = require("./customer-profile");
const notification_preferences_1 = require("./notification-preferences");
function cleanOrNull(value) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}
let CustomersService = class CustomersService {
    prisma;
    activity;
    identity;
    constructor(prisma, activity, identity) {
        this.prisma = prisma;
        this.activity = activity;
        this.identity = identity;
    }
    profile(user) {
        return (0, customer_profile_1.toCustomerProfileDto)(user, this.identity.readQid(user));
    }
    async updateProfile(user, input) {
        const data = {};
        const changed = [];
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
            }
            else {
                const dob = (0, customer_profile_1.parseIsoDate)(raw);
                if (!dob || dob.getTime() > Date.now())
                    throw new common_1.BadRequestException('date_of_birth_invalid');
                const qid = this.identity.readQid(user);
                if (qid && (0, domain_rules_1.dateOfBirthMatchesQid)(raw, qid) === false) {
                    throw new common_1.BadRequestException('dob_qid_mismatch');
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
            }
            else {
                const normalized = (0, sms_service_1.normalizePhone)(raw);
                if (!normalized)
                    throw new common_1.BadRequestException('phone_invalid');
                data.phone = normalized;
            }
            changed.push('phone');
        }
        if (input.preferred_language !== undefined) {
            data.preferredLanguage = input.preferred_language;
            changed.push('preferred_language');
        }
        if (input.notification_preferences !== undefined) {
            data.notificationPreferences = (0, notification_preferences_1.mergeNotificationPreferences)(user.notificationPreferences, input.notification_preferences);
            changed.push('notification_preferences');
        }
        if (input.address !== undefined) {
            data.address = (0, customer_profile_1.mergeAddressJson)(user.address, input.address);
            changed.push('address');
        }
        if (input.first_name !== undefined || input.last_name !== undefined) {
            const first = input.first_name !== undefined ? cleanOrNull(input.first_name) : user.firstName;
            const last = input.last_name !== undefined ? cleanOrNull(input.last_name) : user.lastName;
            const name = (0, customer_profile_1.composeName)(first, last);
            if (name) {
                data.name = name;
                changed.push('name');
            }
        }
        if (!changed.length)
            return (0, customer_profile_1.toCustomerProfileDto)(user, this.identity.readQid(user));
        const updated = await this.prisma.user.update({ where: { id: user.id }, data });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'user',
            entityId: user.id,
            action: 'profile_updated',
            metadata: { fields: changed },
        });
        return (0, customer_profile_1.toCustomerProfileDto)(updated, this.identity.readQid(updated));
    }
};
exports.CustomersService = CustomersService;
exports.CustomersService = CustomersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_service_1.ActivityService,
        identity_service_1.IdentityService])
], CustomersService);
//# sourceMappingURL=customers.service.js.map