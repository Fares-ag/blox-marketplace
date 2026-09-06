import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { formatQar, formatPercent } from '../lib/format';
import { useOpsLabels } from '../i18n/use-ops-labels';
import type { PublicOffer } from '../types/domain';
import type { InstallmentPlan } from '../types/installment-plan';
import type { OpsAgent } from './types';
import {
  buildCustomerSnapshot,
  docCategoriesForApplicant,
  requiredDocCategoriesForApplicant,
  type CustomerInfoFormValue,
} from './customer-info';
import { CustomerInfoOverview, InfoItem } from './CustomerInfoOverview';
import { InstallmentScheduleTable } from './InstallmentScheduleTable';
import type { VehicleCardOption } from './VehicleSelectionCards';

export type WizardReviewData = {
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

export function WizardReviewStep({
  data,
  selectedVehicles,
  offer,
  companyName,
  agentCompanyId,
  isAdmin,
  onSubmitOnCreateChange,
}: {
  data: WizardReviewData;
  selectedVehicles: VehicleCardOption[];
  offer?: PublicOffer;
  companyName?: string;
  agentCompanyId: string;
  isAdmin: boolean;
  onSubmitOnCreateChange?: (value: boolean) => void;
}) {
  const { t } = useOpsLabels();
  const agents = useQuery({
    queryKey: ['wizard-agents', agentCompanyId],
    queryFn: () => apiFetch<{ items: OpsAgent[] }>(`/api/companies/${agentCompanyId}/agents`),
    enabled: !!agentCompanyId && !!data.agentUserId,
  });
  const agent = (agents.data?.items ?? []).find((a) => a.id === data.agentUserId);
  const agentLabel = agent ? (agent.name ?? agent.email) : data.agentUserId ? t('ops.common.dash') : undefined;

  const priceForPlan =
    data.sellingPrice || data.listPrice || Number(selectedVehicles[0]?.price ?? 0);
  const docCategories = docCategoriesForApplicant(data.customerInfo.applicantType);
  const requiredDocs = new Set(requiredDocCategoriesForApplicant(data.customerInfo.applicantType));
  const isCorporateMulti = data.customerInfo.applicantType === 'corporate' && selectedVehicles.length > 1;
  const financeLabel =
    offer?.crm_adapter === 'zoho' ? t('ops.common.partnerFinance') : t('ops.common.bloxFinance');
  const snapshot = data.planPricingSnapshot;
  const plan = data.installmentPlan;

  return (
    <div className="blox-wizard-review">
      <h2 className="blox-wizard-review__title">{t('ops.wizard.reviewTitle')}</h2>

      {isCorporateMulti && (
        <p className="blox-wizard-review__note">{t('ops.wizard.multiApplicationNote', { count: selectedVehicles.length })}</p>
      )}

      <CustomerInfoOverview snapshot={buildCustomerSnapshot(data.customerInfo)} />

      <section className="blox-detail-section">
        <h2 className="blox-panel__title">{t('ops.wizard.step.vehicle')}</h2>
        {companyName && <InfoItem label={t('ops.col.dealer')} value={companyName} />}
        {selectedVehicles.length === 0 ? (
          <InfoItem label={t('ops.wizard.selectVehicle')} value={t('ops.common.dash')} />
        ) : (
          selectedVehicles.map((vehicle, index) => (
            <div key={vehicle.id} className="blox-wizard-review__vehicle">
              {selectedVehicles.length > 1 && (
                <h3 className="blox-wizard-review__subtitle">
                  {t('ops.wizard.vehicleIndex', { index: index + 1 })}
                </h3>
              )}
              <InfoItem
                label={t('ops.col.vehicle')}
                value={[vehicle.make, vehicle.model, vehicle.model_year ? `(${vehicle.model_year})` : null]
                  .filter(Boolean)
                  .join(' ')}
              />
              <InfoItem label={t('ops.wizard.listPrice')} value={formatQar(Number(vehicle.price ?? 0))} />
              {vehicle.company_name && <InfoItem label={t('ops.col.dealer')} value={vehicle.company_name} />}
            </div>
          ))
        )}
        {selectedVehicles.length > 1 && (
          <InfoItem
            label={t('ops.wizard.totalVehiclePrice')}
            value={formatQar(selectedVehicles.reduce((sum, v) => sum + Number(v.price ?? 0), 0))}
          />
        )}
      </section>

      <section className="blox-detail-section">
        <h2 className="blox-panel__title">{t('ops.wizard.step.deal')}</h2>
        <InfoItem label={t('ops.credit.agent')} value={agentLabel} />
        <InfoItem label={t('ops.wizard.listPrice')} value={data.listPrice ? formatQar(data.listPrice) : undefined} />
        <InfoItem label={t('ops.wizard.sellingPrice')} value={data.sellingPrice ? formatQar(data.sellingPrice) : undefined} />
        <InfoItem
          label={t('ops.wizard.hideInterest')}
          value={data.hideInterest ? t('ops.common.yes') : t('ops.common.no')}
        />
      </section>

      <section className="blox-detail-section">
        <h2 className="blox-panel__title">{t('ops.wizard.reviewOfferPlan')}</h2>
        <InfoItem label={t('ops.credit.offer')} value={offer?.name} />
        <InfoItem
          label={t('ops.wizard.annualRentRate')}
          value={offer?.annual_rent_rate != null ? formatPercent(Number(offer.annual_rent_rate)) : undefined}
        />
        <InfoItem label={t('ops.wizard.financeProvider')} value={offer ? financeLabel : undefined} />
        <InfoItem label={t('ops.credit.tenure')} value={data.tenure ? t('ops.common.months', { count: data.tenure }) : undefined} />
        <InfoItem
          label={t('ops.wizard.downPaymentPct')}
          value={data.downPct != null ? formatPercent(data.downPct) : undefined}
        />
        {plan && (
          <>
            <InfoItem
              label={t('ops.wizard.downPayment')}
              value={formatQar(Number(plan.downPayment ?? snapshot?.down_payment ?? 0))}
            />
            <InfoItem label={t('ops.wizard.paymentInterval')} value={plan.interval} />
            <InfoItem label={t('ops.wizard.firstPayment')} value={formatQar(Number(plan.monthlyAmount ?? 0))} />
            <InfoItem label={t('ops.wizard.tenure')} value={plan.tenure} />
            <InfoItem label={t('ops.wizard.totalAmount')} value={formatQar(Number(plan.totalAmount ?? 0))} />
          </>
        )}
      </section>

      <section className="blox-detail-section">
        <h2 className="blox-panel__title">{t('ops.wizard.step.documents')}</h2>
        {docCategories.map((cat) => {
          const file = data.files[cat];
          const isRequired = requiredDocs.has(cat);
          return (
            <InfoItem
              key={cat}
              label={
                isRequired
                  ? `${t(`ops.wizard.doc.${cat}`, { defaultValue: cat })} *`
                  : t(`ops.wizard.doc.${cat}`, { defaultValue: cat })
              }
              value={file ? file.name : t('ops.wizard.documentMissing')}
            />
          );
        })}
      </section>

      {plan && (
        <section className="blox-detail-section blox-wizard-review__schedule">
          <h2 className="blox-panel__title">{t('ops.wizard.reviewSchedule')}</h2>
          <InstallmentScheduleTable
            installmentPlan={plan}
            applicationStatus="draft"
            vehiclePrice={priceForPlan}
            projected
          />
        </section>
      )}

      <section className="blox-detail-section blox-wizard-review__submit">
        <p>{isAdmin ? t('ops.wizard.createsDraft') : t('ops.wizard.submitsToCredit')}</p>
        {isAdmin && onSubmitOnCreateChange && (
          <label className="blox-checkbox-row">
            <input
              type="checkbox"
              checked={data.submitOnCreate}
              onChange={(e) => onSubmitOnCreateChange(e.target.checked)}
            />
            <span>{t('ops.wizard.submitOnCreate')}</span>
          </label>
        )}
      </section>
    </div>
  );
}
