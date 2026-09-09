import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { apiFetch } from '../lib/api';
import { buildPricingSnapshot } from '../lib/pricing';
import { assessAffordability } from '../lib/affordability';
import {
  allowedTenureOptions,
  downPaymentBounds,
  employerCategoryFromEmploymentType,
  minDownPaymentPctFor,
  type ProductRuleViolation,
} from '../lib/product-rules';
import { useAuthStore } from '../auth/auth-store';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { OpsPageHeader, OpsStatusPill } from '../components/ops-ui';
import { StatusBadge } from '../ops-ui-v2';
import {
  Alert,
  MultiStepForm,
  OpsContentCard,
  OpsNumberField,
  clearMultiStepDraft,
  OpsFormGrid,
  OpsFormSection,
  OpsSelect,
  type StepConfig,
  type StepProps,
} from '../ops-ui-v2';
import type { PaginatedResponse, PublicOffer, DealerInventoryItem } from '../types/domain';
import type { OpsAgent, OpsAudience } from './types';
import { VehicleSelectionCards, type VehicleCardOption } from './VehicleSelectionCards';
import { WizardAgentInvite } from './WizardAgentInvite';
import { CustomerInfoForm } from './CustomerInfoForm';
import { InstallmentPlanStep } from './InstallmentPlanStep';
import { WizardReviewStep } from './WizardReviewStep';
import { submitGateMessage, apiErrorCodeOf } from './submit-gate';
import {
  isListingSelectableForFinancing,
  listingFinancingBlock,
  willReserveListingOnSubmit,
  type ListingFinancingBlock,
} from './vehicle-availability';
import type { InstallmentPlan } from '../types/installment-plan';
import {
  DOCUMENT_SLOT_GROUP_LABEL_KEYS,
  KYC_UPLOAD_ACCEPT,
  applicantAgeBandWarning,
  buildCustomerSnapshot,
  emptyCustomerInfo,
  groupDocumentSlots,
  kycUploadRejection,
  residencyForInfo,
  ruleViolationMessage,
  validateCustomerInfo,
  validateRequiredWizardDocuments,
  wizardDocumentSlots,
  wizardRuleViolations,
  type CustomerInfoFormValue,
} from './customer-info';

type VehicleOption = {
  id: string;
  make: string;
  model: string;
  model_year?: number;
  price: number;
  condition?: string | null;
  listing_status?: string;
  company_id?: string;
  company_name?: string;
  primary_image?: string | null;
  images?: Array<{ storage_path?: string | null }>;
  vin?: string | null;
  chassis_number?: string | null;
  engine_number?: string | null;
  identity_complete?: boolean;
};

type CompanyOption = { id: string; name: string };

type WizardData = {
  customerInfo: CustomerInfoFormValue;
  companyId: string;
  productIds: string[];
  agentUserId: string;
  listPrice: number;
  sellingPrice: number;
  hideInterest: boolean;
  submitOnCreate: boolean;
  offerId: string;
  tenure: number;
  downPct: number;
  files: Partial<Record<string, File>>;
  installmentPlan: InstallmentPlan | null;
  planPricingSnapshot: Record<string, unknown> | null;
};

function identityComplete(v: VehicleOption): boolean | undefined {
  if (typeof v.identity_complete === 'boolean') return v.identity_complete;
  if (v.vin === undefined && v.chassis_number === undefined && v.engine_number === undefined) return undefined;
  return !!(v.vin?.trim() && v.chassis_number?.trim() && v.engine_number?.trim());
}

function vehicleAvailabilityMessage(
  block: ListingFinancingBlock | null,
  t: (key: string, opts?: { defaultValue?: string }) => string,
): string | null {
  if (!block) return null;
  if (block.code === 'vehicle_unavailable') return t('dealerOps.vehicleAvailability.reserved');
  if (block.status === 'draft') return t('dealerOps.vehicleAvailability.notPublished');
  return t('dealerOps.vehicleAvailability.unavailable');
}

function validateSelectedVehicles(
  data: WizardData,
  vehicleItems: VehicleCardOption[],
  isAdmin: boolean,
  t: (key: string, opts?: { defaultValue?: string }) => string,
): string | null {
  if (!data.productIds.length) return t('ops.wizard.selectVehicle');
  const willReserve = willReserveListingOnSubmit(isAdmin, data.submitOnCreate);
  for (const id of data.productIds) {
    const vehicle = vehicleItems.find((v) => v.id === id);
    const message = vehicleAvailabilityMessage(
      listingFinancingBlock(vehicle?.listing_status, willReserve),
      t,
    );
    if (message) return message;
  }
  return null;
}

async function refreshSelectedListingStatuses(
  productIds: string[],
  isAdmin: boolean,
): Promise<Map<string, string>> {
  const statuses = new Map<string, string>();
  for (const id of productIds) {
    if (isAdmin) {
      const row = await apiFetch<{ listing_status?: string }>(`/api/ops/products/${id}`);
      statuses.set(id, String(row.listing_status ?? 'unknown'));
    } else {
      const row = await apiFetch<DealerInventoryItem>(`/api/dealer/inventory/${id}`);
      statuses.set(id, String(row.listing_status ?? 'unknown'));
    }
  }
  return statuses;
}

function filterVehicleItems(items: VehicleOption[], isAdmin: boolean, companyId: string): VehicleCardOption[] {
  const filtered = isAdmin && companyId
    ? items.filter((v) => !v.company_id || v.company_id === companyId)
    : items.filter((v) => v.listing_status !== 'sold' && v.listing_status !== 'archived');
  return filtered.map((v) => ({
    id: v.id,
    make: v.make,
    model: v.model,
    model_year: v.model_year,
    price: v.price,
    condition: v.condition ?? null,
    listing_status: v.listing_status,
    company_id: v.company_id,
    company_name: v.company_name,
    primary_image: v.primary_image ?? v.images?.[0]?.storage_path ?? null,
    identity_complete: identityComplete(v),
  }));
}

function offerTenureOptions(offer: PublicOffer | undefined): number[] | null {
  if (!offer || !Array.isArray(offer.tenure_options)) return null;
  const options = (offer.tenure_options as unknown[]).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  return options.length ? options : null;
}

function DealSetupFields({
  data,
  updateData,
  agentCompanyId,
  audience,
  t,
}: {
  data: WizardData;
  updateData: (patch: Partial<WizardData>) => void;
  agentCompanyId: string;
  audience: OpsAudience;
  t: (key: string) => string;
}) {
  const agents = useQuery({
    queryKey: ['wizard-agents', agentCompanyId],
    queryFn: () => apiFetch<{ items: OpsAgent[] }>(`/api/companies/${agentCompanyId}/agents`),
    enabled: !!agentCompanyId,
  });

  return (
    <OpsFormSection title={t('ops.wizard.step.deal')}>
      <OpsFormGrid>
        <OpsSelect
          label={t('ops.credit.agent')}
          value={data.agentUserId}
          onChange={(e) => updateData({ agentUserId: e.target.value })}
          required
          fullWidth
        >
          <option value="">{t('ops.wizard.selectAgent')}</option>
          {(agents.data?.items ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.name ?? a.email}</option>
          ))}
        </OpsSelect>
        <OpsNumberField
          label={t('ops.wizard.listPrice')}
          required
          min={0}
          value={data.listPrice}
          onValueChange={(listPrice) => updateData({ listPrice })}
        />
        <OpsNumberField
          label={t('ops.wizard.sellingPrice')}
          required
          min={0}
          value={data.sellingPrice}
          onValueChange={(sellingPrice) => updateData({ sellingPrice })}
        />
        <label className="blox-checkbox-row blox-form-grid__full">
          <input
            type="checkbox"
            checked={data.hideInterest}
            onChange={(e) => updateData({ hideInterest: e.target.checked })}
          />
          <span>{t('ops.wizard.hideInterest')}</span>
        </label>
      </OpsFormGrid>
      {audience === 'dealer' && <WizardAgentInvite />}
    </OpsFormSection>
  );
}

/**
 * Where the in-progress application is parked between renders. Session-scoped,
 * so a reload, a mis-click into another page, or a re-login lands back on the
 * same step with the same answers instead of an empty form.
 */
const DRAFT_STORAGE_KEY = 'blox.ops.application-wizard.draft';

/** Chosen files cannot be serialised, so they are re-picked after a restore. */
const DRAFT_OMIT_KEYS = ['files'];

export function AddApplicationWizard({
  audience,
  detailBase,
}: {
  audience: OpsAudience;
  detailBase: string;
}) {
  const { t } = useOpsLabels();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = audience === 'admin' || audience === 'super_admin';
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const createIdempotencyKey = useRef(`ops-app-${crypto.randomUUID()}`);

  const initialData: WizardData = useMemo(
    () => ({
      customerInfo: emptyCustomerInfo(),
      companyId: user?.company_id ?? '',
      productIds: [],
      agentUserId: user?.role === 'dealer_agent' ? user.id : '',
      listPrice: 0,
      sellingPrice: 0,
      hideInterest: false,
      submitOnCreate: false,
      offerId: '',
      tenure: 36,
      downPct: 20,
      files: {},
      installmentPlan: null,
      planPricingSnapshot: null,
    }),
    [user?.company_id, user?.id, user?.role],
  );

  const vehiclesPath = isAdmin
    ? `/api/ops/products?limit=100&offset=0`
    : `/api/dealer/inventory?limit=100&offset=0`;

  const vehicles = useQuery({
    queryKey: ['wizard-vehicles', audience],
    queryFn: () => apiFetch<PaginatedResponse<VehicleOption>>(vehiclesPath),
  });

  const offers = useQuery({
    queryKey: ['wizard-offers'],
    queryFn: () => apiFetch<PaginatedResponse<PublicOffer>>('/api/offers?limit=50&offset=0'),
  });

  const companies = useQuery({
    queryKey: ['wizard-companies'],
    queryFn: () => apiFetch<PaginatedResponse<CompanyOption>>('/api/companies/all?limit=100&offset=0'),
    enabled: isAdmin,
  });

  const toggleProduct = useCallback(
    (data: WizardData, id: string, vehicleItems: VehicleOption[]) => {
      const row = vehicleItems.find((v) => v.id === id);
      if (data.customerInfo.applicantType === 'individual') {
        const patch: Partial<WizardData> = { productIds: [id] };
        if (row) {
          patch.listPrice = Number(row.price);
          patch.sellingPrice = Number(row.price);
          if (isAdmin && row.company_id) patch.companyId = row.company_id;
        }
        return patch;
      }
      const nextIds = data.productIds.includes(id)
        ? data.productIds.filter((x) => x !== id)
        : [...data.productIds, id];
      const first = vehicleItems.find((v) => v.id === nextIds[0]);
      const patch: Partial<WizardData> = { productIds: nextIds };
      if (first) {
        patch.listPrice = Number(first.price);
        patch.sellingPrice = Number(first.price);
      }
      return patch;
    },
    [isAdmin],
  );

  /** Everything the plan, review and submit steps need to judge the deal against the product rules. */
  const planContext = useCallback(
    (data: WizardData) => {
      const vehicleItems = filterVehicleItems(vehicles.data?.items ?? [], isAdmin, data.companyId);
      const selectedVehicles = vehicleItems.filter((v) => data.productIds.includes(v.id));
      const primaryVehicle = selectedVehicles[0];
      const offer = (offers.data?.items ?? []).find((o) => o.id === data.offerId);
      const tenureOptions = offerTenureOptions(offer);
      const condition = primaryVehicle?.condition === 'used' ? 'used' : 'new';
      const minDown = minDownPaymentPctFor(condition, offer?.min_down_payment_pct ?? null);
      const rate = Number(offer?.annual_rent_rate ?? 0);
      const priceForPlan = data.sellingPrice || data.listPrice || Number(primaryVehicle?.price ?? 0);
      const violations: ProductRuleViolation[] = offer
        ? wizardRuleViolations({
            info: data.customerInfo,
            vehicle: { price: priceForPlan, condition: primaryVehicle?.condition, modelYear: primaryVehicle?.model_year },
            tenureMonths: data.tenure,
            downPaymentPct: data.downPct,
            offerTenureOptions: tenureOptions,
            offerMinDownPaymentPct: offer?.min_down_payment_pct ?? null,
          })
        : [];
      return {
        vehicleItems,
        selectedVehicles,
        primaryVehicle,
        offer,
        tenureOptions,
        minDown,
        rate,
        priceForPlan,
        violations,
        hard: violations.filter((v) => v.severity === 'hard'),
        soft: violations.filter((v) => v.severity === 'soft'),
      };
    },
    [vehicles.data, offers.data, isAdmin],
  );

  const steps: StepConfig<WizardData>[] = [
    {
      label: t('ops.wizard.step.customer'),
      validate: (data) => validateCustomerInfo(data.customerInfo ?? emptyCustomerInfo(), t),
      component: ({ data, updateData }: StepProps<WizardData>) => (
        <CustomerInfoForm
          value={data.customerInfo ?? emptyCustomerInfo()}
          onChange={(customerInfo) => updateData({ customerInfo })}
        />
      ),
    },
    {
      label: t('ops.wizard.step.vehicle'),
      validate: (data) => validateSelectedVehicles(data, filterVehicleItems(vehicles.data?.items ?? [], isAdmin, data.companyId), isAdmin, t),
      component: ({ data, updateData }: StepProps<WizardData>) => {
        const items = filterVehicleItems(vehicles.data?.items ?? [], isAdmin, data.companyId);
        const willReserve = willReserveListingOnSubmit(isAdmin, data.submitOnCreate);
        const vehicleSelectionError = validateSelectedVehicles(data, items, isAdmin, t);
        return (
          <>
            {isAdmin && (
              <OpsFormSection title={t('ops.col.dealer')}>
                <OpsSelect
                  label={t('ops.col.dealer')}
                  value={data.companyId}
                  onChange={(e) => updateData({ companyId: e.target.value, productIds: [] })}
                  fullWidth
                >
                  <option value="">{t('ops.wizard.anyDealer')}</option>
                  {(companies.data?.items ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </OpsSelect>
              </OpsFormSection>
            )}
            <VehicleSelectionCards
              items={items}
              selectedIds={data.productIds}
              onToggle={(id) => updateData(toggleProduct(data, id, items))}
              multiple={data.customerInfo.applicantType === 'corporate'}
              loading={vehicles.isLoading}
              isSelectable={(item) => isListingSelectableForFinancing(item.listing_status, willReserve)}
              statusFor={(item) => {
                const block = listingFinancingBlock(item.listing_status, willReserve);
                return (
                  <>
                    {item.listing_status && item.listing_status !== 'published' && (
                      <StatusBadge
                        status={item.listing_status}
                        type="listing"
                        label={t(`ops.listingStatus.${item.listing_status}`, {
                          defaultValue: item.listing_status.replace(/_/g, ' '),
                        })}
                      />
                    )}
                    {block && (
                      <OpsStatusPill label={t('dealerOps.vehicleAvailability.unavailable')} variant="warning" />
                    )}
                  </>
                );
              }}
            />
            {vehicleSelectionError && data.productIds.length > 0 && (
              <Alert variant="warning" title={t('dealerOps.vehicleAvailability.unavailable')}>
                {vehicleSelectionError}
              </Alert>
            )}
          </>
        );
      },
    },
    {
      label: t('ops.wizard.step.deal'),
      component: ({ data, updateData }: StepProps<WizardData>) => (
        <DealSetupFields
          data={data}
          updateData={updateData}
          agentCompanyId={isAdmin ? data.companyId : user?.company_id ?? ''}
          audience={audience}
          t={t}
        />
      ),
    },
    {
      label: t('ops.wizard.step.offer'),
      component: ({ data, updateData }: StepProps<WizardData>) => (
        <OpsFormSection title={t('ops.credit.offer')}>
          <OpsSelect
            label={t('ops.credit.offer')}
            value={data.offerId}
            onChange={(e) => {
              const next = (offers.data?.items ?? []).find((o) => o.id === e.target.value);
              const { primaryVehicle } = planContext(data);
              const condition = primaryVehicle?.condition === 'used' ? 'used' : 'new';
              const allowed = allowedTenureOptions(residencyForInfo(data.customerInfo), offerTenureOptions(next));
              updateData({
                offerId: e.target.value,
                tenure: allowed.includes(36) ? 36 : allowed[0] ?? 36,
                downPct: minDownPaymentPctFor(condition, next?.min_down_payment_pct ?? null),
              });
            }}
            required
            fullWidth
          >
            <option value="">{t('ops.wizard.selectOffer')}</option>
            {(offers.data?.items ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} · {o.annual_rent_rate}% · {o.crm_adapter === 'zoho' ? t('ops.common.partnerFinance') : t('ops.common.bloxFinance')}
              </option>
            ))}
          </OpsSelect>
        </OpsFormSection>
      ),
    },
    {
      label: t('ops.wizard.step.plan'),
      validate: (data) => (planContext(data).hard.length ? t('dealerOps.validation.rulesBlocking') : null),
      component: ({ data, updateData }: StepProps<WizardData>) => {
        const ctx = planContext(data);
        const preview = ctx.offer
          ? buildPricingSnapshot({
              listPrice: ctx.priceForPlan,
              annualRatePercent: ctx.rate,
              minDownPaymentPct: ctx.minDown,
              tenureMonths: data.tenure,
              downPaymentPct: data.downPct,
            })
          : null;

        if (!preview) return null;

        const residency = residencyForInfo(data.customerInfo);
        const tenureOptions = allowedTenureOptions(residency, ctx.tenureOptions);
        const income = data.customerInfo.monthlyIncome;
        const affordability =
          income > 0 && residency
            ? assessAffordability({
                monthlyIncome: income,
                monthlyLiabilities: data.customerInfo.monthlyLiabilities,
                proposedInstallment: preview.monthly,
                residency,
                employerCategory: employerCategoryFromEmploymentType(data.customerInfo.employment.employmentType),
                financedAmount: ctx.priceForPlan - preview.down_payment,
              })
            : null;
        const ageWarning = applicantAgeBandWarning(data.customerInfo, data.tenure, t);
        const dbrVariant =
          affordability?.status === 'within_cap' ? 'success' : affordability?.status === 'above_hard_cap' ? 'error' : 'warning';
        const dbrStatusText = !affordability
          ? null
          : affordability.status === 'within_cap'
            ? t('dealerOps.plan.dbrWithin')
            : affordability.status === 'above_hard_cap'
              ? t('dealerOps.plan.dbrDeclined', { cap: Math.round(affordability.hardCap * 100) })
              : t('dealerOps.plan.dbrException', { tier: affordability.exceptionTier });

        return (
          <OpsFormSection title={t('ops.wizard.step.plan')}>
            <OpsSelect
              label={t('ops.credit.tenure')}
              value={data.tenure}
              onChange={(e) => updateData({ tenure: Number(e.target.value) })}
            >
              {!tenureOptions.includes(data.tenure) && (
                <option value={data.tenure}>{t('ops.common.months', { count: data.tenure })}</option>
              )}
              {tenureOptions.map((months) => (
                <option key={months} value={months}>
                  {t('ops.common.months', { count: months })}
                </option>
              ))}
            </OpsSelect>
            <OpsNumberField
              label={t('ops.wizard.downPaymentPct')}
              min={downPaymentBounds().min}
              max={downPaymentBounds().max}
              emptyValue={ctx.minDown}
              value={data.downPct}
              onValueChange={(downPct) => updateData({ downPct })}
              hint={t('applyFlow.rule.down_payment_below_recommended', { min: ctx.minDown, condition: ctx.primaryVehicle?.condition ?? 'new' })}
            />
            <InstallmentPlanStep
              vehiclePrice={ctx.priceForPlan}
              offerRate={ctx.rate}
              minDownPct={ctx.minDown}
              tenureMonths={data.tenure}
              downPaymentPct={data.downPct}
              hideInterest={data.hideInterest}
              onChange={(plan, snap) => updateData({ installmentPlan: plan, planPricingSnapshot: snap })}
            />
            <div className="blox-form-grid__full blox-stack">
              <h3 className="blox-panel__subtitle">{t('dealerOps.plan.rulesTitle')}</h3>
              {ctx.hard.map((v) => (
                <Alert key={v.code} variant="error" title={t('dealerOps.plan.rulesBlock')}>
                  {ruleViolationMessage(v, t)}
                </Alert>
              ))}
              {ctx.soft.map((v) => (
                <Alert key={v.code} variant="warning" title={t('dealerOps.plan.rulesWarn')}>
                  {ruleViolationMessage(v, t)}
                </Alert>
              ))}
              {ctx.violations.length === 0 && <p className="blox-form-success">{t('dealerOps.plan.rulesOk')}</p>}
              {ageWarning && <Alert variant="warning">{ageWarning}</Alert>}
              {affordability ? (
                <Alert variant={dbrVariant}>
                  {t('dealerOps.plan.dbr', {
                    dbr: Number.isFinite(affordability.dbr) ? Math.round(affordability.dbr * 100) : '∞',
                    cap: Math.round(affordability.cap * 100),
                  })}
                  {dbrStatusText ? ` — ${dbrStatusText}` : ''}
                </Alert>
              ) : (
                <p className="blox-field__hint">{t('dealerOps.plan.dbrUnknown')}</p>
              )}
            </div>
          </OpsFormSection>
        );
      },
    },
    {
      label: t('ops.wizard.step.documents'),
      validate: (data) =>
        validateRequiredWizardDocuments(data.files, data.customerInfo ?? emptyCustomerInfo(), t),
      component: ({ data, updateData }: StepProps<WizardData>) => {
        const groups = groupDocumentSlots(wizardDocumentSlots(data.customerInfo));
        return (
          <>
            <p className="blox-muted">{t('dealerOps.intake.docsIntro')}</p>
            {groups.map((group) => (
              <div key={group.group} className="blox-form-block">
                <h3 className="blox-panel__subtitle">{t(DOCUMENT_SLOT_GROUP_LABEL_KEYS[group.group])}</h3>
                {group.slots.map((slot) => {
                  const hint = t(`${slot.labelKey}Hint`, { defaultValue: '' });
                  const freshness = slot.maxAgeDays ? t('applyFlow.docs.freshness', { days: slot.maxAgeDays }) : '';
                  const file = data.files[slot.category];
                  return (
                    <label key={slot.category} className="blox-upload-dropzone">
                      <input
                        type="file"
                        accept={KYC_UPLOAD_ACCEPT}
                        hidden
                        onChange={(e) => {
                          const picked = e.target.files?.[0];
                          e.target.value = '';
                          if (!picked) return;
                          // Rejected at selection rather than at submit: the wizard
                          // uploads these only after the application has been
                          // created, so an unsupported file otherwise fails once the
                          // record already exists and the documents are missing.
                          const rejection = kycUploadRejection(picked);
                          if (rejection) {
                            setError(rejection);
                            toast.error(rejection);
                            return;
                          }
                          updateData({ files: { ...data.files, [slot.category]: picked } });
                        }}
                      />
                      <p className="blox-upload-dropzone__title">
                        {t(slot.labelKey, { defaultValue: slot.category.replace(/_/g, ' ') })}{' '}
                        <OpsStatusPill
                          label={slot.required ? t('dealerOps.intake.slotRequired') : t('dealerOps.intake.slotOptional')}
                          variant={slot.required ? 'ink' : 'outline'}
                        />
                      </p>
                      {(hint || freshness) && (
                        <p className="blox-upload-dropzone__hint">
                          {hint}
                          {hint && freshness ? ' · ' : ''}
                          {freshness}
                        </p>
                      )}
                      {file ? (
                        <p className="blox-upload-dropzone__hint">
                          {file.name} · {t('dealerOps.intake.replaceFile')}
                        </p>
                      ) : slot.required ? (
                        <p className="blox-upload-dropzone__hint blox-upload-dropzone__hint--required">
                          {t('dealerOps.intake.slotMissing')} · {t('dealerOps.intake.chooseFile')}
                        </p>
                      ) : (
                        <p className="blox-upload-dropzone__hint">{t('dealerOps.intake.chooseFile')}</p>
                      )}
                    </label>
                  );
                })}
              </div>
            ))}
          </>
        );
      },
    },
    {
      label: t('ops.wizard.step.review'),
      validate: (data) => {
        const customerError = validateCustomerInfo(data.customerInfo ?? emptyCustomerInfo(), t);
        if (customerError) return customerError;
        const docsError = validateRequiredWizardDocuments(data.files, data.customerInfo ?? emptyCustomerInfo(), t);
        if (docsError) return docsError;
        const vehicleError = validateSelectedVehicles(
          data,
          filterVehicleItems(vehicles.data?.items ?? [], isAdmin, data.companyId),
          isAdmin,
          t,
        );
        if (vehicleError) return vehicleError;
        if (!data.offerId) return t('ops.wizard.selectOffer');
        if (planContext(data).hard.length) return t('dealerOps.validation.rulesBlocking');
        if (!data.planPricingSnapshot || !data.installmentPlan) return t('ops.wizard.completePlan');
        return null;
      },
      component: ({ data, updateData }: StepProps<WizardData>) => {
        const ctx = planContext(data);
        const companyName = (companies.data?.items ?? []).find((c) => c.id === data.companyId)?.name;

        return (
          <WizardReviewStep
            data={data}
            selectedVehicles={ctx.selectedVehicles}
            offer={ctx.offer}
            companyName={isAdmin ? companyName : undefined}
            agentCompanyId={isAdmin ? data.companyId : user?.company_id ?? ''}
            isAdmin={isAdmin}
            ruleViolations={ctx.violations}
            onSubmitOnCreateChange={(submitOnCreate) => updateData({ submitOnCreate })}
          />
        );
      },
    },
  ];

  async function onSubmit(data: WizardData) {
    if (busy) return;

    const validationError =
      validateCustomerInfo(data.customerInfo, t) ??
      validateRequiredWizardDocuments(data.files, data.customerInfo, t) ??
      (planContext(data).hard.length ? t('dealerOps.validation.rulesBlocking') : null);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!data.planPricingSnapshot || !data.installmentPlan || !data.offerId || data.productIds.length === 0) return;

    setBusy(true);
    setError(null);

    try {
      const willReserve = willReserveListingOnSubmit(isAdmin, data.submitOnCreate);
      const statuses = await refreshSelectedListingStatuses(data.productIds, isAdmin);
      for (const id of data.productIds) {
        const availabilityError = vehicleAvailabilityMessage(
          listingFinancingBlock(statuses.get(id), willReserve),
          t,
        );
        if (availabilityError) {
          setError(availabilityError);
          toast.error(availabilityError);
          return;
        }
      }

      const customerSnapshot = buildCustomerSnapshot(data.customerInfo);
      const created = await apiFetch<{ id: string; created_ids?: string[] }>(
        '/api/ops/applications',
        {
          method: 'POST',
          body: JSON.stringify({
            productId: data.productIds[0],
            productIds: data.customerInfo.applicantType === 'corporate' ? data.productIds : undefined,
            offerId: data.offerId,
            customerSnapshot,
            pricingSnapshot: data.planPricingSnapshot,
            installmentPlan: data.installmentPlan,
            agentUserId: data.agentUserId || undefined,
            listPrice: data.listPrice,
            sellingPrice: data.sellingPrice,
            hideInterest: data.hideInterest,
            companyId: isAdmin ? data.companyId || undefined : undefined,
            submit: isAdmin ? data.submitOnCreate : true,
          }),
        },
        { idempotencyKey: createIdempotencyKey.current },
      );

      const ids = created.created_ids?.length ? created.created_ids : [created.id];

      for (const appId of ids) {
        for (const [category, file] of Object.entries(data.files)) {
          if (!file) continue;
          const fd = new FormData();
          fd.append('category', category);
          fd.append('file', file);
          await apiFetch(`/api/ops/applications/${appId}/documents`, { method: 'POST', body: fd });
        }
      }

      // Only now is the work safely on the server; until this point the draft
      // is the customer's only copy.
      clearMultiStepDraft(DRAFT_STORAGE_KEY);
      navigate(`${detailBase}/${ids[0]}`);
    } catch (err) {
      const code = apiErrorCodeOf(err);
      const message =
        submitGateMessage(err, t) ??
        (code === 'vehicle_unavailable'
          ? t('dealerOps.vehicleAvailability.reserved')
          : code === 'listing_not_available'
            ? t('dealerOps.vehicleAvailability.unavailable')
            : null) ??
        (err instanceof Error ? err.message : t('ops.wizard.submitFailed'));
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="blox-page">
      <OpsPageHeader title={t('ops.wizard.newApplication')} subtitle={t('ops.wizard.step.customer')} />
      {error && (
        <div className="blox-form-error blox-form-grid__full" role="alert">
          {error}
        </div>
      )}
      <OpsContentCard staticHover>
        <MultiStepForm
          steps={steps}
          initialData={initialData}
          onSubmit={onSubmit}
          isSubmitting={busy}
          storageKey={DRAFT_STORAGE_KEY}
          storageOmitKeys={DRAFT_OMIT_KEYS}
        />
        {busy && <p className="blox-form-hint">{t('ops.common.saving')}</p>}
      </OpsContentCard>
    </div>
  );
}
