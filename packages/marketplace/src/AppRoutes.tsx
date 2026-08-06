import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  AuthGuard,
  GuestGuard,
  LoginPage,
  RegisterPage,
  MoneyText,
  DocumentMeta,
  apiFetch,
  bloxMeta,
  estimateMonthlyPayment,
  formatQar,
  getAppLocale,
  type ProductDetailResponse,
  type ProductListResponse,
  type PublicCompany,
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
import { ApplicationStatusView } from './components/ApplicationStatusView';

function HomePage() {
  const { t } = useTranslation();
  const { data: arrivals } = useQuery({
    queryKey: ['products', 'new-arrivals'],
    queryFn: () => apiFetch<ProductListResponse>('/api/products?sort=newest&limit=8'),
  });

  return (
    <div className="dm-home">
      <DocumentMeta title={t('meta.homeTitle')} />
      <MarketplaceNav />
      <section className="dm-hero" aria-label="Blox hero">
        <div className="dm-hero__media" role="img" aria-label="Vehicle on a coastal road at dusk" />
        <div className="dm-hero__scrim" />
        <div className="dm-hero__content">
          <p className="dm-hero__brand">{bloxMeta.name}</p>
          <h1 className="dm-hero__headline">{t('home.headline')}</h1>
          <p className="dm-hero__support">{t('home.support')}</p>
          <div className="dm-hero__ctas">
            <Link className="dm-btn-cta" to="/vehicles">
              {t('home.browse')}
            </Link>
            <Link className="dm-btn-ghost" to="/help">
              {t('home.howItWorks')}
            </Link>
          </div>
        </div>
      </section>
      {(arrivals?.items.length ?? 0) > 0 && (
        <section className="dm-new-arrivals">
          <div className="dm-new-arrivals__head">
            <div>
              <h2>{t('home.newArrivals')}</h2>
              <p>{t('home.newArrivalsBody')}</p>
            </div>
            <Link to="/vehicles?sort=newest">{t('home.viewAll')}</Link>
          </div>
          <div className="dm-new-arrivals__grid">
            {arrivals!.items.map((p) => (
              <ListingCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
      <section className="dm-below">
        <h2>{t('home.readyTitle')}</h2>
        <p>{t('home.readyBody')}</p>
        <Link to="/vehicles">{t('home.goSearch')}</Link>
      </section>
      <style>{`
        .dm-hero { position: relative; min-height: 100vh; min-height: 100dvh; display: flex; align-items: flex-end; color: #fff; overflow: hidden; }
        .dm-hero__media { position: absolute; inset: 0; background: linear-gradient(120deg, rgba(15,63,69,0.25), transparent 45%), url('https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=2400&q=80') center / cover no-repeat; }
        .dm-hero__scrim { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(15,63,69,0.88) 0%, rgba(22,83,91,0.6) 42%, rgba(22,83,91,0.2) 100%); }
        .dm-hero__content { position: relative; z-index: 1; max-width: 640px; padding: 120px 24px 72px; animation: dm-fade 200ms var(--dm-ease) both; }
        .dm-hero__brand { margin: 0 0 12px; font-family: var(--dm-font-display); font-size: clamp(2.75rem, 6vw, 4rem); font-weight: 600; line-height: 1.05; letter-spacing: -0.02em; }
        .dm-hero__headline { margin: 0 0 16px; font-family: var(--dm-font-display); font-size: clamp(1.75rem, 3.5vw, 2.35rem); font-weight: 600; line-height: 1.15; max-width: 18ch; }
        .dm-hero__support { margin: 0 0 28px; max-width: 42ch; color: rgba(255,255,255,0.82); font-size: 1.05rem; line-height: 1.5; }
        .dm-hero__ctas { display: flex; flex-wrap: wrap; gap: 12px; }
        .dm-below { padding: 64px 24px; max-width: 720px; }
        .dm-below h2 { font-family: var(--dm-font-display); font-size: 1.75rem; margin: 0 0 12px; }
        .dm-below p { color: var(--dm-slate-600); line-height: 1.55; }
        .dm-new-arrivals {
          padding: 48px 24px 32px;
          border-top: 1px solid var(--dm-slate-200);
          background: var(--dm-canvas);
        }
        .dm-new-arrivals__head {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          max-width: 1200px;
          margin: 0 auto 24px;
        }
        .dm-new-arrivals__head h2 {
          margin: 0 0 8px;
          font-family: var(--dm-font-display);
          font-size: 1.75rem;
        }
        .dm-new-arrivals__head p { margin: 0; color: var(--dm-slate-600); max-width: 42ch; }
        .dm-new-arrivals__head a { font-weight: 600; color: var(--dm-steel); }
        .dm-new-arrivals__grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        @keyframes dm-fade { from { opacity: 0; } to { opacity: 1; } }
        @media (max-width: 640px) { .dm-hero__content { padding: 100px 20px 56px; } .dm-hero__ctas .dm-btn-cta, .dm-hero__ctas .dm-btn-ghost { width: 100%; } }
      `}</style>
    </div>
  );
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
    queryFn: () => apiFetch<PublicCompany[]>('/api/companies'),
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
        <FacetPanel dealers={dealers.data ?? []} className="dm-facet-sidebar" />
        <div>
          <div className="dm-browse-toolbar">
            <FacetMobileTrigger dealers={dealers.data ?? []} open={facetOpen} onOpenChange={setFacetOpen} />
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
            {shown.map((p) => (
              <ListingCard key={p.id} product={p} />
            ))}
          </div>
          {hasMore && (
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <button type="button" className="dm-btn-ghost" onClick={loadMore} disabled={isFetching}>
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
    if (offer?.tenure_options?.length) setTenure(Number(offer.tenure_options[2] ?? offer.tenure_options[0]));
  }, [offer]);

  const monthly = useMemo(() => {
    if (!product || !offer) return 0;
    const down = (product.price * downPct) / 100;
    return estimateMonthlyPayment({
      price: product.price,
      downPayment: down,
      annualRatePercent: offer.annual_rent_rate,
      tenureMonths: tenure,
    });
  }, [product, offer, downPct, tenure]);

  if (isLoading) return <p style={{ padding: 48 }}>{t('vehicles.loading')}</p>;
  if (!data?.available || !product) {
    return (
      <div style={{ padding: 48 }}>
        <DocumentMeta title={t('detail.unavailable')} />
        <MarketplaceNav />
        <h1 style={{ fontFamily: 'var(--dm-font-display)', paddingTop: 64 }}>{t('detail.unavailable')}</h1>
        <p>{t('detail.unavailableBody')}</p>
        <Link to="/vehicles">{t('detail.back')}</Link>
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
                <select value={tenure} onChange={(e) => setTenure(Number(e.target.value))} style={{ display: 'block', width: '100%', minHeight: 40, marginTop: 6 }}>
                  {(offer.tenure_options || [12, 24, 36, 48, 60]).map((mo) => (
                    <option key={mo} value={mo}>{mo}</option>
                  ))}
                </select>
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
    queryFn: () => apiFetch<PublicCompany[]>('/api/companies'),
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
        {!isLoading && !data?.length && <p style={{ color: 'var(--dm-slate-600)' }}>{t('dealers.empty')}</p>}
        <div style={{ display: 'grid', gap: 16 }}>
          {data?.filter((d) => (d.published_count ?? 0) > 0).map((d) => (
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
          {products.data?.items.map((p) => (
            <ListingCard key={p.id} product={p} />
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
  const [tenure, setTenure] = useState(tenureParam);
  const [downPct, setDownPct] = useState(downPctParam);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!offer) return;
    const minDown = Number(offer.min_down_payment_pct ?? 10);
    setDownPct((prev) => Math.max(prev, minDown));
    const options = offer.tenure_options?.map(Number) ?? [12, 24, 36, 48, 60];
    if (!options.includes(tenure)) {
      setTenure(options.includes(36) ? 36 : options[0]);
    }
  }, [offer, tenure]);

  const monthlyPreview = useMemo(() => {
    if (!product || !offer) return 0;
    const down = (product.price * downPct) / 100;
    return estimateMonthlyPayment({
      price: product.price,
      downPayment: down,
      annualRatePercent: offer.annual_rent_rate,
      tenureMonths: tenure,
    });
  }, [product, offer, downPct, tenure]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!product || !offer) throw new Error('listing_not_available');
      const minDown = Number(offer.min_down_payment_pct ?? 0);
      const safeDownPct = Math.max(downPct, minDown);
      const down = (product.price * safeDownPct) / 100;
      const monthly = estimateMonthlyPayment({
        price: product.price,
        downPayment: down,
        annualRatePercent: offer.annual_rent_rate,
        tenureMonths: tenure,
      });
      return apiFetch<{ id: string }>('/api/applications', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          offerId: offer.id,
          customerSnapshot: {
            full_name: fullName,
            phone,
            qid,
            employment,
            income: Number(income) || 0,
          },
          pricingSnapshot: {
            list_price: product.price,
            down_payment: down,
            down_payment_pct: safeDownPct,
            tenor: tenure,
            rate: offer.annual_rent_rate,
            monthly: Math.round(monthly),
          },
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
        setError('You already have an active application. Finish or withdraw it before applying again.');
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

  if (!productSlug) return <Navigate to="/vehicles" replace />;

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
              <select
                value={tenure}
                onChange={(e) => setTenure(Number(e.target.value))}
                style={{ minHeight: 44, padding: '0 12px', borderRadius: 8, border: '1px solid var(--dm-slate-200)' }}
              >
                {(offer.tenure_options || [12, 24, 36, 48, 60]).map((mo) => (
                  <option key={mo} value={mo}>
                    {mo}
                  </option>
                ))}
              </select>
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
              <MoneyText>{formatQar(Math.round(monthlyPreview), true, locale)}</MoneyText>
            </p>
          </div>
        )}
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, marginTop: 24 }}>
          {(['Full name', 'Phone', 'QID', 'Employment', 'Monthly income (QAR)'] as const).map((label, i) => {
            const setters = [setFullName, setPhone, setQid, setEmployment, setIncome];
            const values = [fullName, phone, qid, employment, income];
            return (
              <label key={label} style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: 14, color: 'var(--dm-slate-600)' }}>
                {label}
                <input
                  required={i < 3}
                  value={values[i]}
                  onChange={(e) => setters[i](e.target.value)}
                  style={{ minHeight: 44, padding: '0 12px', borderRadius: 8, border: '1px solid var(--dm-slate-200)' }}
                />
              </label>
            );
          })}
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
      apiFetch<
        Array<{
          id: string;
          status: string;
          createdAt: string;
          product: { make: string; model: string; modelYear: number; slug: string };
        }>
      >('/api/applications/mine'),
  });

  function statusVariant(status: string) {
    if (status === 'active' || status === 'completed') return 'approved';
    if (status === 'rejected' || status === 'submission_cancelled') return 'rejected';
    return 'pending';
  }

  return (
    <div style={{ background: 'var(--dm-canvas)', minHeight: '100vh' }}>
      <div style={{ background: 'var(--dm-graphite-900)', height: 72 }}>
        <MarketplaceNav />
      </div>
      <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--dm-font-display)' }}>{t('application.title')}</h1>
        {isLoading && <p>{t('vehicles.loading')}</p>}
        {!isLoading && !data?.length && (
          <p style={{ color: 'var(--dm-slate-600)' }}>
            {t('application.empty')}{' '}
            <Link to="/vehicles">{t('application.browse')}</Link>
          </p>
        )}
        <ul className="dm-app-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
          {data?.map((a) => (
            <li key={a.id}>
              <Link to={`/app/applications/${a.id}`} className="dm-app-list__item">
                <div>
                  <strong>
                    {a.product.make} {a.product.model}
                    {a.product.modelYear ? ` · ${a.product.modelYear}` : ''}
                  </strong>
                  <div style={{ fontSize: 13, color: 'var(--dm-slate-600)', marginTop: 4 }}>
                    {new Date(a.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-QA' : 'en-QA')}
                  </div>
                </div>
                <span className={`dm-status-pill dm-status-pill--${statusVariant(a.status)}`}>
                  {t(`application.status.${a.status}`, { defaultValue: a.status })}
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

function ApplicationDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['app', id],
    queryFn: () =>
      apiFetch<{
        id: string;
        status: string;
        createdAt: string;
        pricingSnapshot?: Record<string, unknown>;
        rejectionReason?: string | null;
        resubmissionComment?: string | null;
        product?: { make?: string; model?: string; slug?: string; modelYear?: number };
      }>(`/api/applications/${id}`),
    enabled: !!id,
  });

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
        {data && <ApplicationStatusView app={data} />}
      </div>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/vehicles" element={<VehiclesPage />} />
      <Route path="/vehicles/:slug" element={<VehicleDetailPage />} />
      <Route path="/dealers" element={<DealersDirectoryPage />} />
      <Route path="/dealers/:code" element={<DealerShowroomPage />} />
      <Route path="/compare" element={<ComparePage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route
        path="/auth/login"
        element={
          <GuestGuard>
            <LoginPage portalLabel="Customer marketplace" homePath="/app/dashboard" allowSignUp />
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
      <Route path="/app/dashboard" element={<AuthGuard allowedRole="customer" reasonParam="not_customer"><CustomerDashboardPage /></AuthGuard>} />
      <Route path="/app/applications" element={<AuthGuard allowedRole="customer" reasonParam="not_customer"><ApplicationsListPage /></AuthGuard>} />
      <Route path="/app/applications/new" element={<AuthGuard allowedRole="customer" reasonParam="not_customer"><ApplyWizardPage /></AuthGuard>} />
      <Route path="/app/applications/:id" element={<AuthGuard allowedRole="customer" reasonParam="not_customer"><ApplicationDetailPage /></AuthGuard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
