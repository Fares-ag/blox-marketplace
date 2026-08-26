import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  AuthGuard,
  GuestGuard,
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  VerifyEmailPage,
  MoneyText,
  DocumentMeta,
  apiFetch,
  buildPricingSnapshot,
  clampTenureMonths,
  formatQar,
  getAppLocale,
  EMPLOYMENT_DURATION_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  MAX_TENURE_MONTHS,
  MIN_TENURE_MONTHS,
  applicationMarketplacePillVariant,
  applicationStatusLabel,
  trackProductEvent,
  type ProductDetailResponse,
  type ProductListResponse,
  type PublicCompany,
  type PublicCompanyListResponse,
} from '@drivemarket/shared';
import { ListingCard } from './components/ListingCard';
import {
  FacetPanel,
  FacetMobileTrigger,
  buildProductsQuery,
  parseBrowseParams,
  type BrowseSort,
} from './components/FacetPanel';
import { ImageGallery, VehicleSpecGrid } from './components/VehicleDetailParts';
import { ListingCtaPanel, MobileStickyApplyBar } from './components/ListingCtaPanel';
import { MarketplaceNav } from './components/MarketplaceNav';
import { ComparePage } from './pages/ComparePage';
import { HelpPage } from './pages/HelpPage';
import { CustomerDashboardPage } from './pages/CustomerDashboardPage';
import { PaymentCalendarPage } from './pages/PaymentCalendarPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ApplicationDetailPanel, type ApplicationDetailData } from './components/ApplicationDetailPanel';

function VehiclesBrowseRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/', search }} replace />;
}

function VehiclesPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [facetOpen, setFacetOpen] = useState(false);
  const browse = useMemo(() => parseBrowseParams(searchParams), [searchParams]);
  const browseKey = useMemo(
    () => JSON.stringify({ filters: browse.filters, sort: browse.sort }),
    [browse.filters, browse.sort],
  );
  const queryString = buildProductsQuery(browse.filters, {
    sort: browse.sort,
    offset: browse.offset,
    limit: browse.limit,
  });

  const [allItems, setAllItems] = useState<ProductListResponse['items']>([]);

  useEffect(() => {
    setAllItems([]);
  }, [browseKey]);

  const dealers = useQuery({
    queryKey: ['companies-public'],
    queryFn: () => apiFetch<PublicCompanyListResponse>('/api/companies?limit=100'),
  });

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['products', queryString],
    queryFn: () => apiFetch<ProductListResponse>(`/api/products${queryString}`),
  });

  useEffect(() => {
    if (!data?.items) return;
    if (browse.offset === 0) {
      setAllItems(data.items);
    } else {
      setAllItems((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        const next = [...prev];
        for (const item of data.items) {
          if (!ids.has(item.id)) next.push(item);
        }
        return next;
      });
    }
  }, [data, browse.offset]);

  function onSortChange(sort: BrowseSort) {
    const next = new URLSearchParams(searchParams);
    if (sort === 'newest') next.delete('sort');
    else next.set('sort', sort);
    next.delete('offset');
    setSearchParams(next);
  }

  function loadMore() {
    const next = new URLSearchParams(searchParams);
    next.set('offset', String(browse.offset + browse.limit));
    setSearchParams(next);
  }

  const shown = allItems.length > 0 ? allItems : data?.items ?? [];
  const total = data?.total ?? 0;
  const hasMore = total > browse.offset + (data?.items.length ?? 0);

  return (
    <div style={{ background: 'var(--dm-canvas)', minHeight: '100vh' }}>
      <DocumentMeta title={t('meta.vehiclesTitle')} />
      <div style={{ background: 'var(--dm-graphite-900)', color: '#fff', padding: '20px 24px' }}>
        <MarketplaceNav />
        <div style={{ paddingTop: 56 }}>
          <h1 style={{ fontFamily: 'var(--dm-font-display)', margin: '0 0 8px' }}>{t('vehicles.title')}</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)' }}>{t('vehicles.subtitle')}</p>
        </div>
      </div>
      <div className="blox-browse-layout">
        <FacetPanel dealers={dealers.data?.items ?? []} className="dm-facet-sidebar" />
        <div>
          <div className="dm-browse-toolbar">
            <FacetMobileTrigger dealers={dealers.data?.items ?? []} open={facetOpen} onOpenChange={setFacetOpen} />
            <label className="dm-browse-sort">
              <span>{t('vehicles.sort')}</span>
              <select value={browse.sort} onChange={(e) => onSortChange(e.target.value as BrowseSort)}>
                <option value="newest">{t('vehicles.sortNewest')}</option>
                <option value="price_asc">{t('vehicles.sortPriceAsc')}</option>
                <option value="price_desc">{t('vehicles.sortPriceDesc')}</option>
                <option value="year_desc">{t('vehicles.sortYearDesc')}</option>
                <option value="mileage_asc">{t('vehicles.sortMileageAsc')}</option>
              </select>
            </label>
          </div>
          {data && (
            <p style={{ color: 'var(--dm-slate-600)', marginTop: 0 }}>
              {shown.length > 0
                ? t('vehicles.showing', {
                    from: 1,
                    to: Math.min(shown.length, total),
                    total,
                  })
                : t('vehicles.count', { count: total })}
            </p>
          )}
          {isLoading && shown.length === 0 && <p>{t('vehicles.loading')}</p>}
          {error && <p style={{ color: 'var(--dm-danger)' }}>{(error as Error).message}</p>}
          {!isLoading && shown.length === 0 && (
            <p style={{ color: 'var(--dm-slate-600)' }}>{t('vehicles.noResults')}</p>
          )}
          <div className="dm-listing-stack">
            {shown.map((p) => (
              <ListingCard key={p.id} product={p} variant="row" />
            ))}
          </div>
          {hasMore && (
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <button type="button" className="dm-btn-ghost dm-btn-ghost--on-light" onClick={loadMore} disabled={isFetching}>
                {isFetching ? t('vehicles.loading') : t('vehicles.loadMore')}
              </button>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .dm-browse-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }
        .dm-browse-sort {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: var(--dm-slate-600);
        }
        .dm-browse-sort select {
          min-height: 40px;
          border-radius: 8px;
          border: 1px solid var(--dm-slate-200);
          padding: 0 10px;
          background: #fff;
        }
        .dm-facet-mobile-trigger {
          min-height: 40px;
          padding: 0 16px;
          border: 1px solid var(--dm-slate-200) !important;
          color: var(--dm-ink) !important;
        }
      `}</style>
    </div>
  );
}

function VehicleDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const locale = getAppLocale();
  const { data, isLoading } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => apiFetch<ProductDetailResponse>(`/api/products/by-slug/${slug}`),
    enabled: !!slug,
  });

  const product = data?.product;
  const offer = data?.offer;
  const company = data?.company;
  const images = data?.images ?? [];

  const [tenure, setTenure] = useState(36);
  const [downPct, setDownPct] = useState(10);

  useEffect(() => {
    if (offer?.min_down_payment_pct != null) setDownPct(Number(offer.min_down_payment_pct));
  }, [offer]);

  const monthly = useMemo(() => {
    if (!product || !offer) return 0;
    return buildPricingSnapshot({
      listPrice: product.price,
      annualRatePercent: offer.annual_rent_rate,
      minDownPaymentPct: Number(offer.min_down_payment_pct ?? 10),
      tenureMonths: tenure,
      downPaymentPct: downPct,
    }).monthly;
  }, [product, offer, downPct, tenure]);

  if (isLoading) return <p style={{ padding: 48 }}>{t('vehicles.loading')}</p>;
  if (!data?.available || !product) {
    return (
      <div style={{ padding: 48 }}>
        <DocumentMeta title={t('detail.unavailable')} />
        <MarketplaceNav />
        <h1 style={{ fontFamily: 'var(--dm-font-display)', paddingTop: 64 }}>{t('detail.unavailable')}</h1>
        <p>{t('detail.unavailableBody')}</p>
        <Link to="/">{t('detail.back')}</Link>
      </div>
    );
  }

  const metaTitle = t('meta.detailTitle', {
    make: product.make,
    model: product.model,
    year: product.model_year,
  });
  const metaDesc = t('meta.detailDescription', {
    make: product.make,
    model: product.model,
    year: product.model_year,
    price: formatQar(product.price, false, locale),
    dealer: company?.name ?? '',
  });

  return (
    <div style={{ background: 'var(--dm-canvas)', minHeight: '100vh' }}>
      <DocumentMeta title={metaTitle} description={metaDesc} />
      <div style={{ background: 'var(--dm-graphite-900)', height: 72 }}>
        <MarketplaceNav />
      </div>
      <div className="blox-detail-layout">
        <div>
          <ImageGallery images={images} />
          <h1 style={{ fontFamily: 'var(--dm-font-display)', marginBottom: 8 }}>
            {product.make} {product.model}
            {product.trim ? ` ${product.trim}` : ''}
          </h1>
          {company && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {company.logo_url && (
                <img src={company.logo_url} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
              )}
              <div>
                <div style={{ fontSize: 13, color: 'var(--dm-slate-600)' }}>{t('detail.soldBy')}</div>
                {company.code ? (
                  <Link to={`/dealers/${company.code}`} style={{ fontWeight: 600 }}>
                    {company.name}
                  </Link>
                ) : (
                  <span style={{ fontWeight: 600 }}>{company.name}</span>
                )}
              </div>
            </div>
          )}
          <p>{product.description}</p>
          <VehicleSpecGrid product={product} />
        </div>
        <ListingCtaPanel
          price={product.price}
          financeEligible={product.finance_eligible}
          availability={data.availability}
          companyCode={company?.code}
          companyName={company?.name}
          contactPhone={company?.contact_phone}
          listingTitle={`${product.make} ${product.model}${product.trim ? ` ${product.trim}` : ''} ${product.model_year}`}
          monthlyEstimate={offer ? monthly : null}
          onApply={() =>
            navigate(
              `/app/applications/new?product=${slug}&tenure=${tenure}&downPct=${downPct}`,
            )
          }
        >
          {offer && (
            <>
              <label style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>
                {t('detail.tenure')}
                <input
                  type="number"
                  min={MIN_TENURE_MONTHS}
                  max={MAX_TENURE_MONTHS}
                  value={tenure}
                  onChange={(e) => setTenure(clampTenureMonths(Number(e.target.value)))}
                  style={{ display: 'block', width: '100%', minHeight: 40, marginTop: 6 }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
                {t('detail.downPayment')}
                <input
                  type="number"
                  min={offer.min_down_payment_pct}
                  max={80}
                  value={downPct}
                  onChange={(e) => setDownPct(Number(e.target.value))}
                  style={{ display: 'block', width: '100%', minHeight: 40, marginTop: 6 }}
                />
              </label>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: 0 }}>{t('detail.estimateNote')}</p>
            </>
          )}
        </ListingCtaPanel>
      </div>
      <MobileStickyApplyBar
        price={product.price}
        financeEligible={product.finance_eligible}
        monthlyEstimate={offer ? monthly : null}
        contactPhone={company?.contact_phone}
        onApply={() =>
          navigate(`/app/applications/new?product=${slug}&tenure=${tenure}&downPct=${downPct}`)
        }
      />
    </div>
  );
}

function DealersDirectoryPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['companies-public'],
    queryFn: () => apiFetch<PublicCompanyListResponse>('/api/companies?limit=100'),
  });

  return (
    <div style={{ background: 'var(--dm-canvas)', minHeight: '100vh' }}>
      <DocumentMeta title={t('meta.dealersTitle')} />
      <div style={{ background: 'var(--dm-graphite-900)', color: '#fff', padding: '20px 24px' }}>
        <MarketplaceNav />
        <div style={{ paddingTop: 56 }}>
          <h1 style={{ fontFamily: 'var(--dm-font-display)', margin: '0 0 8px' }}>{t('dealers.title')}</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)' }}>{t('dealers.subtitle')}</p>
        </div>
      </div>
      <div style={{ width: '100%', margin: 0, padding: '24px 32px', boxSizing: 'border-box' }}>
        {isLoading && <p>{t('vehicles.loading')}</p>}
        {!isLoading && !data?.items?.length && <p style={{ color: 'var(--dm-slate-600)' }}>{t('dealers.empty')}</p>}
        <div style={{ display: 'grid', gap: 16 }}>
          {data?.items?.filter((d) => (d.published_count ?? 0) > 0).map((d) => (
            <Link
              key={d.id}
              to={d.code ? `/dealers/${d.code}` : '/vehicles'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: 20,
                background: 'var(--dm-surface)',
                borderRadius: 16,
                border: '1px solid var(--dm-slate-200)',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              {d.logo_url ? (
                <img src={d.logo_url} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--dm-slate-100)' }} />
              )}
              <div>
                <div style={{ fontFamily: 'var(--dm-font-display)', fontSize: 18, fontWeight: 600 }}>{d.name}</div>
                <div style={{ color: 'var(--dm-slate-600)', fontSize: 13 }}>
                  {t('dealers.listings', { count: d.published_count ?? 0 })}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function DealerShowroomPage() {
  const { code } = useParams();
  const { t } = useTranslation();
  const company = useQuery({
    queryKey: ['company-by-code', code],
    queryFn: () => apiFetch<PublicCompany & { address?: string; contact_phone?: string } | null>(`/api/companies/by-code/${code}`),
    enabled: !!code,
  });

  const products = useQuery({
    queryKey: ['products', 'company', company.data?.id],
    queryFn: () => apiFetch<ProductListResponse>(`/api/products?companyId=${company.data!.id}`),
    enabled: !!company.data?.id,
  });

  if (company.isLoading) return <p style={{ padding: 48 }}>{t('vehicles.loading')}</p>;
  if (!company.data) return <Navigate to="/dealers" replace />;

  const c = company.data;
  const metaTitle = t('meta.showroomTitle', { name: c.name });

  return (
    <div style={{ background: 'var(--dm-canvas)', minHeight: '100vh' }}>
      <DocumentMeta title={metaTitle} />
      <div style={{ background: 'var(--dm-graphite-900)', color: '#fff', padding: '20px 24px' }}>
        <MarketplaceNav />
        <div style={{ paddingTop: 56, display: 'flex', alignItems: 'center', gap: 16 }}>
          {c.logo_url && <img src={c.logo_url} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} />}
          <div>
            <h1 style={{ fontFamily: 'var(--dm-font-display)', margin: '0 0 8px' }}>{t('dealers.showroomTitle', { name: c.name })}</h1>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)' }}>{t('dealers.showroomBody')}</p>
          </div>
        </div>
      </div>
      <div style={{ width: '100%', margin: 0, padding: '24px 32px', boxSizing: 'border-box' }}>
        <p style={{ color: 'var(--dm-slate-600)' }}>{t('dealers.listings', { count: products.data?.total ?? 0 })}</p>
        <div className="dm-listing-stack">
          {products.data?.items.map((p) => (
            <ListingCard key={p.id} product={p} variant="row" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ApplyWizardPage() {
  const [params] = useSearchParams();
  const productSlug = params.get('product') || '';
  const tenureParam = Number(params.get('tenure') || 36);
  const downPctParam = Number(params.get('downPct') || 10);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const locale = getAppLocale();
  const detail = useQuery({
    queryKey: ['product', productSlug],
    queryFn: () => apiFetch<ProductDetailResponse>(`/api/products/by-slug/${productSlug}`),
    enabled: !!productSlug,
  });
  const product = detail.data?.product;
  const offer = detail.data?.offer;

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [qid, setQid] = useState('');
  const [employment, setEmployment] = useState('');
  const [income, setIncome] = useState('');
  // Collected so a website application reaches the finance partner with the
  // same detail a dealer-entered one carries. Nationality is required because
  // the partner keeps separate salary fields for Qatari and expatriate
  // applicants — without it the figure is filed under the wrong one.
  const [nationality, setNationality] = useState('');
  const [city, setCity] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [employmentDuration, setEmploymentDuration] = useState('');
  const [tenure, setTenure] = useState(tenureParam);
  const [downPct, setDownPct] = useState(downPctParam);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!offer) return;
    const minDown = Number(offer.min_down_payment_pct ?? 10);
    setDownPct((prev) => Math.max(prev, minDown));
    setTenure((prev) => clampTenureMonths(prev || tenureParam));
  }, [offer, tenureParam]);

  const monthlyPreview = useMemo(() => {
    if (!product || !offer) return 0;
    return buildPricingSnapshot({
      listPrice: product.price,
      annualRatePercent: offer.annual_rent_rate,
      minDownPaymentPct: Number(offer.min_down_payment_pct ?? 10),
      tenureMonths: tenure,
      downPaymentPct: downPct,
    }).monthly;
  }, [product, offer, downPct, tenure]);

  useEffect(() => {
    if (!product?.id) return;
    trackProductEvent('application_started', {
      product_id: product.id,
      company_id: product.company_id,
      source: 'wizard_open',
    });
  }, [product?.id, product?.company_id]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!product || !offer) throw new Error('listing_not_available');
      const minDown = Number(offer.min_down_payment_pct ?? 0);
      const pricingSnapshot = buildPricingSnapshot({
        listPrice: product.price,
        annualRatePercent: offer.annual_rent_rate,
        minDownPaymentPct: minDown,
        tenureMonths: tenure,
        downPaymentPct: Math.max(downPct, minDown),
      });
      return apiFetch<{ id: string }>('/api/applications', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          offerId: offer.id,
          quoteToken: params.get('quote') || undefined,
          // Same shape buildCustomerSnapshot produces for the dealer journey,
          // so zoho-lead.mapper reads both identically and the partner gets the
          // same lead whichever channel it came through.
          customerSnapshot: {
            full_name: fullName,
            phone,
            qid,
            applicantType: 'individual',
            nationality: nationality.trim() || undefined,
            city: city.trim() || undefined,
            address: city.trim() ? { city: city.trim() } : undefined,
            employment: {
              company: employment.trim() || undefined,
              employmentType: employmentType || undefined,
              employmentDuration: employmentDuration || undefined,
              salary: Number(income) || undefined,
            },
            income: Number(income) || 0,
            monthlyIncome: Number(income) || undefined,
          },
          pricingSnapshot,
        }),
      });
    },
    onSuccess: (app: { id: string }) => {
      void qc.invalidateQueries({ queryKey: ['products'] });
      navigate(`/app/applications/${app.id}`);
    },
    onError: (e: Error) => {
      const msg = e.message;
      if (msg.includes('blocking_application') || msg.includes('409')) {
        setError(t('application.blockingApplication'));
        return;
      }
      setError(msg);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  if (!productSlug) return <Navigate to="/" replace />;

  return (
    <div style={{ background: 'var(--dm-canvas)', minHeight: '100vh' }}>
      <div style={{ background: 'var(--dm-graphite-900)', height: 72 }}>
        <MarketplaceNav />
      </div>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 32 }}>
        <h1 style={{ fontFamily: 'var(--dm-font-display)' }}>{t('detail.apply')}</h1>
        {product && (
          <p style={{ color: 'var(--dm-slate-600)' }}>
            {product.make} {product.model} · <MoneyText>{formatQar(product.price, false, locale)}</MoneyText>
          </p>
        )}
        <p className="dm-apply-next" style={{ color: 'var(--dm-slate-600)', fontSize: 14, lineHeight: 1.55 }}>
          {t('application.nextSteps')}
        </p>
        {offer && product && (
          <div
            style={{
              marginTop: 16,
              padding: 16,
              borderRadius: 12,
              background: 'var(--dm-surface)',
              border: '1px solid var(--dm-slate-200)',
              display: 'grid',
              gap: 12,
            }}
          >
            <label style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: 14, color: 'var(--dm-slate-600)' }}>
              {t('detail.tenure')}
              <input
                type="number"
                min={MIN_TENURE_MONTHS}
                max={MAX_TENURE_MONTHS}
                value={tenure}
                onChange={(e) => setTenure(clampTenureMonths(Number(e.target.value)))}
                style={{ minHeight: 44, padding: '0 12px', borderRadius: 8, border: '1px solid var(--dm-slate-200)' }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: 14, color: 'var(--dm-slate-600)' }}>
              {t('detail.downPayment')}
              <input
                type="number"
                min={offer.min_down_payment_pct}
                max={80}
                value={downPct}
                onChange={(e) => setDownPct(Number(e.target.value))}
                style={{ minHeight: 44, padding: '0 12px', borderRadius: 8, border: '1px solid var(--dm-slate-200)' }}
              />
            </label>
            <p style={{ margin: 0, fontSize: 14 }}>
              {t('detail.estMonthly')}:{' '}
              <MoneyText>{formatQar(monthlyPreview, true, locale)}</MoneyText>
            </p>
          </div>
        )}
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, marginTop: 24 }}>
          {(
            [
              { labelKey: 'apply.fullName', value: fullName, setter: setFullName, required: true },
              { labelKey: 'apply.phone', value: phone, setter: setPhone, required: true },
              { labelKey: 'apply.qid', value: qid, setter: setQid, required: true },
              { labelKey: 'apply.nationality', value: nationality, setter: setNationality, required: true },
              { labelKey: 'apply.city', value: city, setter: setCity, required: false },
              { labelKey: 'apply.employment', value: employment, setter: setEmployment, required: false },
              { labelKey: 'apply.monthlyIncome', value: income, setter: setIncome, required: false },
            ] as const
          ).map(({ labelKey, value, setter, required }) => (
            <label key={labelKey} style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: 14, color: 'var(--dm-slate-600)' }}>
              {t(labelKey)}
              <input
                required={required}
                value={value}
                onChange={(e) => setter(e.target.value)}
                style={{ minHeight: 44, padding: '0 12px', borderRadius: 8, border: '1px solid var(--dm-slate-200)' }}
              />
            </label>
          ))}
          {/* The same option lists the dealer journey uses, so the two channels
              cannot drift into different vocabularies for the same question. */}
          {(
            [
              { labelKey: 'apply.employmentType', value: employmentType, setter: setEmploymentType, options: EMPLOYMENT_TYPE_OPTIONS },
              { labelKey: 'apply.employmentDuration', value: employmentDuration, setter: setEmploymentDuration, options: EMPLOYMENT_DURATION_OPTIONS },
            ] as const
          ).map(({ labelKey, value, setter, options }) => (
            <label key={labelKey} style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: 14, color: 'var(--dm-slate-600)' }}>
              {t(labelKey)}
              <select
                value={value}
                onChange={(e) => setter(e.target.value)}
                style={{ minHeight: 44, padding: '0 12px', borderRadius: 8, border: '1px solid var(--dm-slate-200)', background: '#fff' }}
              >
                <option value="">{t('apply.selectPlaceholder')}</option>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
                ))}
              </select>
            </label>
          ))}
          {error && <p style={{ color: 'var(--dm-danger)' }}>{error}</p>}
          <button type="submit" className="dm-btn-cta" disabled={mutation.isPending}>
            {mutation.isPending ? t('vehicles.loading') : t('detail.apply')}
          </button>
        </form>
      </div>
    </div>
  );
}

function ApplicationsListPage() {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const { data, isLoading } = useQuery({
    queryKey: ['my-apps'],
    queryFn: () =>
      apiFetch<{
        total: number;
        items: Array<{
          id: string;
          status: string;
          created_at: string;
          product: { make: string; model: string; model_year: number; slug: string };
        }>;
      }>('/api/applications/mine?limit=100'),
  });
  const apps = data?.items ?? [];

  return (
    <div style={{ background: 'var(--dm-canvas)', minHeight: '100vh' }}>
      <div style={{ background: 'var(--dm-graphite-900)', height: 72 }}>
        <MarketplaceNav />
      </div>
      <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--dm-font-display)' }}>{t('application.title')}</h1>
        {isLoading && <p>{t('vehicles.loading')}</p>}
        {!isLoading && !apps.length && (
          <p style={{ color: 'var(--dm-slate-600)' }}>
            {t('application.empty')}{' '}
            <Link to="/">{t('application.browse')}</Link>
          </p>
        )}
        <ul className="dm-app-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
          {apps.map((a) => (
            <li key={a.id}>
              <Link to={`/app/applications/${a.id}`} className="dm-app-list__item">
                <div>
                  <strong>
                    {a.product.make} {a.product.model}
                    {a.product.model_year ? ` · ${a.product.model_year}` : ''}
                  </strong>
                  <div style={{ fontSize: 13, color: 'var(--dm-slate-600)', marginTop: 4 }}>
                    {new Date(a.created_at).toLocaleDateString(locale === 'ar' ? 'ar-QA' : 'en-QA')}
                  </div>
                </div>
                <span className={`dm-status-pill dm-status-pill--${applicationMarketplacePillVariant(a.status)}`}>
                  {t(`application.status.${a.status}`, { defaultValue: applicationStatusLabel(a.status) })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <style>{`
        .dm-app-list__item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 20px;
          background: var(--dm-surface);
          border: 1px solid var(--dm-slate-200);
          border-radius: 12px;
          text-decoration: none;
          color: inherit;
        }
        .dm-app-list__item:hover { border-color: var(--dm-steel); }
        .dm-status-pill {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }
        .dm-status-pill--approved { background: var(--dm-success-soft); color: var(--dm-success); }
        .dm-status-pill--pending { background: var(--dm-steel-soft); color: var(--dm-ink); }
        .dm-status-pill--rejected { background: var(--dm-danger-soft); color: var(--dm-danger); }
      `}</style>
    </div>
  );
}

function QuoteRedeemPage() {
  const { token } = useParams();
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({
    queryKey: ['quote', token],
    queryFn: () =>
      apiFetch<{
        gate: string;
        product?: {
          slug: string;
          make: string;
          model: string;
          model_year?: number;
          public_list_price?: number;
          image_path?: string | null;
          finance_eligible?: boolean;
          listing_status?: string;
        };
        negotiated_price?: number;
        customer_email_masked?: string;
      }>(`/api/quotes/${token}`),
    enabled: !!token,
  });

  if (isLoading) return <p>{t('vehicles.loading')}</p>;
  if (error || !data || data.gate !== 'active') {
    return (
      <div className="dm-home">
        <MarketplaceNav />
        <div style={{ padding: 32, maxWidth: 640, margin: '0 auto' }}>
          <h1>{t('quote.unavailableTitle')}</h1>
          <p>{t('quote.unavailableBody')}</p>
          <Link to="/">{t('quote.browse')}</Link>
        </div>
      </div>
    );
  }

  const product = data.product!;
  return (
    <div className="dm-home">
      <MarketplaceNav />
      <div style={{ padding: 32, maxWidth: 640, margin: '0 auto' }}>
        <h1>{t('quote.title')}</h1>
        <p>
          {product.make} {product.model} {product.model_year ?? ''}
        </p>
        {data.negotiated_price != null && (
          <p>
            {t('quote.negotiatedPrice')}: <MoneyText>{formatQar(data.negotiated_price, false, getAppLocale())}</MoneyText>
          </p>
        )}
        <Link
          className="dm-btn-cta"
          to={`/app/applications/new?product=${product.slug}&quote=${token}`}
          style={{ display: 'inline-block', marginTop: 16 }}
        >
          {t('quote.continueApply')}
        </Link>
      </div>
    </div>
  );
}

function ApplicationDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['app', id],
    queryFn: () => apiFetch<ApplicationDetailData>(`/api/applications/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    const skipcashKey = searchParams.get('skipcash_key');
    if (!skipcashKey || !id) return;
    void (async () => {
      try {
        await apiFetch('/api/payments/skipcash/complete', {
          method: 'POST',
          body: JSON.stringify({ idempotency_key: skipcashKey }),
        });
        void qc.invalidateQueries({ queryKey: ['app', id] });
      } catch {
        /* optional sandbox completion */
      }
    })();
  }, [searchParams, id, qc]);

  return (
    <div style={{ background: 'var(--dm-canvas)', minHeight: '100vh' }}>
      <div style={{ background: 'var(--dm-graphite-900)', height: 72 }}>
        <MarketplaceNav />
      </div>
      <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
        <p style={{ margin: '0 0 16px' }}>
          <Link to="/app/applications">← {t('application.title')}</Link>
        </p>
        {isLoading && <p>{t('vehicles.loading')}</p>}
        {data && <ApplicationDetailPanel app={data} />}
      </div>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<VehiclesPage />} />
      <Route path="/vehicles" element={<VehiclesBrowseRedirect />} />
      <Route path="/vehicles/:slug" element={<VehicleDetailPage />} />
      <Route path="/dealers" element={<DealersDirectoryPage />} />
      <Route path="/dealers/:code" element={<DealerShowroomPage />} />
      <Route path="/compare" element={<ComparePage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/quotes/:token" element={<QuoteRedeemPage />} />
      <Route
        path="/auth/login"
        element={
          <GuestGuard>
            <LoginPage portalLabel="Customer marketplace" homePath="/app/dashboard" allowSignUp showMarketplaceLink />
          </GuestGuard>
        }
      />
      <Route
        path="/auth/register"
        element={
          <GuestGuard>
            <RegisterPage homePath="/app/dashboard" />
          </GuestGuard>
        }
      />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/auth/verify-email"
        element={<VerifyEmailPage portalLabel="Customer marketplace" homePath="/app/dashboard" />}
      />
      <Route path="/app/dashboard" element={<AuthGuard allowedRole="customer" reasonParam="not_customer" requireVerifiedEmail><CustomerDashboardPage /></AuthGuard>} />
      <Route path="/app/calendar" element={<AuthGuard allowedRole="customer" reasonParam="not_customer" requireVerifiedEmail><PaymentCalendarPage /></AuthGuard>} />
      <Route path="/app/notifications" element={<AuthGuard allowedRole="customer" reasonParam="not_customer" requireVerifiedEmail><NotificationsPage /></AuthGuard>} />
      <Route path="/app/applications" element={<AuthGuard allowedRole="customer" reasonParam="not_customer" requireVerifiedEmail><ApplicationsListPage /></AuthGuard>} />
      <Route path="/app/applications/new" element={<AuthGuard allowedRole="customer" reasonParam="not_customer" requireVerifiedEmail><ApplyWizardPage /></AuthGuard>} />
      <Route path="/app/applications/:id" element={<AuthGuard allowedRole="customer" reasonParam="not_customer" requireVerifiedEmail><ApplicationDetailPage /></AuthGuard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
