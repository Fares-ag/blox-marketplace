"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.snapshotForAudience = snapshotForAudience;
exports.toApplicationProductDto = toApplicationProductDto;
exports.toApplicationDocumentDto = toApplicationDocumentDto;
exports.toPaymentScheduleDto = toPaymentScheduleDto;
exports.daysToExpiry = daysToExpiry;
exports.toTakafulPolicyDto = toTakafulPolicyDto;
exports.identityAndConsentFields = identityAndConsentFields;
exports.toApplicationDto = toApplicationDto;
exports.toOpsApplicationDto = toOpsApplicationDto;
exports.toDealerApplicationDto = toDealerApplicationDto;
exports.mapApplicationDto = mapApplicationDto;
exports.toApplicationBlockingDto = toApplicationBlockingDto;
exports.toApplicationListItemDto = toApplicationListItemDto;
exports.toOpsApplicationQueueItemDto = toOpsApplicationQueueItemDto;
exports.toDealerApplicationListItemDto = toDealerApplicationListItemDto;
const domain_rules_1 = require("@drivemarket/shared/domain-rules");
const offer_response_dto_1 = require("../common/offer-response.dto");
const application_rules_1 = require("./application-rules");
function asNumber(value) {
    if (value == null)
        return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
function isoOrNull(value) {
    return value ? value.toISOString() : null;
}
function dateOnlyOrNull(value) {
    return value ? value.toISOString().slice(0, 10) : null;
}
function asSnapshot(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function snapshotForAudience(snapshot, audience) {
    if (audience === 'customer')
        return snapshot ?? null;
    const raw = asSnapshot(snapshot);
    if (!raw)
        return snapshot ?? null;
    const masked = (0, domain_rules_1.maskCustomerSnapshot)(raw) ?? {};
    if (audience === 'dealer' && typeof raw.phone === 'string') {
        return { ...masked, phone: raw.phone };
    }
    return masked;
}
function customerForAudience(customer, audience) {
    const phone = customer.phone ?? null;
    return {
        name: customer.name,
        email: customer.email,
        phone: audience === 'ops' && phone ? (0, domain_rules_1.maskPhone)(phone) : phone,
    };
}
function toApplicationProductDto(product) {
    return {
        id: product.id,
        slug: product.slug,
        make: product.make,
        model: product.model,
        trim: product.trim ?? null,
        model_year: product.modelYear,
        condition: product.condition ?? null,
        engine: product.engine ?? null,
        transmission: product.transmission ?? null,
        cylinders: product.cylinders ?? null,
        drivetrain: product.drivetrain ?? null,
        body_type: product.bodyType ?? null,
        color: product.color ?? null,
        mileage: product.mileage ?? null,
        description: product.description ?? null,
        price: asNumber(product.price),
        finance_eligible: product.financeEligible ?? null,
        warranty_months: product.warrantyMonths ?? null,
        warranty_notes: product.warrantyNotes ?? null,
        listing_status: product.listingStatus ?? null,
        company_id: product.companyId ?? null,
        published_at: product.publishedAt ?? null,
        default_offer_id: product.defaultOfferId ?? null,
    };
}
function toApplicationDocumentDto(doc) {
    return {
        id: doc.id,
        category: doc.category,
        mime_type: doc.mimeType ?? null,
        created_at: doc.createdAt,
        original_name: doc.originalName ?? null,
        kyc_document_type: doc.kycDocumentType ?? null,
        verification_status: doc.verificationStatus ?? null,
    };
}
function toPaymentScheduleDto(schedule) {
    return {
        id: schedule.id,
        sequence: schedule.sequence,
        due_date: schedule.dueDate,
        amount: asNumber(schedule.amount),
        paid_amount: asNumber(schedule.paidAmount),
        remaining_amount: asNumber(schedule.remainingAmount),
        status: schedule.status,
        paid_at: schedule.paidAt ?? null,
        pending_waive_reason: schedule.pendingWaiveReason ?? null,
        pending_waive_requested_by_id: schedule.pendingWaiveRequestedById ?? null,
    };
}
const DAY_MS = 86_400_000;
function utcDayStart(date) {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
function daysToExpiry(expiresAt, now = new Date()) {
    if (!expiresAt)
        return null;
    return Math.round((utcDayStart(expiresAt) - utcDayStart(now)) / DAY_MS);
}
function toTakafulPolicyDto(policy, now = new Date()) {
    const coverageType = policy.coverageType === 'comprehensive' || policy.coverageType === 'third_party'
        ? policy.coverageType
        : null;
    return {
        id: policy.id,
        application_id: policy.applicationId,
        provider: policy.provider ?? null,
        policy_number: policy.policyNumber ?? null,
        coverage_type: coverageType,
        coverage_amount: asNumber(policy.coverageAmount),
        premium_amount: asNumber(policy.premiumAmount),
        issued_at: dateOnlyOrNull(policy.issuedAt),
        effective_from: dateOnlyOrNull(policy.effectiveFrom),
        expires_at: dateOnlyOrNull(policy.expiresAt),
        days_to_expiry: daysToExpiry(policy.expiresAt, now),
        riders: Array.isArray(policy.riders) ? policy.riders.map((r) => String(r)) : [],
        status: policy.status,
        declaration_accepted_at: isoOrNull(policy.declarationAcceptedAt),
        declaration_version: policy.declarationVersion ?? null,
        has_document: !!policy.documentPath,
        verified_at: isoOrNull(policy.verifiedAt),
        created_at: policy.createdAt.toISOString(),
    };
}
function hasProductFields(product) {
    return !!product?.id && !!product.slug && !!product.make && !!product.model && product.modelYear != null;
}
function hasOfferFields(offer) {
    return !!offer?.id && !!offer.name && offer.annualRentRate != null;
}
function hasDocumentFields(doc) {
    return !!doc?.id && !!doc.category && !!doc.createdAt;
}
function hasScheduleFields(schedule) {
    return (!!schedule?.id &&
        schedule.sequence != null &&
        !!schedule.dueDate &&
        schedule.amount != null &&
        schedule.paidAmount != null &&
        schedule.remainingAmount != null &&
        !!schedule.status);
}
function identityAndConsentFields(app) {
    return {
        identity_hold_reason: app.identityHoldReason ?? null,
        identity_hold_at: app.identityHoldAt ?? null,
        identity_hold_cleared_at: app.identityHoldClearedAt ?? null,
        identity_hold_cleared_by_name: app.identityHoldClearedByName ?? null,
        consents_completed_at: app.consentsCompletedAt ?? null,
    };
}
function baseApplicationFields(app, audience) {
    const dto = {
        id: app.id,
        customer_user_id: app.customerUserId,
        customer_email: app.customerEmail,
        customer_snapshot: snapshotForAudience(app.customerSnapshot, audience),
        product_id: app.productId,
        company_id: app.companyId,
        offer_id: app.offerId,
        finance_partner_id: app.financePartnerId ?? null,
        pricing_snapshot: app.pricingSnapshot,
        ...(app.installmentPlan != null ? { installment_plan: app.installmentPlan } : {}),
        status: app.status,
        contract_generated: app.contractGenerated,
        resubmission_comment: app.resubmissionComment ?? null,
        submitted_at: app.submittedAt ?? null,
        activated_at: app.activatedAt ?? null,
        completed_at: app.completedAt ?? null,
        created_at: app.createdAt,
        updated_at: app.updatedAt,
        ...identityAndConsentFields(app),
    };
    if (audience === 'ops' || audience === 'dealer') {
        dto.rejection_reason = app.rejectionReason ?? null;
        dto.branch_id = app.branchId ?? null;
        dto.rule_flags = (0, application_rules_1.ruleFlagsOf)(app.pricingSnapshot);
    }
    if (audience === 'ops') {
        dto.status_reason = app.statusReason ?? null;
        dto.finance_partner_branch_id = app.financePartnerBranchId ?? null;
    }
    return dto;
}
function applicationRelations(app, audience) {
    return {
        ...(hasProductFields(app.product) ? { product: toApplicationProductDto(app.product) } : {}),
        ...(app.documents
            ? {
                documents: app.documents
                    .filter(hasDocumentFields)
                    .map((doc) => toApplicationDocumentDto(doc)),
            }
            : {}),
        ...(app.company?.id && app.company?.name
            ? { company: { id: app.company.id, name: app.company.name } }
            : {}),
        ...(app.customer ? { customer: customerForAudience(app.customer, audience) } : {}),
        ...(hasOfferFields(app.offer) ? { offer: (0, offer_response_dto_1.toPublicOfferDto)(app.offer) } : {}),
        ...(app.paymentSchedules
            ? {
                payment_schedules: app.paymentSchedules
                    .filter(hasScheduleFields)
                    .map((schedule) => toPaymentScheduleDto(schedule)),
            }
            : {}),
        ...(app.takafulPolicies
            ? { takaful_policies: app.takafulPolicies.map((policy) => toTakafulPolicyDto(policy)) }
            : {}),
        financing_source: app.financePartner?.crmAdapter === 'zoho' ? 'partner' : 'blox',
        finance_partner_name: app.financePartner?.name ?? null,
        branch_name: app.branch?.name ?? null,
    };
}
function toApplicationDto(app) {
    return {
        ...baseApplicationFields(app, 'customer'),
        ...applicationRelations(app, 'customer'),
    };
}
function toOpsApplicationDto(app) {
    return {
        ...baseApplicationFields(app, 'ops'),
        ...applicationRelations(app, 'ops'),
    };
}
function toDealerApplicationDto(app) {
    return {
        ...baseApplicationFields(app, 'dealer'),
        ...applicationRelations(app, 'dealer'),
    };
}
function mapApplicationDto(app, audience) {
    if (audience === 'ops')
        return toOpsApplicationDto(app);
    if (audience === 'dealer')
        return toDealerApplicationDto(app);
    return toApplicationDto(app);
}
function toApplicationBlockingDto(result) {
    return {
        blocking: result.blocking,
        application_id: result.applicationId,
        status: result.status ?? null,
        draft_application_id: result.draftApplicationId ?? null,
    };
}
function toApplicationListItemDto(app) {
    return {
        id: app.id,
        status: app.status,
        created_at: app.createdAt,
        submitted_at: app.submittedAt ?? null,
        activated_at: app.activatedAt ?? null,
        contract_generated: app.contractGenerated ?? false,
        resubmission_comment: app.resubmissionComment ?? null,
        pricing_snapshot: app.pricingSnapshot ?? null,
        ...identityAndConsentFields(app),
        ...(app.product
            ? {
                product: {
                    make: app.product.make,
                    model: app.product.model,
                    model_year: app.product.modelYear,
                    slug: app.product.slug,
                    price: asNumber(app.product.price),
                },
            }
            : {}),
    };
}
function toOpsApplicationQueueItemDto(app) {
    const pricing = app.pricingSnapshot ?? {};
    const plan = app.installmentPlan;
    const sellingPrice = Number(pricing.selling_price ?? pricing.list_price ?? app.product?.price ?? 0);
    const monthly = Number(plan?.monthlyAmount ?? pricing.monthly ?? 0);
    return {
        id: app.id,
        status: app.status,
        created_at: app.createdAt,
        submitted_at: app.submittedAt ?? null,
        customer_snapshot: snapshotForAudience(app.customerSnapshot, 'ops'),
        pricing_snapshot: app.pricingSnapshot ?? null,
        installment_plan: app.installmentPlan ?? null,
        rule_flags: (0, application_rules_1.ruleFlagsOf)(app.pricingSnapshot),
        ...identityAndConsentFields(app),
        deal_summary: {
            selling_price: sellingPrice,
            monthly,
            rate: Number(pricing.rate ?? plan?.annualRentalRate ?? 0),
        },
        payment_health: derivePaymentHealth(app.status, app.paymentSchedules ?? []),
        risk_level: deriveRiskLevel(app.status, app.paymentSchedules ?? []),
        ...(app.product
            ? {
                product: {
                    make: app.product.make,
                    model: app.product.model,
                    model_year: app.product.modelYear,
                    slug: app.product.slug,
                    price: app.product.price != null ? asNumber(app.product.price) : null,
                },
            }
            : {}),
        ...(app.company ? { company: { name: app.company.name } } : {}),
        ...(app.customer
            ? { customer: { name: app.customer.name, email: app.customer.email } }
            : {}),
        ...(app.agent
            ? { agent: { id: app.agent.id, name: app.agent.name, email: app.agent.email } }
            : { agent: null }),
        financing_source: app.financePartner?.crmAdapter === 'zoho' ? 'partner' : 'blox',
        finance_partner_id: app.financePartnerId ?? app.financePartner?.id ?? null,
        finance_partner_name: app.financePartner?.name ?? null,
        branch_id: app.branchId ?? app.branch?.id ?? null,
        branch_name: app.branch?.name ?? null,
    };
}
function derivePaymentHealth(status, schedules) {
    if (schedules.length === 0)
        return 'none';
    if (schedules.every((s) => s.status === 'paid'))
        return 'paid';
    if (schedules.some((s) => s.status === 'overdue'))
        return 'overdue';
    return 'on_track';
}
function deriveRiskLevel(status, schedules) {
    if (status === 'rejected' || status === 'submission_cancelled')
        return 'high';
    const overdue = schedules.filter((s) => s.status === 'overdue').length;
    if (overdue >= 2)
        return 'high';
    if (overdue === 1 || status === 'resubmission_required')
        return 'medium';
    return 'low';
}
function toDealerApplicationListItemDto(app) {
    return {
        id: app.id,
        status: app.status,
        created_at: app.createdAt,
        customer_snapshot: snapshotForAudience(app.customerSnapshot, 'dealer'),
        rule_flags: (0, application_rules_1.ruleFlagsOf)(app.pricingSnapshot),
        ...identityAndConsentFields(app),
        ...(app.product
            ? {
                product: {
                    make: app.product.make,
                    model: app.product.model,
                    model_year: app.product.modelYear,
                    slug: app.product.slug,
                },
            }
            : {}),
        ...(app.customer
            ? {
                customer: {
                    name: app.customer.name,
                    email: app.customer.email,
                    phone: app.customer.phone ?? null,
                },
            }
            : {}),
        ...(app.agent
            ? { agent: { id: app.agent.id, name: app.agent.name, email: app.agent.email } }
            : { agent: null }),
        finance_partner_id: app.financePartnerId ?? app.financePartner?.id ?? null,
        finance_partner_name: app.financePartner?.name ?? null,
        branch_id: app.branchId ?? app.branch?.id ?? null,
        branch_name: app.branch?.name ?? null,
    };
}
//# sourceMappingURL=application-response.dto.js.map