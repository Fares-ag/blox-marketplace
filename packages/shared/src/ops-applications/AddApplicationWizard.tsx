import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { apiFetch } from '../lib/api';
import { buildPricingSnapshot } from '../lib/pricing';
import { clampTenureMonths, MAX_TENURE_MONTHS, MIN_TENURE_MONTHS } from '../lib/tenure';
import { useAuthStore } from '../auth/auth-store';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { OpsPageHeader } from '../components/ops-ui';
import { MultiStepForm, OpsContentCard, OpsField, OpsFormGrid, OpsFormSection, OpsSelect, type StepConfig, type StepProps } from '../ops-ui-v2';
import type { PaginatedResponse, PublicOffer } from '../types/domain';
import type { OpsAgent, OpsAudience } from './types';
import { VehicleSelectionCards, type VehicleCardOption } from './VehicleSelectionCards';
import { WizardAgentInvite } from './WizardAgentInvite';
import { CustomerInfoForm } from './CustomerInfoForm';
import { InstallmentPlanStep } from './InstallmentPlanStep';
import { WizardReviewStep } from './WizardReviewStep';
import type { InstallmentPlan } from '../types/installment-plan';
import {
  buildCustomerSnapshot,
  docCategoriesForApplicant,
  emptyCustomerInfo,
  validateCustomerInfo,
  KYC_UPLOAD_ACCEPT,
  kycUploadRejection,
  type CustomerInfoFormValue,
} from './customer-info';

type VehicleOption = {
  id: string;
  make: string;
  model: string;
  model_year?: number;
  price: number;
  listing_status?: string;
  company_id?: string;
  company_name?: string;
  primary_image?: string | null;
  images?: Array<{ storage_path?: string | null }>;
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
    listing_status: v.listing_status,
    company_id: v.company_id,
    company_name: v.company_name,
    primary_image: v.primary_image ?? v.images?.[0]?.storage_path ?? null,
  }));
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
        <OpsField
          label={t('ops.wizard.listPrice')}
          type="number"
          required
          min={0}
          value={data.listPrice || ''}
          onChange={(e) => updateData({ listPrice: Number(e.target.value) })}
        />
        <OpsField
          label={t('ops.wizard.sellingPrice')}
          type="number"
          required
          min={0}
          value={data.sellingPrice || ''}
          onChange={(e) => updateData({ sellingPrice: Number(e.target.value) })}
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
      downPct: 10,
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

  const steps: StepConfig<WizardData>[] = [
    {
      label: t('ops.wizard.step.customer'),
      component: ({ data, updateData }: StepProps<WizardData>) => (
        <CustomerInfoForm
          value={data.customerInfo ?? emptyCustomerInfo()}
          onChange={(customerInfo) => updateData({ customerInfo })}
        />
      ),
    },
    {
      label: t('ops.wizard.step.vehicle'),
      component: ({ data, updateData }: StepProps<WizardData>) => {
        const items = filterVehicleItems(vehicles.data?.items ?? [], isAdmin, data.companyId);
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
            />
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
              const opts = Array.isArray(next?.tenure_options) ? (next?.tenure_options as number[]) : [36];
              updateData({
                offerId: e.target.value,
                tenure: opts.includes(36) ? 36 : opts[0] ?? 36,
                downPct: Number(next?.min_down_payment_pct ?? 10),
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
      component: ({ data, updateData }: StepProps<WizardData>) => {
        const vehicleItems = filterVehicleItems(vehicles.data?.items ?? [], isAdmin, data.companyId);
        const selectedVehicles = vehicleItems.filter((v) => data.productIds.includes(v.id));
        const primaryVehicle = selectedVehicles[0];
        const offer = (offers.data?.items ?? []).find((o) => o.id === data.offerId);
        const minDown = Number(offer?.min_down_payment_pct ?? 10);
        const rate = Number(offer?.annual_rent_rate ?? 0);
        const priceForPlan = data.sellingPrice || data.listPrice || Number(primaryVehicle?.price ?? 0);
        const preview = offer
          ? buildPricingSnapshot({
              listPrice: priceForPlan,
              annualRatePercent: rate,
              minDownPaymentPct: minDown,
              tenureMonths: data.tenure,
              downPaymentPct: data.downPct,
            })
          : null;

        if (!preview) return null;

        return (
          <OpsFormSection title={t('ops.wizard.step.plan')}>
            <OpsFormGrid>
              <OpsField
                label={t('ops.credit.tenure')}
                type="number"
                min={MIN_TENURE_MONTHS}
                max={MAX_TENURE_MONTHS}
                value={data.tenure}
                onChange={(e) => updateData({ tenure: clampTenureMonths(Number(e.target.value)) })}
              />
              <OpsField
                label={t('ops.wizard.downPaymentPct')}
                type="number"
                min={minDown}
                max={80}
                value={data.downPct}
                onChange={(e) => updateData({ downPct: Number(e.target.value) })}
              />
            </OpsFormGrid>
            <InstallmentPlanStep
              vehiclePrice={priceForPlan}
              offerRate={rate}
              minDownPct={minDown}
              tenureMonths={data.tenure}
              downPaymentPct={data.downPct}
              hideInterest={data.hideInterest}
              onChange={(plan, snap) => updateData({ installmentPlan: plan, planPricingSnapshot: snap })}
            />
          </OpsFormSection>
        );
      },
    },
    {
      label: t('ops.wizard.step.documents'),
      component: ({ data, updateData }: StepProps<WizardData>) => {
        const docCategories = docCategoriesForApplicant(data.customerInfo.applicantType);
        return (
          <>
            {docCategories.map((cat) => (
              <label key={cat} className="blox-upload-dropzone" style={{ display: 'block', cursor: 'pointer' }}>
                <input
                  type="file"
                  accept={KYC_UPLOAD_ACCEPT}
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    // Rejected at selection rather than at submit: the wizard
                    // uploads these only after the application has been
                    // created, so an unsupported file otherwise fails once the
                    // record already exists and the documents are missing.
                    const rejection = kycUploadRejection(file);
                    if (rejection) {
                      setError(rejection);
                      toast.error(rejection);
                      return;
                    }
                    updateData({ files: { ...data.files, [cat]: file } });
                  }}
                />
                <p style={{ margin: 0, fontWeight: 600 }}>{t(`ops.wizard.doc.${cat}`, { defaultValue: cat })}</p>
                {data.files[cat] && (
                  <p style={{ margin: '4px 0 0', color: 'var(--secondary-text)', fontSize: '0.875rem' }}>
                    {data.files[cat]?.name}
                  </p>
                )}
              </label>
            ))}
          </>
        );
      },
    },
    {
      label: t('ops.wizard.step.review'),
      component: ({ data, updateData }: StepProps<WizardData>) => {
        const vehicleItems = filterVehicleItems(vehicles.data?.items ?? [], isAdmin, data.companyId);
        const selectedVehicles = vehicleItems.filter((v) => data.productIds.includes(v.id));
        const offer = (offers.data?.items ?? []).find((o) => o.id === data.offerId);
        const companyName = (companies.data?.items ?? []).find((c) => c.id === data.companyId)?.name;

        return (
          <WizardReviewStep
            data={data}
            selectedVehicles={selectedVehicles}
            offer={offer}
            companyName={isAdmin ? companyName : undefined}
            agentCompanyId={isAdmin ? data.companyId : user?.company_id ?? ''}
            isAdmin={isAdmin}
            onSubmitOnCreateChange={(submitOnCreate) => updateData({ submitOnCreate })}
          />
        );
      },
    },
  ];

  async function onSubmit(data: WizardData) {
    if (busy) return;
    if (!data.planPricingSnapshot || !data.installmentPlan || !data.offerId || data.productIds.length === 0) return;

    const validationError = validateCustomerInfo(data.customerInfo);
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const customerSnapshot = buildCustomerSnapshot(data.customerInfo);
      const docCategories = docCategoriesForApplicant(data.customerInfo.applicantType);
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
        for (const category of docCategories) {
          const file = data.files[category];
          if (!file) continue;
          const fd = new FormData();
          fd.append('category', category);
          fd.append('file', file);
          await apiFetch(`/api/ops/applications/${appId}/documents`, { method: 'POST', body: fd });
        }
      }

      navigate(`${detailBase}/${ids[0]}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('ops.wizard.submitFailed');
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
        />
        {busy && <p style={{ marginTop: 8 }}>{t('ops.common.saving')}</p>}
      </OpsContentCard>
    </div>
  );
}
