import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  DocumentMeta,
  MoneyText,
  apiFetch,
  formatQar,
  getAppLocale,
  useAuthStore,
  applicationMarketplacePillVariant,
  type CustomerDocumentDto,
  type ProductDetailResponse,
  type ProductListResponse,
} from '@drivemarket/shared';
import { MarketplaceNav } from '../components/MarketplaceNav';
import { ListingCard } from '../components/ListingCard';
import { OwnershipProgress } from '../components/OwnershipProgress';
import { OwnershipHero, OWNERSHIP_HERO_STATUSES } from '../components/OwnershipHero';
import { useCompareStore } from '../lib/compare-store';
import {
  customerApplicationVehicleLabel,
  normalizeCustomerApplication,
  normalizeCustomerApplicationList,
  type CustomerApplication,
} from '../lib/application-dto';
import { daysUntil, formatDate } from '../lib/dates';

type MyApplication = {
  id: string;
  status: string;
  createdAt: string;
  pricingSnapshot?: Record<string, unknown> | null;
  product: {
    make: string;
    model: string;
    modelYear?: number;
    slug: string;
    price?: number;
  };
};

type AppDetail = MyApplication & {
  paymentSchedules?: Array<{
    id: string;
    sequence: number;
    dueDate: string;
    amount: string | number;
    status: string;
  }>;
};

const ACTIVE_STATUSES = new Set([
  'draft',
  'under_review',
  'resubmission_required',
  'contract_signing_required',
  'contracts_submitted',
  'contract_under_review',
  'down_payment_required',
  'down_payment_submitted',
  'pending_finance_activation',
  'partner_processing',
  'active',
]);

const TAKAFUL_ATTENTION_DAYS = 30;

type TakafulAttention = { kind: 'missing' } | { kind: 'expiring'; date: string | null };

function takafulAttentionFor(app: CustomerApplication | undefined): TakafulAttention | null {
  if (!app || app.status !== 'active') return null;
  const policies = (app.takafulPolicies ?? [])
    .filter((p) => p.status !== 'closed')
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0));
  const current = policies[0];
  if (!current) return { kind: 'missing' };
  const days = current.daysToExpiry ?? daysUntil(current.expiresAt);
  if (current.status === 'expired' || (days != null && days <= TAKAFUL_ATTENTION_DAYS)) {
    return { kind: 'expiring', date: current.expiresAt };
  }
  return null;
}

export function CustomerDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const locale = getAppLocale();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { entries: compareEntries, count: compareCount, remove: removeCompare } = useCompareStore();

  const apps = useQuery({
    queryKey: ['my-apps'],
    queryFn: () =>
      apiFetch<{ total: number; items: Record<string, unknown>[] }>('/api/applications/mine?limit=100').then(
        (res) => normalizeCustomerApplicationList(res) as { total: number; items: MyApplication[] },
      ),
  });

  const blocking = useQuery({
    queryKey: ['apps-blocking'],
    queryFn: () => apiFetch<{ blocking: boolean; applicationId: string | null }>('/api/applications/blocking'),
  });

  const arrivals = useQuery({
    queryKey: ['products', 'dashboard-arrivals'],
    queryFn: () => apiFetch<ProductListResponse>('/api/products?sort=newest&limit=4'),
  });

  const vaultDocs = useQuery({
    queryKey: ['me-documents'],
    queryFn: () => apiFetch<CustomerDocumentDto[]>('/api/me/documents'),
    retry: false,
  });

  const compareResults = useQueries({
    queries: compareEntries.map((e) => ({
      queryKey: ['product', e.slug],
      queryFn: () => apiFetch<ProductDetailResponse>(`/api/products/by-slug/${e.slug}`),
    })),
  });

  const list = apps.data?.items ?? [];
  const spotlight =
    list.find((a) => a.id === blocking.data?.applicationId) ??
    list.find((a) => ACTIVE_STATUSES.has(a.status)) ??
    list[0] ??
    null;

  // The plan whose co-ownership is the hero: live financing first, then a finished one.
  const ownershipApp =
    list.find((a) => a.status === 'active') ?? list.find((a) => a.status === 'completed') ?? null;

  const needsAction = list.filter(
    (a) => a.status === 'resubmission_required' || a.status === 'draft',
  ).length;
  const underReview = list.filter((a) => a.status === 'under_review').length;
  const displayName = user?.full_name?.trim() || user?.email?.split('@')[0] || 'there';

  const spotlightMonthly = Number(spotlight?.pricingSnapshot?.monthly ?? 0);
  const spotlightDown = Number(spotlight?.pricingSnapshot?.down_payment ?? 0);

  const ownershipDetail = useQuery({
    queryKey: ['app', ownershipApp?.id, 'ownership'],
    queryFn: () =>
      apiFetch<Record<string, unknown>>(`/api/applications/${ownershipApp!.id}`).then(normalizeCustomerApplication),
    enabled: !!ownershipApp?.id,
  });

  const heroShowsSpotlight = !!spotlight && spotlight.id === ownershipApp?.id;
  const showOwnershipProgress = spotlight != null && !!spotlight.pricingSnapshot && !heroShowsSpotlight;

  const spotlightDetail = useQuery({
    queryKey: ['app', spotlight?.id, 'dashboard'],
    queryFn: () =>
      apiFetch<Record<string, unknown>>(`/api/applications/${spotlight!.id}`).then(
        (raw) => normalizeCustomerApplication(raw) as AppDetail,
      ),
    enabled:
      !!spotlight?.id &&
      !heroShowsSpotlight &&
      (spotlight.status === 'active' ||
        spotlight.status === 'completed' ||
        spotlight.status === 'pending_finance_activation'),
  });

  const docsAttention = (vaultDocs.data ?? []).filter(
    (d) => d.expiry_state === 'expired' || d.expiry_state === 'expiring_soon',
  ).length;
  const takafulAttention = useMemo(() => takafulAttentionFor(ownershipDetail.data), [ownershipDetail.data]);
  const ownershipVehicle = ownershipDetail.data ? customerApplicationVehicleLabel(ownershipDetail.data) : '';
  const heroApp =
    ownershipDetail.data && OWNERSHIP_HERO_STATUSES.has(ownershipDetail.data.status) ? ownershipDetail.data : null;

  return (
    <div className="dm-dash">
      <DocumentMeta title={t('dashboard.metaTitle')} />
      <div className="dm-dash__top">
        <div className="dm-dash__inner">
          <MarketplaceNav />
          <div className="dm-dash__hero">
            <div className="dm-dash__hero-copy">
              <p className="dm-dash__eyebrow">{t('dashboard.eyebrow')}</p>
              <h1>{t('dashboard.greeting', { name: displayName })}</h1>
              <p className="dm-dash__support">{t('dashboard.support')}</p>
            </div>
            <div className="dm-dash__hero-actions">
              <Link className="dm-btn-cta" to="/vehicles">
                {t('home.browse')}
              </Link>
              <Link className="dm-btn-ghost dm-dash__ghost" to="/help">
                {t('home.howItWorks')}
              </Link>
            </div>
          </div>
          <OwnershipHero
            app={heroApp}
            loading={apps.isLoading || (!!ownershipApp && ownershipDetail.isLoading)}
          />
        </div>
      </div>

      <div className="dm-dash__body">
        <div className="dm-dash__inner dm-dash__inner--stack">
          <section className="dm-dash__snapshot" aria-label={t('dashboard.snapshot')}>
            <div className="dm-dash__snap">
              <span className="dm-dash__snap-label">{t('dashboard.appsCount')}</span>
              <strong>{apps.isLoading ? '—' : list.length}</strong>
            </div>
            <div className="dm-dash__snap">
              <span className="dm-dash__snap-label">{t('dashboard.actionNeeded')}</span>
              <strong className={needsAction > 0 ? 'is-warn' : undefined}>
                {apps.isLoading ? '—' : needsAction}
              </strong>
            </div>
            <div className="dm-dash__snap">
              <span className="dm-dash__snap-label">{t('dashboard.underReview')}</span>
              <strong>{apps.isLoading ? '—' : underReview}</strong>
            </div>
            <div className="dm-dash__snap">
              <span className="dm-dash__snap-label">{t('nav.compare')}</span>
              <strong>{compareCount}</strong>
              {compareCount > 0 && (
                <Link to="/compare" className="dm-dash__snap-link">
                  {t('dashboard.openCompare')}
                </Link>
              )}
            </div>
          </section>

          {(docsAttention > 0 || takafulAttention) && (
            <section className="dm-dash__attention" aria-labelledby="dm-dash-attention-title">
              <h2 id="dm-dash-attention-title">{t('ownershipHero.attentionTitle')}</h2>
              <ul>
                {docsAttention > 0 && (
                  <li>
                    <span>{t('ownershipHero.attentionDocuments', { count: docsAttention })}</span>
                    <Link to="/app/profile#vault">{t('ownershipHero.attentionDocumentsLink')}</Link>
                  </li>
                )}
                {takafulAttention && ownershipApp && (
                  <li>
                    <span>
                      {takafulAttention.kind === 'missing'
                        ? t('ownershipHero.attentionTakafulMissing', { vehicle: ownershipVehicle })
                        : t('ownershipHero.attentionTakafulExpiring', {
                            vehicle: ownershipVehicle,
                            date: formatDate(takafulAttention.date, locale),
                          })}
                    </span>
                    <Link to={`/app/applications/${ownershipApp.id}`}>{t('ownershipHero.attentionTakafulLink')}</Link>
                  </li>
                )}
              </ul>
            </section>
          )}

          {blocking.data?.blocking && spotlight && (
            <section className="dm-dash__notice" role="status">
              <div>
                <h2>{t('dashboard.activeFinancing')}</h2>
                <p>{t('dashboard.activeFinancingBody')}</p>
              </div>
            <Link className="dm-btn-cta dm-dash__notice-btn" to={`/app/applications/${spotlight.id}`}>
              {t('dashboard.viewApplication')}
            </Link>
          </section>
          )}

          <div className="dm-dash__grid">
            <section className="dm-dash__panel">
              <div className="dm-dash__panel-head">
                <h2>{t('dashboard.currentApplication')}</h2>
                <Link to="/app/applications">{t('dashboard.viewAllApps')}</Link>
              </div>

              {apps.isLoading && <p className="dm-dash__muted">{t('vehicles.loading')}</p>}

              {!apps.isLoading && !spotlight && (
                <div className="dm-dash__empty">
                  <p>{t('dashboard.noAppsBody')}</p>
                  <Link className="dm-btn-cta" to="/vehicles">
                    {t('application.browse')}
                  </Link>
                </div>
              )}

              {spotlight && (
                <article className="dm-dash__spotlight">
                  <div className="dm-dash__spotlight-top">
                    <span className={`dm-status-pill dm-status-pill--${applicationMarketplacePillVariant(spotlight.status)}`}>
                      {t(`application.status.${spotlight.status}`, { defaultValue: spotlight.status })}
                    </span>
                    <time dateTime={spotlight.createdAt}>
                      {spotlight.status === 'draft'
                        ? t('application.created')
                        : t('application.submitted')}
                      :{' '}
                      {new Date(spotlight.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-QA' : 'en-QA')}
                    </time>
                  </div>
                  <h3>
                    {spotlight.product.make} {spotlight.product.model}
                    {spotlight.product.modelYear ? ` · ${spotlight.product.modelYear}` : ''}
                  </h3>
                  {(spotlightMonthly > 0 || spotlightDown > 0) && (
                    <dl className="dm-dash__pricing">
                      {spotlightDown > 0 && (
                        <>
                          <dt>{t('application.downPayment')}</dt>
                          <dd>
                            <MoneyText>{formatQar(spotlightDown, false, locale)}</MoneyText>
                          </dd>
                        </>
                      )}
                      {spotlightMonthly > 0 && (
                        <>
                          <dt>{t('detail.estMonthly')}</dt>
                          <dd>
                            <MoneyText>{formatQar(spotlightMonthly, true, locale)}</MoneyText>
                          </dd>
                        </>
                      )}
                    </dl>
                  )}
                  {showOwnershipProgress && (
                    <OwnershipProgress
                      compact
                      pricingSnapshot={spotlightDetail.data?.pricingSnapshot ?? spotlight.pricingSnapshot}
                      paymentSchedules={spotlightDetail.data?.paymentSchedules}
                      onRecoveryContribute={() => navigate(`/app/applications/${spotlight!.id}`)}
                      onRecoveryViewTimeline={() => navigate(`/app/applications/${spotlight!.id}`)}
                    />
                  )}
                  <div className="dm-dash__spotlight-actions">
                    <Link className="dm-btn-cta" to={`/app/applications/${spotlight.id}`}>
                      {t('dashboard.viewApplication')}
                    </Link>
                    {spotlight.product.slug && (
                      <Link to={`/vehicles/${spotlight.product.slug}`}>{t('application.viewListing')}</Link>
                    )}
                  </div>
                </article>
              )}

              {list.length > 1 && (
                <ul className="dm-dash__app-list">
                  {list
                    .filter((a) => a.id !== spotlight?.id)
                    .slice(0, 4)
                    .map((a) => (
                      <li key={a.id}>
                        <Link to={`/app/applications/${a.id}`} className="dm-dash__app-row">
                          <span className="dm-dash__app-row-title">
                            {a.product.make} {a.product.model}
                          </span>
                          <span className={`dm-status-pill dm-status-pill--${applicationMarketplacePillVariant(a.status)}`}>
                            {t(`application.status.${a.status}`, { defaultValue: a.status })}
                          </span>
                        </Link>
                      </li>
                    ))}
                </ul>
              )}
            </section>

            <aside className="dm-dash__side">
              <section className="dm-dash__panel">
                <div className="dm-dash__panel-head">
                  <h2>{t('dashboard.account')}</h2>
                  <Link to="/app/profile">{t('customerProfile.navLabel')}</Link>
                </div>
                <dl className="dm-dash__account">
                  <dt>{t('dashboard.email')}</dt>
                  <dd>{user?.email ?? '—'}</dd>
                  {user?.full_name && (
                    <>
                      <dt>{t('dashboard.name')}</dt>
                      <dd>{user.full_name}</dd>
                    </>
                  )}
                  {user?.phone && (
                    <>
                      <dt>{t('dashboard.phone')}</dt>
                      <dd>{user.phone}</dd>
                    </>
                  )}
                </dl>
                <button type="button" className="dm-dash__signout" onClick={() => void signOut()}>
                  {t('nav.signOut')}
                </button>
              </section>

              <section className="dm-dash__panel">
                <div className="dm-dash__panel-head">
                  <h2>{t('dashboard.shortcuts')}</h2>
                </div>
                <nav className="dm-dash__links">
                  <Link to="/vehicles">{t('home.browse')}</Link>
                  <Link to="/dealers">{t('nav.dealers')}</Link>
                  <Link to="/compare">
                    {t('nav.compare')}
                    {compareCount > 0 ? ` (${compareCount})` : ''}
                  </Link>
                  <Link to="/app/applications">{t('application.title')}</Link>
                  <Link to="/app/calendar">{t('calendar.shortcut')}</Link>
                  <Link to="/app/profile">{t('customerProfile.title')}</Link>
                  <Link to="/app/consents">{t('consentCentre.pageTitle')}</Link>
                  <Link to="/help">{t('nav.help')}</Link>
                </nav>
              </section>
            </aside>
          </div>

          <section className="dm-dash__panel">
            <div className="dm-dash__panel-head">
              <h2>{t('dashboard.compareTray')}</h2>
              {compareCount > 0 && <Link to="/compare">{t('dashboard.openCompare')}</Link>}
            </div>
            {compareCount === 0 ? (
              <div className="dm-dash__empty dm-dash__empty--inline">
                <p>{t('dashboard.compareEmpty')}</p>
                <Link to="/vehicles">{t('application.browse')}</Link>
              </div>
            ) : (
              <ul className="dm-dash__compare">
                {compareEntries.map((entry, i) => {
                  const p = compareResults[i]?.data?.product;
                  const loading = compareResults[i]?.isLoading;
                  return (
                    <li key={entry.id} className="dm-dash__compare-item">
                      {loading && <span className="dm-dash__muted">{t('vehicles.loading')}</span>}
                      {!loading && p && (
                        <>
                          <Link to={`/vehicles/${p.slug}`} className="dm-dash__compare-link">
                            <strong>
                              {p.make} {p.model}
                              {p.trim ? ` ${p.trim}` : ''}
                            </strong>
                            <span>
                              {p.model_year} · <MoneyText>{formatQar(p.price, false, locale)}</MoneyText>
                            </span>
                          </Link>
                          <button type="button" onClick={() => removeCompare(entry.id)}>
                            {t('compare.remove')}
                          </button>
                        </>
                      )}
                      {!loading && !p && (
                        <>
                          <span className="dm-dash__muted">{t('detail.unavailable')}</span>
                          <button type="button" onClick={() => removeCompare(entry.id)}>
                            {t('compare.remove')}
                          </button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {(arrivals?.data?.items.length ?? 0) > 0 && (
            <section className="dm-dash__arrivals">
              <div className="dm-dash__panel-head">
                <div>
                  <h2>{t('home.newArrivals')}</h2>
                  <p className="dm-dash__muted">{t('home.newArrivalsBody')}</p>
                </div>
                <Link to="/vehicles?sort=newest">{t('home.viewAll')}</Link>
              </div>
              <div className="dm-dash__arrivals-list dm-listing-stack">
                {arrivals!.data!.items.map((p) => (
                  <ListingCard key={p.id} product={p} variant="row" />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <style>{`
        .dm-dash {
          --dm-dash-max: min(100%, var(--bp-content-max, 1600px));
          --dm-dash-gutter: 24px;
          background: var(--dm-canvas);
          min-height: 100vh;
        }
        .dm-dash__inner {
          width: 100%;
          max-width: var(--dm-dash-max);
          margin-inline: auto;
          padding-inline: var(--dm-dash-gutter);
          box-sizing: border-box;
        }
        .dm-dash__inner--stack {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .dm-dash__top {
          background:
            radial-gradient(ellipse 80% 60% at 100% 0%, rgba(0, 207, 162, 0.18), transparent 55%),
            linear-gradient(180deg, #0f3f45 0%, var(--dm-graphite-900) 100%);
          color: #fff;
          padding: 16px 0 32px;
        }
        .dm-dash .dm-topnav {
          position: relative !important;
          inset: auto !important;
          top: auto !important;
          z-index: auto !important;
          padding: 0 !important;
          margin: 0 0 24px;
        }
        .dm-dash__hero {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 20px 28px;
        }
        .dm-dash__hero-copy { min-width: min(100%, 280px); flex: 1 1 320px; }
        .dm-dash__eyebrow {
          margin: 0 0 8px;
          font-size: 0.72rem;
          font-weight: 650;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--dm-amber);
        }
        .dm-dash__hero h1 {
          margin: 0 0 10px;
          font-family: var(--dm-font-display);
          font-size: clamp(1.85rem, 3.5vw, 2.4rem);
          letter-spacing: -0.02em;
          line-height: 1.15;
        }
        .dm-dash__support {
          margin: 0;
          max-width: 42ch;
          color: rgba(255,255,255,0.72);
          line-height: 1.5;
        }
        .dm-dash__hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          flex-shrink: 0;
        }
        .dm-dash__ghost {
          border-color: rgba(255,255,255,0.35) !important;
          color: #fff !important;
        }
        .dm-dash__body {
          padding: 24px 0 64px;
        }
        .dm-dash__snapshot {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        .dm-dash__snap {
          background: var(--dm-surface);
          border: 1px solid var(--dm-slate-200);
          border-radius: 14px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          box-shadow: var(--dm-shadow-1);
        }
        .dm-dash__snap-label {
          font-size: 12px;
          color: var(--dm-slate-600);
          font-weight: 600;
          line-height: 1.3;
        }
        .dm-dash__snap strong {
          font-family: var(--dm-font-display);
          font-size: 1.5rem;
          color: var(--dm-ink);
          line-height: 1.15;
        }
        .dm-dash__snap strong.is-warn { color: var(--dm-warning); }
        .dm-dash__snap-link {
          font-size: 12px;
          font-weight: 650;
          color: var(--dm-steel);
          text-decoration: none;
          line-height: 1.2;
          margin-top: 2px;
        }
        .dm-dash__snap-link:hover { text-decoration: underline; }
        .dm-dash__attention {
          padding: 14px 18px;
          border-radius: 14px;
          background: var(--dm-surface);
          border: 1px solid rgba(196, 122, 0, 0.35);
          border-inline-start: 4px solid var(--dm-warning, #c47a00);
        }
        .dm-dash__attention h2 { margin: 0 0 8px; font-size: 0.95rem; color: var(--dm-warning, #c47a00); }
        .dm-dash__attention ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
        .dm-dash__attention li {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 6px 16px;
          font-size: 14px;
          color: var(--dm-ink);
        }
        .dm-dash__attention li a { font-weight: 650; color: var(--dm-steel); text-decoration: none; white-space: nowrap; }
        .dm-dash__attention li a:hover { text-decoration: underline; }
        .dm-dash__notice {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px 16px;
          padding: 14px 18px;
          border-radius: 14px;
          background: linear-gradient(180deg, #fff8eb, #fff3dc);
          border: 1px solid rgba(196, 122, 0, 0.22);
          color: #8a5a14;
        }
        .dm-dash__notice > div { flex: 1 1 240px; min-width: 0; }
        .dm-dash__notice h2 { margin: 0 0 4px; font-size: 1rem; color: inherit; line-height: 1.3; }
        .dm-dash__notice p { margin: 0; font-size: 0.9rem; line-height: 1.45; max-width: 52ch; }
        .dm-dash__notice-btn {
          flex-shrink: 0;
          min-height: 40px !important;
          padding: 0 18px !important;
          font-size: 0.9rem !important;
        }
        .dm-dash__grid {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(260px, 0.85fr);
          gap: 20px;
          align-items: start;
        }
        .dm-dash__side {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .dm-dash__panel {
          background: var(--dm-surface);
          border: 1px solid var(--dm-slate-200);
          border-radius: 16px;
          padding: 20px 22px;
          align-self: start;
          width: 100%;
          box-sizing: border-box;
        }
        .dm-dash__panel-head {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 8px 16px;
          margin-bottom: 14px;
        }
        .dm-dash__panel-head h2 {
          margin: 0;
          font-family: var(--dm-font-display);
          font-size: 1.15rem;
          line-height: 1.3;
        }
        .dm-dash__panel-head > a {
          font-size: 0.875rem;
          font-weight: 650;
          color: var(--dm-steel);
          text-decoration: none;
          white-space: nowrap;
        }
        .dm-dash__panel-head > a:hover { text-decoration: underline; }
        .dm-dash__muted { color: var(--dm-slate-600); margin: 0; font-size: 0.9rem; }
        .dm-dash__panel-head .dm-dash__muted { margin-top: 4px; }
        .dm-dash__empty {
          text-align: center;
          padding: 28px 16px;
          border: 1px dashed var(--dm-slate-200);
          border-radius: 12px;
          display: grid;
          gap: 14px;
          justify-items: center;
        }
        .dm-dash__empty--inline {
          text-align: start;
          justify-items: start;
          padding: 16px;
        }
        .dm-dash__empty p { margin: 0; color: var(--dm-slate-600); }
        .dm-dash__spotlight { display: flex; flex-direction: column; gap: 0; }
        .dm-dash__spotlight-top {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          margin-bottom: 10px;
        }
        .dm-dash__spotlight-top time { font-size: 13px; color: var(--dm-slate-600); }
        .dm-dash__spotlight h3 {
          margin: 0 0 12px;
          font-family: var(--dm-font-display);
          font-size: 1.35rem;
          line-height: 1.25;
        }
        .dm-dash__pricing {
          display: grid;
          grid-template-columns: auto 1fr;
          column-gap: 16px;
          row-gap: 6px;
          align-items: baseline;
          margin: 0 0 16px;
        }
        .dm-dash__pricing dt { color: var(--dm-slate-600); font-size: 14px; }
        .dm-dash__pricing dd { margin: 0; font-weight: 650; }
        .dm-dash__spotlight-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px 16px;
          align-items: center;
          margin-top: 12px;
        }
        .dm-dash__spotlight-actions .dm-btn-cta {
          min-height: 44px;
          padding: 0 20px;
          font-size: 0.95rem;
        }
        .dm-dash__spotlight-actions a:not(.dm-btn-cta) {
          font-weight: 650;
          color: var(--dm-steel);
          text-decoration: none;
        }
        .dm-dash__spotlight-actions a:not(.dm-btn-cta):hover { text-decoration: underline; }
        .dm-dash__app-list {
          list-style: none;
          margin: 16px 0 0;
          padding: 16px 0 0;
          border-top: 1px solid var(--dm-slate-200);
          display: grid;
          gap: 8px;
        }
        .dm-dash__app-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          padding: 10px 12px;
          border-radius: 10px;
          text-decoration: none;
          color: inherit;
          background: var(--dm-canvas);
        }
        .dm-dash__app-row-title {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 600;
        }
        .dm-dash__app-row:hover { outline: 1px solid var(--dm-steel); }
        .dm-status-pill {
          display: inline-block;
          padding: 5px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 650;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .dm-status-pill--approved { background: var(--dm-success-soft); color: var(--dm-success); }
        .dm-status-pill--pending { background: var(--dm-steel-soft); color: var(--dm-ink); }
        .dm-status-pill--action { background: var(--dm-warning-soft); color: var(--dm-warning); }
        .dm-status-pill--rejected { background: var(--dm-danger-soft); color: var(--dm-danger); }
        .dm-dash__account {
          display: grid;
          grid-template-columns: minmax(52px, auto) minmax(0, 1fr);
          gap: 8px 12px;
          align-items: baseline;
          margin: 0 0 14px;
          font-size: 14px;
        }
        .dm-dash__account dt { color: var(--dm-slate-600); }
        .dm-dash__account dd { margin: 0; font-weight: 600; word-break: break-word; }
        .dm-dash__signout {
          background: none;
          border: 1px solid var(--dm-slate-200);
          border-radius: 10px;
          min-height: 36px;
          padding: 0 14px;
          cursor: pointer;
          font: inherit;
          font-size: 0.875rem;
          font-weight: 650;
          color: var(--dm-slate-600);
        }
        .dm-dash__signout:hover { border-color: var(--dm-steel); color: var(--dm-ink); }
        .dm-dash__links {
          display: flex;
          flex-direction: column;
        }
        .dm-dash__links a {
          color: var(--dm-ink);
          font-weight: 600;
          text-decoration: none;
          padding: 10px 0;
          border-bottom: 1px solid var(--dm-slate-200);
        }
        .dm-dash__links a:last-child { border-bottom: none; padding-bottom: 0; }
        .dm-dash__links a:first-child { padding-top: 0; }
        .dm-dash__links a:hover { color: var(--dm-steel); }
        .dm-dash__compare {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 10px;
        }
        .dm-dash__compare-item {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          padding: 12px 14px;
          background: var(--dm-canvas);
          border-radius: 12px;
        }
        .dm-dash__compare-link {
          display: grid;
          gap: 2px;
          text-decoration: none;
          color: inherit;
          min-width: 0;
        }
        .dm-dash__compare-link strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .dm-dash__compare-link span { font-size: 13px; color: var(--dm-slate-600); }
        .dm-dash__compare-item button {
          background: none;
          border: none;
          color: var(--dm-slate-600);
          text-decoration: underline;
          cursor: pointer;
          font: inherit;
          font-size: 13px;
          flex-shrink: 0;
        }
        .dm-dash__arrivals .dm-dash__panel-head { margin-bottom: 20px; }
        .dm-dash__arrivals-list {
          width: 100%;
        }
        @media (max-width: 900px) {
          .dm-dash__snapshot { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .dm-dash__grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 480px) {
          .dm-dash { --dm-dash-gutter: 16px; }
          .dm-dash__body { padding-top: 16px; }
          .dm-dash .dm-topnav { margin-bottom: 20px; }
          .dm-dash__hero-actions { width: 100%; }
          .dm-dash__hero-actions .dm-btn-cta,
          .dm-dash__hero-actions .dm-btn-ghost { flex: 1 1 auto; text-align: center; }
          .dm-dash__notice-btn { width: 100%; }
        }
        @media (min-width: 1600px) {
          .dm-dash {
            --dm-dash-max: min(100%, var(--bp-content-wide, 2000px));
          }
        }
        @media (min-width: 1920px) {
          .dm-dash { --dm-dash-max: min(100%, var(--bp-content-ultra, 2560px)); }
        }
        @media (min-width: 2560px) {
          .dm-dash { --dm-dash-max: min(100%, 2800px); }
        }
      `}</style>
    </div>
  );
}
