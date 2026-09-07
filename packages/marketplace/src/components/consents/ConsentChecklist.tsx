/**
 * Reusable consent checklist: the four mandatory consents from the shared
 * catalog, each with title, summary, expandable full text and an "I have read
 * and agree" checkbox. Used inline by the apply stepper (scoped to an
 * application) and by the consent centre (account level).
 */
import { useEffect, useId, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ApiError,
  CONSENT_CATALOG,
  CONSENT_CODES,
  apiFetch,
  getAppLocale,
  type ConsentCodeValue,
  type ConsentRecordDto,
  type ConsentStatusDto,
} from '@drivemarket/shared';
import { Notice, Pill } from '../../pages/apply/fields';
import { formatDate } from '../../pages/apply/format';

export function consentStatusPath(applicationId?: string | null): string {
  return `/api/me/consents${applicationId ? `?application_id=${encodeURIComponent(applicationId)}` : ''}`;
}

export function consentQueryKey(applicationId?: string | null) {
  return ['me-consents', applicationId ?? 'account'] as const;
}

export function useConsentStatus(applicationId?: string | null, enabled = true) {
  return useQuery({
    queryKey: consentQueryKey(applicationId),
    queryFn: () => apiFetch<ConsentStatusDto>(consentStatusPath(applicationId)),
    enabled,
    retry: false,
  });
}

export type ConsentItemState = 'accepted' | 'outdated' | 'missing';

/** Latest record for a code plus whether it satisfies the current catalog version. */
export function consentItemState(code: ConsentCodeValue, status: ConsentStatusDto | null | undefined): { state: ConsentItemState; record: ConsentRecordDto | null } {
  const records = (status?.accepted ?? []).filter((r) => r.code === code).sort((a, b) => b.accepted_at.localeCompare(a.accepted_at));
  const record = records[0] ?? null;
  if (!record) return { state: 'missing', record: null };
  const current = !record.outdated && record.version === CONSENT_CATALOG[code].version;
  return { state: current ? 'accepted' : 'outdated', record };
}

export function channelLabelKey(channel: ConsentRecordDto['channel']): string {
  switch (channel) {
    case 'mobile':
      return 'consentCentre.channelMobile';
    case 'assisted':
      return 'consentCentre.channelAssisted';
    default:
      return 'consentCentre.channelWeb';
  }
}

type Props = {
  applicationId?: string | null;
  onStatusChange?: (status: ConsentStatusDto) => void;
  /** Hide the intro line (the stepper renders its own). */
  hideIntro?: boolean;
  /** Only render outstanding/outdated consents (consent centre). */
  outstandingOnly?: boolean;
};

export function ConsentChecklist({ applicationId, onStatusChange, hideIntro, outstandingOnly }: Props) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const qc = useQueryClient();
  const status = useConsentStatus(applicationId);
  const [selected, setSelected] = useState<Set<ConsentCodeValue>>(() => new Set());
  const [expanded, setExpanded] = useState<Set<ConsentCodeValue>>(() => new Set());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (status.data) onStatusChange?.(status.data);
  }, [status.data, onStatusChange]);

  const items = useMemo(
    () =>
      CONSENT_CODES.map((code) => {
        const def = CONSENT_CATALOG[code];
        const { state, record } = consentItemState(code, status.data);
        return { code, def, state, record };
      }),
    [status.data],
  );
  const outstanding = items.filter((i) => i.state !== 'accepted');
  const visible = outstandingOnly ? outstanding : items;

  const mutation = useMutation({
    mutationFn: (codes: ConsentCodeValue[]) =>
      apiFetch<ConsentStatusDto>('/api/me/consents', {
        method: 'POST',
        body: JSON.stringify({
          acceptances: codes.map((code) => ({ code, version: CONSENT_CATALOG[code].version })),
          locale,
          ...(applicationId ? { application_id: applicationId } : {}),
        }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(consentQueryKey(applicationId), data);
      if (applicationId) void qc.invalidateQueries({ queryKey: consentQueryKey(null) });
      void qc.invalidateQueries({ queryKey: ['app', applicationId] });
      setSelected(new Set());
      setSaved(true);
      onStatusChange?.(data);
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && (error.code === 'consent_version_outdated' || error.message.includes('consent_version_outdated'))) {
        void status.refetch();
      }
    },
  });

  function toggle(code: ConsentCodeValue, checked: boolean) {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
  }

  function toggleExpanded(code: ConsentCodeValue) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  const selectedOutstanding = outstanding.filter((i) => selected.has(i.code)).map((i) => i.code);
  const allDone = status.data ? status.data.complete : false;

  return (
    <div className="dm-consents">
      {!hideIntro ? <p className="dm-step__intro">{t('consentCentre.intro')}</p> : null}

      <div className="dm-consents__summary" aria-live="polite">
        {status.isLoading ? (
          <span className="dm-muted">{t('vehicles.loading')}</span>
        ) : allDone ? (
          <Pill tone="success">{t('consentCentre.allDone')}</Pill>
        ) : (
          <Pill tone="warn">{t('consentCentre.missing', { count: outstanding.length })}</Pill>
        )}
        {status.isError ? <span className="dm-muted">{t('consentCentre.loadError')}</span> : null}
      </div>

      <ul className="dm-consents__list">
        {visible.map(({ code, def, state, record }) => (
          <ConsentCard
            key={code}
            code={code}
            title={def.title[locale]}
            summary={def.summary[locale]}
            body={def.body[locale]}
            version={def.version}
            state={state}
            record={record}
            checked={selected.has(code)}
            expanded={expanded.has(code)}
            disabled={mutation.isPending}
            onToggle={(checked) => toggle(code, checked)}
            onToggleExpanded={() => toggleExpanded(code)}
          />
        ))}
      </ul>

      {mutation.isError ? <Notice tone="danger">{t('consentCentre.saveError')}</Notice> : null}
      {saved && allDone ? <Notice tone="success" live="polite">{t('consentCentre.successNote')}</Notice> : null}

      {outstanding.length > 0 ? (
        <div className="dm-consents__actions">
          <button type="button" className="dm-btn-cta" disabled={mutation.isPending || selectedOutstanding.length === 0} onClick={() => mutation.mutate(selectedOutstanding)} aria-busy={mutation.isPending || undefined}>
            {mutation.isPending ? t('consentCentre.saving') : t('consentCentre.acceptSelected')}
            {selectedOutstanding.length > 0 && !mutation.isPending ? <span className="dm-numeric"> ({selectedOutstanding.length})</span> : null}
          </button>
          {outstanding.length > 1 ? (
            <button
              type="button"
              className="dm-btn-ghost dm-btn-ghost--on-light"
              disabled={mutation.isPending}
              onClick={() => {
                setSelected(new Set(outstanding.map((i) => i.code)));
                mutation.mutate(outstanding.map((i) => i.code));
              }}
            >
              {t('consentCentre.acceptAll')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ConsentCard({
  code,
  title,
  summary,
  body,
  version,
  state,
  record,
  checked,
  expanded,
  disabled,
  onToggle,
  onToggleExpanded,
}: {
  code: ConsentCodeValue;
  title: string;
  summary: string;
  body: string;
  version: string;
  state: ConsentItemState;
  record: ConsentRecordDto | null;
  checked: boolean;
  expanded: boolean;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
  onToggleExpanded: () => void;
}) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const uid = useId();
  const bodyId = `${uid}-body`;
  const checkboxId = `${uid}-agree`;
  const paragraphs = body.split(/\n\s*\n/);

  return (
    <li className={`dm-consent is-${state}`} data-code={code}>
      <div className="dm-consent__head">
        <div className="dm-consent__titles">
          <h3 className="dm-consent__title">{title}</h3>
          <p className="dm-consent__summary">{summary}</p>
        </div>
        <Pill tone={state === 'accepted' ? 'success' : state === 'outdated' ? 'warn' : 'neutral'}>
          {state === 'accepted' ? t('consentCentre.acceptedBadge') : state === 'outdated' ? t('consentCentre.outdatedBadge') : t('consentCentre.required')}
        </Pill>
      </div>

      <button type="button" className="dm-consent__toggle" aria-expanded={expanded} aria-controls={bodyId} onClick={onToggleExpanded}>
        {expanded ? t('consentCentre.hideFull') : t('consentCentre.readFull')}
      </button>
      <div id={bodyId} className="dm-consent__body" hidden={!expanded}>
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p className="dm-consent__version dm-muted">{t('consentCentre.acceptedVersion', { version })}</p>
      </div>

      <div className="dm-consent__foot">
        {state === 'accepted' && record ? (
          <p className="dm-consent__accepted">
            <span>{t('consentCentre.accepted', { date: formatDate(record.accepted_at, locale) })}</span>
            <span className="dm-muted"> · {t('consentCentre.acceptedVersion', { version: record.version })}</span>
            <span className="dm-muted"> · {t(channelLabelKey(record.channel))}</span>
          </p>
        ) : (
          <>
            {state === 'outdated' ? <p className="dm-consent__outdated">{t('consentCentre.outdated')}</p> : null}
            <label className="dm-check" htmlFor={checkboxId}>
              <input id={checkboxId} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onToggle(e.target.checked)} aria-describedby={bodyId} />
              <span>{t('consentCentre.agree')}</span>
            </label>
          </>
        )}
      </div>
    </li>
  );
}
