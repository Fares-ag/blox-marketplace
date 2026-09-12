import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  apiFetch,
  formatQar,
  getAppLocale,
} from '@drivemarket/shared';
import { CustomerPortalLayout } from '../components/CustomerPortalLayout';
import { SETTLEMENT_ERROR_CODES } from '../lib/settlement-quote';
import { hasErrorCode } from '../lib/errors';

type HubSchedule = {
  id: string;
  applicationId: string;
  dueDate: string;
  amount: number | string;
  remainingAmount?: number | string;
  status: string;
  sequence?: number;
  application?: {
    id: string;
    status: string;
    product?: { make?: string; model?: string; modelYear?: number };
  };
};

type DeferralStatus = {
  year: number;
  used: number;
  remaining: number;
  limit: number;
  membership_active: boolean;
};

type PaymentsHubResponse = {
  schedules: HubSchedule[];
  credits?: { balance?: number };
};

function parseDueDate(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function vehicleLabel(row: HubSchedule): string {
  const p = row.application?.product;
  if (!p?.make) return row.applicationId.slice(0, 8);
  return [p.make, p.model, p.modelYear].filter(Boolean).join(' ');
}

function statusClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'paid' || s === 'waived') return 'is-paid';
  if (s === 'overdue') return 'is-overdue';
  return 'is-pending';
}

export function PaymentCalendarPage() {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const [deferReason, setDeferReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const hub = useQuery({
    queryKey: ['customer-payments-hub'],
    queryFn: () => apiFetch<PaymentsHubResponse>('/api/customer/payments/hub'),
  });

  const deferralStatus = useQuery({
    queryKey: ['deferral-status'],
    queryFn: () => apiFetch<DeferralStatus>('/api/customer/payments/deferral-status'),
  });

  const schedules = hub.data?.schedules ?? [];

  const paymentsByDay = useMemo(() => {
    const map = new Map<number, HubSchedule[]>();
    for (const row of schedules) {
      const due = parseDueDate(row.dueDate);
      if (!due || due.getMonth() !== month.getMonth() || due.getFullYear() !== month.getFullYear()) continue;
      const day = due.getDate();
      const list = map.get(day) ?? [];
      list.push(row);
      map.set(day, list);
    }
    return map;
  }, [month, schedules]);

  const selectedPayments = useMemo(() => {
    return schedules.filter((row) => {
      const due = parseDueDate(row.dueDate);
      return due != null && sameDay(due, selectedDay);
    });
  }, [schedules, selectedDay]);

  const monthLabel = month.toLocaleDateString(locale === 'ar' ? 'ar-QA' : 'en-QA', {
    month: 'long',
    year: 'numeric',
  });

  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const blanks = firstWeekday;
  const dayCells = Array.from({ length: blanks + daysInMonth }, (_, i) => {
    if (i < blanks) return null;
    return i - blanks + 1;
  });

  const canDefer =
    (deferralStatus.data?.membership_active ?? false) &&
    (deferralStatus.data?.remaining ?? 0) > 0;

  const deferPayment = useMutation({
    mutationFn: (args: { applicationId: string; scheduleId: string; reason?: string }) =>
      apiFetch(`/api/applications/${args.applicationId}/schedules/${args.scheduleId}/defer`, {
        method: 'POST',
        body: JSON.stringify({ reason: args.reason }),
      }),
    onSuccess: () => {
      setActionMessage(t('calendar.deferSuccess'));
      setActionError(null);
      setDeferReason('');
      void qc.invalidateQueries({ queryKey: ['customer-payments-hub'] });
      void qc.invalidateQueries({ queryKey: ['deferral-status'] });
    },
    onError: (e: Error) => {
      setActionMessage(null);
      // An overdue installment is settled, never deferred (wave 2 rule).
      setActionError(hasErrorCode(e, SETTLEMENT_ERROR_CODES.overdueNotDeferrable) ? t('ownershipHero.settlement.overdueNotDeferrable') : e.message);
    },
  });

  function goPrevMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  function goNextMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  function goToday() {
    const n = new Date();
    setMonth(new Date(n.getFullYear(), n.getMonth(), 1));
    setSelectedDay(new Date(n.getFullYear(), n.getMonth(), n.getDate()));
  }

  return (
    <CustomerPortalLayout
      metaTitle={t('calendar.metaTitle')}
      eyebrow={t('calendar.eyebrow')}
      title={t('calendar.title')}
      lead={t('calendar.lead')}
      contentClassName="dm-calendar"
    >
        {hub.isLoading && <p>{t('vehicles.loading')}</p>}
        {hub.isError && <p className="dm-calendar__error">{t('calendar.loadError')}</p>}

        {!hub.isLoading && schedules.length === 0 && (
          <section className="dm-calendar__empty">
            <h2>{t('calendar.emptyTitle')}</h2>
            <p>{t('calendar.emptyBody')}</p>
            <Link to="/vehicles">{t('home.browse')}</Link>
          </section>
        )}

        {schedules.length > 0 && (
          <div className="dm-calendar__layout">
            <section className="dm-calendar__grid-panel" aria-label={t('calendar.title')}>
              <div className="dm-calendar__toolbar">
                <button type="button" onClick={goPrevMonth} aria-label={t('calendar.prevMonth')}>
                  ‹
                </button>
                <strong>{monthLabel}</strong>
                <button type="button" onClick={goNextMonth} aria-label={t('calendar.nextMonth')}>
                  ›
                </button>
                <button type="button" className="dm-calendar__today" onClick={goToday}>
                  {t('calendar.today')}
                </button>
              </div>

              <div className="dm-calendar__weekdays">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>

              <div className="dm-calendar__grid">
                {dayCells.map((day, idx) => {
                  if (day == null) return <span key={`blank-${idx}`} className="dm-calendar__cell is-blank" />;
                  const date = new Date(month.getFullYear(), month.getMonth(), day);
                  const rows = paymentsByDay.get(day) ?? [];
                  const selected = sameDay(date, selectedDay);
                  const markers = rows.map((r) => statusClass(r.status));
                  return (
                    <button
                      key={day}
                      type="button"
                      className={`dm-calendar__cell${selected ? ' is-selected' : ''}${rows.length ? ' has-payments' : ''}`}
                      onClick={() => setSelectedDay(date)}
                    >
                      <span>{day}</span>
                      {rows.length > 0 && (
                        <span className="dm-calendar__markers" aria-hidden>
                          {markers.slice(0, 3).map((m, i) => (
                            <i key={i} className={m} />
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <ul className="dm-calendar__legend">
                <li><i className="is-pending" /> {t('calendar.legendPending')}</li>
                <li><i className="is-overdue" /> {t('calendar.legendOverdue')}</li>
                <li><i className="is-paid" /> {t('calendar.legendPaid')}</li>
              </ul>
            </section>

            <aside className="dm-calendar__detail">
              <h2>{selectedDay.toLocaleDateString(locale === 'ar' ? 'ar-QA' : 'en-QA', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}</h2>

              {deferralStatus.data && (
                <p className="dm-calendar__quota">
                  {t('calendar.deferQuota', {
                    remaining: deferralStatus.data.remaining,
                    limit: deferralStatus.data.limit,
                    year: deferralStatus.data.year,
                  })}
                </p>
              )}

              {actionMessage && <p className="dm-calendar__success">{actionMessage}</p>}
              {actionError && <p className="dm-calendar__error">{actionError}</p>}

              {selectedPayments.length === 0 ? (
                <p>{t('calendar.noPaymentsDay')}</p>
              ) : (
                <ul className="dm-calendar__day-list">
                  {selectedPayments.map((row) => {
                    const amount = Number(row.remainingAmount ?? row.amount);
                    const deferrable = ['pending', 'overdue'].includes(row.status.toLowerCase());
                    return (
                      <li key={row.id}>
                        <div>
                          <strong>{vehicleLabel(row)}</strong>
                          <span className={`dm-calendar__status ${statusClass(row.status)}`}>
                            {row.status}
                          </span>
                          <div>{formatQar(amount, false, locale)} · #{row.sequence ?? '—'}</div>
                        </div>
                        <div className="dm-calendar__actions">
                          {deferrable && canDefer && (
                            <button
                              type="button"
                              className="dm-calendar__defer"
                              disabled={deferPayment.isPending}
                              onClick={() =>
                                deferPayment.mutate({
                                  applicationId: row.applicationId,
                                  scheduleId: row.id,
                                  reason: deferReason.trim() || undefined,
                                })
                              }
                            >
                              {deferPayment.isPending
                                ? t('calendar.deferring')
                                : t('calendar.deferPayment')}
                            </button>
                          )}
                          <Link to={`/app/applications/${row.applicationId}`}>
                            {t('calendar.viewApplication')}
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {canDefer && selectedPayments.some((r) => ['pending', 'overdue'].includes(r.status.toLowerCase())) && (
                <label className="dm-calendar__reason">
                  <span>{t('calendar.deferReasonOptional')}</span>
                  <input
                    value={deferReason}
                    onChange={(e) => setDeferReason(e.target.value)}
                    placeholder={t('calendar.deferReasonPlaceholder')}
                  />
                </label>
              )}

              {!deferralStatus.data?.membership_active && (
                <p className="dm-calendar__hint">{t('calendar.membershipRequired')}</p>
              )}
              {deferralStatus.data?.membership_active && deferralStatus.data.remaining <= 0 && (
                <p className="dm-calendar__hint">{t('calendar.quotaExhausted')}</p>
              )}
            </aside>
          </div>
        )}
    </CustomerPortalLayout>
  );
}
