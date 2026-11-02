import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useOpsLabels } from '../../i18n/use-ops-labels';
import { OpsField, OpsSelect } from '../../ops-ui-v2';
import { OpsPrimaryButton } from '../../components/ops-ui';
import {
  CONTRACT_SERIES,
  contractNumberValidationError,
  formatContractRef,
  splitContractRef,
  SAP_NUMBER_MAX_LENGTH,
  CONTRACT_NUMBER_MAX_LENGTH,
} from '../../lib/credit-ops-fields';
import type { WorkspacePanelProps } from './types';

type Props = Pick<WorkspacePanelProps, 'data' | 'actions' | 'mutations'> & {
  canEditSap: boolean;
  canEditContract: boolean;
};

/** Dealer SAP number and credit contract series/number. */
export function ReferenceNumbersPanel({ data, mutations, canEditSap, canEditContract }: Props) {
  const { t } = useOpsLabels();
  const [sap, setSap] = useState(data.sap_number ?? '');
  const [series, setSeries] = useState(data.contract_series ?? '');
  const [number, setNumber] = useState(data.contract_number ?? '');
  const [numberError, setNumberError] = useState<string | undefined>();

  useEffect(() => {
    setSap(data.sap_number ?? '');
    setSeries(data.contract_series ?? '');
    setNumber(data.contract_number ?? '');
  }, [data.sap_number, data.contract_series, data.contract_number]);

  const contractLabel = formatContractRef(data.contract_series, data.contract_number);
  if (!canEditSap && !canEditContract) return null;

  return (
    <section className="blox-detail-section">
      <h2 className="blox-panel__title">{t('ops.workspace.contractRef')}</h2>
      <div className="blox-form-grid">
        {canEditSap ? (
          <OpsField
            label={t('ops.workspace.sapNumber')}
            hint={t('ops.workspace.sapNumberHint')}
            value={sap}
            maxLength={SAP_NUMBER_MAX_LENGTH}
            onChange={(e) => setSap(e.target.value)}
            mono
          />
        ) : (
          <div className="blox-field">
            <span className="blox-field__label">{t('ops.workspace.sapNumber')}</span>
            <p className="blox-m-0 blox-table__mono">{data.sap_number?.trim() || '—'}</p>
          </div>
        )}
        {canEditContract ? (
          <>
            <OpsSelect
              label={t('ops.workspace.contractSeries')}
              value={series}
              onChange={(e) => setSeries(e.target.value)}
            >
              <option value="">{t('ops.common.dash')}</option>
              {CONTRACT_SERIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </OpsSelect>
            <OpsField
              label={t('ops.workspace.contractNumber')}
              hint={t('ops.workspace.contractNumberHint', { defaultValue: 'Letters and digits. Series is selected separately.' })}
              value={number}
              maxLength={CONTRACT_NUMBER_MAX_LENGTH}
              error={numberError}
              onChange={(e) => {
                const next = e.target.value;
                const split = splitContractRef(next);
                if (split.series) {
                  setSeries(split.series);
                  setNumber(split.number);
                } else {
                  setNumber(next);
                }
                if (numberError) setNumberError(undefined);
              }}
              mono
            />
          </>
        ) : (
          <div className="blox-field">
            <span className="blox-field__label">{t('ops.workspace.contractRef')}</span>
            <p className="blox-m-0 blox-table__mono">{contractLabel || '—'}</p>
          </div>
        )}
        {(canEditSap || canEditContract) && (
          <div className="blox-form-grid__full blox-edit-panel__actions">
            <OpsPrimaryButton
              type="button"
              disabled={mutations.patchEdit.isPending}
              loading={mutations.patchEdit.isPending}
              onClick={() => {
                if (canEditContract && contractNumberValidationError(number) === 'invalid') {
                  const message = t('ops.workspace.contractNumberInvalid', {
                    defaultValue: 'Contract number must be letters and digits only.',
                  });
                  setNumberError(message);
                  toast.error(message);
                  return;
                }
                mutations.patchEdit.mutate(
                  {
                    ...(canEditSap ? { sapNumber: sap.trim() || null } : {}),
                    ...(canEditContract
                      ? { contractSeries: series.trim() || null, contractNumber: number.trim() || null }
                      : {}),
                  },
                  {
                    onSuccess: () =>
                      toast.success(canEditContract && !canEditSap ? t('ops.workspace.contractSaved') : t('ops.workspace.sapSaved')),
                  },
                );
              }}
            >
              {t('ops.workspace.saveChanges')}
            </OpsPrimaryButton>
          </div>
        )}
      </div>
    </section>
  );
}
