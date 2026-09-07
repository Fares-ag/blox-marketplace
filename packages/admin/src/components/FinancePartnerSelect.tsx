import { useTranslation } from 'react-i18next';
import { OpsSelect } from '@drivemarket/shared';
import { useFinanceProviders } from '../lib/customer-platform';

type Props = {
  value: string;
  onChange: (partnerId: string) => void;
  /** Renders the legacy `<label><select/></label>` markup used inside `.blox-form`. */
  plain?: boolean;
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
};

/** Finance-provider picker for partner viewers: active providers (plus the current one if inactive). */
export function FinancePartnerSelect({ value, onChange, plain, required, disabled, fullWidth }: Props) {
  const { t } = useTranslation();
  const providers = useFinanceProviders();
  const items = (providers.data ?? []).filter((p) => p.active || p.id === value);
  const hint = providers.isLoading
    ? t('adminOps.common.loading')
    : providers.isError
      ? t('adminOps.partnerUsers.financePartnersLoadFailed')
      : t('adminOps.partnerUsers.financePartnerHint');

  const options = (
    <>
      <option value="">{t('adminOps.partnerUsers.selectFinancePartner')}</option>
      {items.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
          {p.is_default_lender ? ` · ${t('financeProviders.defaultLender')}` : ''}
        </option>
      ))}
    </>
  );

  if (plain) {
    return (
      <label>
        {t('adminOps.partnerUsers.financePartner')}
        <select value={value} onChange={(e) => onChange(e.target.value)} required={required} disabled={disabled}>
          {options}
        </select>
        <span className="blox-form-hint" style={{ fontWeight: 400 }}>
          {hint}
        </span>
      </label>
    );
  }

  return (
    <OpsSelect
      label={t('adminOps.partnerUsers.financePartner')}
      hint={hint}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled}
      fullWidth={fullWidth}
    >
      {options}
    </OpsSelect>
  );
}
