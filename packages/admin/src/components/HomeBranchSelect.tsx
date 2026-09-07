import { useTranslation } from 'react-i18next';
import { OpsSelect } from '@drivemarket/shared';
import { useCompanyBranches } from '../lib/customer-platform';

type Props = {
  companyId: string | null | undefined;
  value: string;
  onChange: (branchId: string) => void;
  /** Renders the legacy `<label><select/></label>` markup used inside `.blox-form`. */
  plain?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
};

/** Home-branch picker: the active branches of the selected company (plus the current one if inactive). */
export function HomeBranchSelect({ companyId, value, onChange, plain, fullWidth, disabled }: Props) {
  const { t } = useTranslation();
  const branches = useCompanyBranches(companyId);
  const items = branches.data ?? [];
  const selectable = items.filter((b) => b.active || b.id === value);

  const hint = !companyId
    ? t('adminOps.users.selectCompanyFirst')
    : branches.isLoading
      ? t('adminOps.common.loading')
      : branches.isError
        ? t('adminOps.users.branchesLoadFailed')
        : selectable.length === 0
          ? t('adminOps.users.noBranches')
          : t('adminOps.users.homeBranchHint');

  const isDisabled = disabled || !companyId || (selectable.length === 0 && !value);
  const options = (
    <>
      <option value="">{t('branchOps.noBranch')}</option>
      {selectable.map((b) => (
        <option key={b.id} value={b.id}>
          {b.code} · {b.name}
          {b.active ? '' : ` (${t('branchOps.inactive')})`}
        </option>
      ))}
    </>
  );

  if (plain) {
    return (
      <label>
        {t('branchOps.homeBranch')}
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={isDisabled}>
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
      label={t('branchOps.homeBranch')}
      hint={hint}
      fullWidth={fullWidth}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={isDisabled}
    >
      {options}
    </OpsSelect>
  );
}
