import { useOpsLabels } from '../../i18n/use-ops-labels';
import { OpsDetailGrid } from '../../ops-ui-v2';
import { OpsStatusPill } from '../../components/ops-ui';
import { apiFileUrl } from '../../lib/api';
import { applicationDocumentLabel, isPreviewableImageDocument } from '../../application-document-label';
import { CustomerInfoOverview } from '../CustomerInfoOverview';
import { customerInfoFromSnapshot, requiredDocCategoriesForApplicant } from '../customer-info';
import { DecisionPanel } from './DecisionPanel';
import type { WorkspacePanelProps } from './types';

type Props = WorkspacePanelProps & {
  reason: string;
  onReasonChange: (value: string) => void;
  customerPct: number;
  bloxPct: number;
  showOwnership: boolean;
  onOpenTab: (tab: 'docs' | 'logs' | 'schedule') => void;
  canSeeLogs: boolean;
};

function qar(value: unknown): string {
  const n = Number(value ?? 0);
  return `QAR ${Number.isFinite(n) ? n.toLocaleString() : '0'}`;
}

/**
 * Overview tab — Phase 1 §11. Main: applicant profile, plan (with the ownership bar),
 * documents checklist. Aside: the decision panel first, then the last three events.
 */
export function OverviewTab(props: Props) {
  const { id, data, customerPct, bloxPct, showOwnership, onOpenTab, canSeeLogs } = props;
  const { t } = useOpsLabels();
  const pricing = (data.pricing_snapshot ?? {}) as Record<string, unknown>;
  const snap = data.customer_snapshot ?? {};
  const applicantType = customerInfoFromSnapshot(snap).applicantType;
  const required = requiredDocCategoriesForApplicant(applicantType);
  const docs = data.documents ?? [];
  const haveCategory = (cat: string) => docs.some((d) => d.category === cat);
  const doneCount = required.filter(haveCategory).length;
  const tenor = pricing.tenor as number | undefined;
  const down = Number(pricing.down_payment ?? 0);
  const listPrice = Number(pricing.list_price ?? pricing.selling_price ?? 0);
  const logs = (data.activity_logs ?? []).slice(0, 3);

  return (
    <OpsDetailGrid
      main={
        <>
          <CustomerInfoOverview
            snapshot={snap}
            customerEmail={data.customer_email ?? data.customer?.email}
            customerName={data.customer?.name}
            customerPhone={data.customer?.phone}
          />

          <section className="blox-detail-section">
            <h2 className="blox-panel__title">{t('ops.credit.applicantPlan')}</h2>
            <dl className="blox-kv blox-kv--two">
              <dt>{t('ops.credit.offer')}</dt>
              <dd>{data.offer?.name ?? '—'}</dd>
              <dt>{t('ops.wizard.rate', { defaultValue: 'Rate' })}</dt>
              <dd className="blox-kv__num">{pricing.rate != null ? `${pricing.rate} %` : '—'}</dd>
              <dt>{t('ops.credit.vehiclePrice')}</dt>
              <dd className="blox-kv__num">{qar(listPrice)}</dd>
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
                  <dt>{t('ops.credit.agent')}</dt>
                  <dd>{data.agent.name ?? data.agent.email}</dd>
                </>
              )}
              {data.financing_source === 'partner' && (
                <>
                  <dt>{t('ops.common.partnerFinance')}</dt>
                  <dd>{data.finance_partner_name ?? '—'}</dd>
                </>
              )}
            </dl>
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

          <section className="blox-detail-section">
            <h2 className="blox-panel__title">
              {t('ops.workspace.tab.docs')}
              <span className="blox-panel__title-aside">
                <OpsStatusPill
                  label={t('ops.workspace.docsRequired', { done: doneCount, total: required.length })}
                  variant={doneCount === required.length ? 'success' : 'warning'}
                />
              </span>
            </h2>
            <ul className="blox-doc-grid">
              {required.map((cat) => {
                const doc = docs.find((d) => d.category === cat);
                const label = t(`application.docCategory.${cat}`, { defaultValue: cat });
                const displayName = doc ? applicationDocumentLabel(doc, () => label) : label;
                const fileHref = doc ? apiFileUrl(`/applications/${id}/documents/${doc.id}/file`) : null;
                const showImage = doc && isPreviewableImageDocument(doc);

                return (
                  <li key={cat} className="blox-doc-card">
                    <div className="blox-doc-card__preview">
                      {showImage && fileHref ? (
                        <a href={fileHref} target="_blank" rel="noreferrer">
                          <img src={fileHref} alt={displayName} className="blox-doc-card__thumb" loading="lazy" />
                        </a>
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
                            {fileHref && (
                              <a className="blox-btn blox-btn--ghost blox-btn--sm" href={fileHref} target="_blank" rel="noreferrer">
                                {t('ops.common.view')}
                              </a>
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
