import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOpsLabels } from '../../i18n/use-ops-labels';
import { apiFetch } from '../../lib/api';
import { OpsDetailGrid } from '../../ops-ui-v2';
import { OpsPrimaryButton, OpsStatusPill } from '../../components/ops-ui';
import { apiFileUrl } from '../../lib/api';
import { ApplicationDocumentActions } from '../ApplicationDocumentActions';
import { applicationDocumentLabel, isPreviewableImageDocument } from '../../application-document-label';
import { CustomerInfoForm } from '../CustomerInfoForm';
import { CustomerInfoOverview } from '../CustomerInfoOverview';
import { documentsForSlot } from '../../lib/document-slots';
import {
  buildCustomerSnapshot,
  customerInfoFromSnapshot,
  ruleViolationMessage,
  slotSatisfiedBy,
  documentSlotContextForWorkspace,
  wizardDocumentSlots,
  type CustomerInfoFormValue,
} from '../customer-info';
import type { ProductRuleCode } from '../../lib/product-rules';
import type { OpsDocumentSlotsResponse, OpsRuleFlag } from '../types';
import { resubmissionHighlights } from '../../lib/credit-ops-fields';
import { DecisionPanel } from './DecisionPanel';
import { AssistedSessionPanel } from './AssistedSessionPanel';
import { ConsentsPanel } from './ConsentsPanel';
import { CreditAssessmentPanel } from './CreditAssessmentPanel';
import { GuarantorPanel } from './GuarantorPanel';
import { TakafulPanel } from './TakafulPanel';
import type { WorkspacePanelProps } from './types';
import { resolveLenderLabel } from './lender-label';

type Props = WorkspacePanelProps & {
  reason: string;
  onReasonChange: (value: string) => void;
  customerPct: number;
  bloxPct: number;
  showOwnership: boolean;
  onOpenTab: (tab: 'docs' | 'logs' | 'schedule' | 'register') => void;
  canSeeLogs: boolean;
};

const ASSIST_CLOSED_STATUSES = new Set(['active', 'completed', 'rejected', 'submission_cancelled', 'partner_processing']);

function qar(value: unknown): string {
  const n = Number(value ?? 0);
  return `QAR ${Number.isFinite(n) ? n.toLocaleString() : '0'}`;
}

function infoFromWorkspaceSnapshot(
  snapshot: Record<string, unknown> | undefined,
  customerEmail?: string | null,
  customerName?: string | null,
  customerPhone?: string | null,
): CustomerInfoFormValue {
  const info = customerInfoFromSnapshot(snapshot ?? {});
  if (!info.email && customerEmail) info.email = customerEmail;
  if (!info.phone && customerPhone) info.phone = customerPhone ?? '';
  if (!info.firstName && !info.lastName && customerName) {
    const parts = customerName.split(/\s+/);
    info.firstName = parts[0] ?? '';
    info.lastName = parts.slice(1).join(' ');
  }
  return info;
}

function DealerResubmitProfile({
  snapshot,
  customerEmail,
  customerName,
  customerPhone,
  highlightFields,
  saving,
  onSave,
}: {
  snapshot?: Record<string, unknown> | null;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  highlightFields: ReadonlySet<string>;
  saving: boolean;
  onSave: (next: Record<string, unknown>) => void;
}) {
  const { t } = useOpsLabels();
  const initial = useMemo(
    () => infoFromWorkspaceSnapshot(snapshot ?? undefined, customerEmail, customerName, customerPhone),
    [snapshot, customerEmail, customerName, customerPhone],
  );
  const [value, setValue] = useState<CustomerInfoFormValue>(initial);
  useEffect(() => {
    setValue(initial);
  }, [initial]);

  return (
    <>
      <CustomerInfoForm
        value={value}
        onChange={setValue}
        allowExistingCustomer={false}
        highlightFields={highlightFields}
      />
      <div className="blox-panel__foot">
        <OpsPrimaryButton
          type="button"
          disabled={saving}
          loading={saving}
          onClick={() => onSave(buildCustomerSnapshot(value))}
        >
          {t('ops.workspace.saveChanges')}
        </OpsPrimaryButton>
      </div>
    </>
  );
}

function ruleFlagLabel(flag: OpsRuleFlag, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (typeof flag === 'string') return t(`applyFlow.rule.${flag}`, { defaultValue: flag.replace(/_/g, ' ') });
  return ruleViolationMessage(
    { code: flag.code as ProductRuleCode, severity: flag.severity ?? 'soft', params: flag.params ?? {} },
    t,
  );
}

/**
 * Overview tab — Phase 1 §11. Main: applicant profile (masked identity with
 * audited reveal), plan with rule flags, the credit assessment (ops audiences),
 * documents checklist. Aside: the decision panel first, then the
 * customer-platform cards (assisted session for dealers, consents, guarantor
 * consent, takaful) and the last three events.
 */
export function OverviewTab(props: Props) {
  const { id, data, customerPct, bloxPct, showOwnership, onOpenTab, canSeeLogs, platform } = props;
  const { t } = useOpsLabels();
  const pricing = (data.pricing_snapshot ?? {}) as Record<string, unknown>;
  const snap = data.customer_snapshot ?? {};
  const info = useMemo(() => customerInfoFromSnapshot(snap), [snap]);
  const slotsQuery = useQuery({
    queryKey: ['ops-app-document-slots', id],
    queryFn: () => apiFetch<OpsDocumentSlotsResponse>(`/api/ops/applications/${id}/document-slots`),
    enabled: !!id,
    retry: false,
  });
  const requiredSlots = useMemo(() => {
    const server = slotsQuery.data?.slots;
    const base = server?.length
      ? server
      : wizardDocumentSlots(info, documentSlotContextForWorkspace(data));
    return base.filter((slot) => slot.required);
  }, [slotsQuery.data, info, data]);
  const docs = data.documents ?? [];
  const uploaded = useMemo(() => {
    const set = new Set<string>(slotsQuery.data?.uploaded ?? []);
    for (const doc of docs) {
      if (doc.category) set.add(doc.category);
      if (doc.kyc_document_type) set.add(doc.kyc_document_type);
    }
    return set;
  }, [slotsQuery.data, docs]);
  const doneCount = requiredSlots.filter((slot) => slotSatisfiedBy(slot.category, uploaded)).length;
  const tenor = pricing.tenor as number | undefined;
  const down = Number(pricing.down_payment ?? 0);
  const listPrice = Number(pricing.list_price ?? 0);
  const sellingPrice = Number(pricing.selling_price ?? listPrice);
  const logs = (data.activity_logs ?? []).slice(0, 3);
  const ruleFlags = (data.rule_flags ?? (pricing.rule_flags as OpsRuleFlag[] | undefined) ?? []) as OpsRuleFlag[];
  const audience = platform?.audience;
  const assistPhone = data.customer?.phone ?? info.phone;
  const assistEmail = data.customer?.email ?? data.customer_email ?? info.email;
  const highlights = useMemo(() => resubmissionHighlights(data.resubmission_items), [data.resubmission_items]);
  const canEditResubmitProfile =
    (audience === 'dealer' || audience === 'admin' || audience === 'super_admin') &&
    data.status === 'resubmission_required' &&
    highlights.info.size > 0;
  const highlightPlan = highlights.plan && audience !== 'dealer';

  return (
    <OpsDetailGrid
      main={
        <>
          {canEditResubmitProfile ? (
            <DealerResubmitProfile
              snapshot={snap}
              customerEmail={data.customer_email ?? data.customer?.email}
              customerName={data.customer?.name}
              customerPhone={data.customer?.phone}
              highlightFields={highlights.info}
              saving={props.mutations.patchEdit.isPending}
              onSave={(customerSnapshot) => props.mutations.patchEdit.mutate({ customerSnapshot })}
            />
          ) : (
            <CustomerInfoOverview
              snapshot={snap}
              customerEmail={data.customer_email ?? data.customer?.email}
              customerName={data.customer?.name}
              customerPhone={data.customer?.phone}
              maskIdentity
              reveal={platform?.reveal}
              highlightFields={highlights.info}
            />
          )}

          <section className={`blox-detail-section${highlightPlan ? ' is-resubmit' : ''}`}>
            <h2 className="blox-panel__title">{t('ops.credit.applicantPlan')}</h2>
            <dl className="blox-kv blox-kv--two">
              <dt>{t('ops.credit.offer')}</dt>
              <dd>{data.offer?.name ?? '—'}</dd>
              <dt>{t('ops.wizard.rate', { defaultValue: 'Rate' })}</dt>
              <dd className="blox-kv__num">{pricing.rate != null ? `${pricing.rate} %` : '—'}</dd>
              <dt>{t('ops.wizard.listPrice')}</dt>
              <dd className="blox-kv__num">{listPrice > 0 ? qar(listPrice) : '—'}</dd>
              <dt>{t('ops.wizard.sellingPrice')}</dt>
              <dd className="blox-kv__num">{sellingPrice > 0 ? qar(sellingPrice) : '—'}</dd>
              <dt>{t('ops.wizard.downPayment', { defaultValue: 'Down payment' })}</dt>
              <dd className="blox-kv__num">
                {down ? `${qar(down)}${pricing.down_payment_pct ? ` (${pricing.down_payment_pct} %)` : ''}` : '—'}
              </dd>
              <dt>{t('ops.credit.monthlyInstallment')}</dt>
              <dd className="blox-kv__num">{qar(pricing.monthly)}</dd>
              <dt>{t('ops.credit.tenure')}</dt>
              <dd>{tenor ? t('ops.common.months', { count: tenor, defaultValue: `${tenor} months` }) : '—'}</dd>
              {data.agent && (
                <>
                  <dt>{t('dealerOps.workspace.salesExecutive')}</dt>
                  <dd>{data.agent.name ?? data.agent.email}</dd>
                </>
              )}
              {data.branch_name && (
                <>
                  <dt>{t('dealerOps.workspace.branch')}</dt>
                  <dd>{data.branch_name}</dd>
                </>
              )}
              <dt>{t('dealerOps.workspace.lender')}</dt>
              <dd>{resolveLenderLabel(data, t)}</dd>
            </dl>
            {ruleFlags.length > 0 && (
              <div className="blox-form-block">
                <h3 className="blox-panel__subtitle">{t('dealerOps.workspace.ruleFlags')}</h3>
                <p className="blox-field__hint">{t('dealerOps.workspace.ruleFlagsHint')}</p>
                <ul className="blox-doc-rows">
                  {ruleFlags.map((flag, index) => (
                    <li key={`${typeof flag === 'string' ? flag : flag.code}-${index}`} className="blox-doc-row">
                      <OpsStatusPill
                        label={t('dealerOps.plan.rulesWarn')}
                        variant={typeof flag !== 'string' && flag.severity === 'hard' ? 'danger' : 'warning'}
                      />
                      <span className="blox-doc-row__name">{ruleFlagLabel(flag, t)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {showOwnership && (
              <div className="blox-ownership">
                <div className="blox-ownership__bar" role="img" aria-label={`${t('ownership.customerShare')} ${customerPct.toFixed(1)} %`}>
                  <i className="blox-ownership__customer" style={{ width: `${Math.min(100, Math.max(0, customerPct))}%` }} />
                  <i className="blox-ownership__blox" style={{ width: `${Math.min(100, Math.max(0, bloxPct))}%` }} />
                </div>
                <div className="blox-ownership__legend">
                  <span>
                    <i className="blox-ownership__swatch blox-ownership__swatch--customer" />
                    {t('ownership.ownedByYou')} {customerPct.toFixed(1)} %
                  </span>
                  <span>
                    <i className="blox-ownership__swatch blox-ownership__swatch--blox" />
                    {t('ownership.ownedByBlox')} {bloxPct.toFixed(1)} %
                  </span>
                </div>
              </div>
            )}
          </section>

          {platform && audience !== 'dealer' && (
            <CreditAssessmentPanel
              assessment={platform.creditAssessment ?? data.credit_assessment ?? null}
              loading={platform.creditAssessmentPending}
              error={platform.creditAssessmentError}
              showApprover
            />
          )}

          <section className="blox-detail-section">
            <h2 className="blox-panel__title">
              {t('ops.workspace.tab.docs')}
              <span className="blox-panel__title-aside">
                <OpsStatusPill
                  label={t('ops.workspace.docsRequired', { done: doneCount, total: requiredSlots.length })}
                  variant={doneCount === requiredSlots.length ? 'success' : 'warning'}
                />
              </span>
            </h2>
            <ul className="blox-doc-grid">
              {requiredSlots.map((slot) => {
                const cat = slot.category;
                const doc = documentsForSlot(docs, cat)[0];
                const label = t(slot.labelKey, {
                  defaultValue: t(`application.docCategory.${cat}`, { defaultValue: cat.replace(/_/g, ' ') }),
                });
                const displayName = doc ? applicationDocumentLabel(doc, () => label) : label;
                const filePath = doc ? `/applications/${id}/documents/${doc.id}/file` : null;
                const showImage = doc && isPreviewableImageDocument(doc);

                return (
                  <li key={cat} className={`blox-doc-card${highlights.docs.has(cat) ? ' is-resubmit' : ''}`}>
                    <div className="blox-doc-card__preview">
                      {showImage && filePath ? (
                        <img src={apiFileUrl(filePath)} alt={displayName} className="blox-doc-card__thumb" loading="lazy" />
                      ) : (
                        <span className="blox-doc-card__placeholder">
                          {doc?.mime_type?.includes('pdf') ? 'PDF' : doc ? 'IMG' : '—'}
                        </span>
                      )}
                    </div>
                    <div className="blox-doc-card__body">
                      <span className="blox-doc-card__name">{displayName}</span>
                      <div className="blox-doc-card__footer">
                        {doc ? (
                          <>
                            <OpsStatusPill
                              label={t(`ops.workspace.docStatus.${doc.verification_status ?? 'uploaded'}`, {
                                defaultValue: (doc.verification_status ?? 'uploaded').replace(/_/g, ' '),
                              })}
                              variant={doc.verification_status === 'verified' ? 'success' : doc.verification_status === 'rejected' ? 'danger' : 'info'}
                            />
                            {filePath && (
                              <ApplicationDocumentActions
                                filePath={filePath}
                                viewLabel={t('ops.common.view')}
                                downloadLabel={t('ops.common.download')}
                                fallbackFilename={doc.original_name ?? `${cat}.pdf`}
                              />
                            )}
                          </>
                        ) : (
                          <OpsStatusPill label={t('ops.workspace.docStatus.missing')} variant="warning" />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="blox-panel__foot">
              <button type="button" className="blox-btn blox-btn--ghost blox-btn--sm" onClick={() => onOpenTab('docs')}>
                {t('ops.workspace.openDocuments')}
              </button>
            </div>
          </section>
        </>
      }
      aside={
        <>
          <DecisionPanel {...props} />
          {audience === 'dealer' && (
            <AssistedSessionPanel
              applicationId={id}
              defaultPhone={assistPhone && !/x/i.test(assistPhone) ? assistPhone : ''}
              defaultEmail={assistEmail ?? ''}
              canStart={!ASSIST_CLOSED_STATUSES.has(data.status)}
            />
          )}
          {platform && (
            <ConsentsPanel
              status={platform.consents}
              loading={platform.consentsPending}
              error={platform.consentsError}
              completedAt={data.consents_completed_at}
            />
          )}
          {platform?.guarantor?.hasGuarantor && (
            <GuarantorPanel
              applicationId={id}
              snapshot={snap}
              canSend={platform.guarantor.canSend}
              canStart={!ASSIST_CLOSED_STATUSES.has(data.status)}
            />
          )}
          {platform && audience !== 'dealer' && (
            <TakafulPanel
              applicationId={id}
              canVerify={!!platform.canVerifyTakaful}
              onVerify={platform.onVerifyTakaful}
              verifying={platform.verifyingTakaful}
            />
          )}
          {canSeeLogs && logs.length > 0 && (
            <section className="blox-detail-section">
              <h2 className="blox-panel__title">{t('ops.workspace.timeline')}</h2>
              <ol className="blox-tl">
                {logs.map((log) => (
                  <li key={log.id}>
                    <span className="blox-tl__what">
                      {log.action.replace(/_/g, ' ')}
                      {log.from_value || log.to_value ? ` · ${log.from_value ?? ''} → ${log.to_value ?? ''}` : ''}
                    </span>
                    <span className="blox-tl__when">
                      {new Date(log.created_at).toLocaleString()} · {log.actor_email ?? 'system'}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="blox-panel__foot">
                <button type="button" className="blox-btn blox-btn--ghost blox-btn--sm" onClick={() => onOpenTab('logs')}>
                  {t('ops.workspace.allActivity')}
                </button>
              </div>
            </section>
          )}
        </>
      }
    />
  );
}
