import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AuthGuard,
  GuestGuard,
  LoginPage,
  MarketplaceTopNav,
  MoneyText,
  apiFetch,
  brandMeta,
  estimateMonthlyPayment,
  formatQar,
} from '@drivemarket/shared';

function HomePage() {
  return (
    <div className="dm-home">
      <MarketplaceTopNav />
      <section className="dm-hero" aria-label="DriveMarket hero">
        <div className="dm-hero__media" role="img" aria-label="Vehicle on a coastal road at dusk" />
        <div className="dm-hero__scrim" />
        <div className="dm-hero__content">
          <p className="dm-hero__brand">{brandMeta.name}</p>
          <h1 className="dm-hero__headline">Find the car. Finance it clearly.</h1>
          <p className="dm-hero__support">
            Browse dealer inventory across Qatar, estimate installments in QAR, and apply from the
            listing — one shared financing pipeline.
          </p>
          <div className="dm-hero__ctas">
            <Link className="dm-btn-cta" to="/vehicles">
              Browse vehicles
            </Link>
            <Link className="dm-btn-ghost" to="/help">
              How financing works
            </Link>
          </div>
        </div>
      </section>
      <section className="dm-below">
        <h2>Ready when you are</h2>
        <p>
          Search published listings, compare options, and start an application only when you are
          signed in.
        </p>
        <Link to="/vehicles">Go to search</Link>
      </section>
      <style>{`
        .dm-hero { position: relative; min-height: 100vh; min-height: 100dvh; display: flex; align-items: flex-end; color: #fff; overflow: hidden; }
        .dm-hero__media { position: absolute; inset: 0; background: linear-gradient(120deg, rgba(11,18,21,0.25), transparent 45%), url('https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=2400&q=80') center / cover no-repeat; }
        .dm-hero__scrim { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(11,18,21,0.82) 0%, rgba(11,18,21,0.55) 42%, rgba(11,18,21,0.2) 100%); }
        .dm-hero__content { position: relative; z-index: 1; max-width: 640px; padding: 120px 24px 72px; animation: dm-fade 200ms var(--dm-ease) both; }
        .dm-hero__brand { margin: 0 0 12px; font-family: var(--dm-font-display); font-size: clamp(2.75rem, 6vw, 4rem); font-weight: 600; line-height: 1.05; letter-spacing: -0.02em; }
        .dm-hero__headline { margin: 0 0 16px; font-family: var(--dm-font-display); font-size: clamp(1.75rem, 3.5vw, 2.35rem); font-weight: 600; line-height: 1.15; max-width: 18ch; }
        .dm-hero__support { margin: 0 0 28px; max-width: 42ch; color: rgba(255,255,255,0.82); font-size: 1.05rem; line-height: 1.5; }
        .dm-hero__ctas { display: flex; flex-wrap: wrap; gap: 12px; }
        .dm-below { padding: 64px 24px; max-width: 720px; }
        .dm-below h2 { font-family: var(--dm-font-display); font-size: 1.75rem; margin: 0 0 12px; }
        .dm-below p { color: var(--dm-slate-600); line-height: 1.55; }
        @keyframes dm-fade { from { opacity: 0; } to { opacity: 1; } }
        @media (max-width: 640px) { .dm-hero__content { padding: 100px 20px 56px; } .dm-hero__ctas .dm-btn-cta, .dm-hero__ctas .dm-btn-ghost { width: 100%; } }
      `}</style>
    </div>
  );
}

type ProductCard = {
  id: string;
  slug: string;
  make: string;
  model: string;
  model_year: number;
  price: number;
  primary_image: string | null;
  company_name: string;
  finance_eligible: boolean;
};

function VehiclesPage() {
  const [q, setQ] = useState('');
  const [make, setMake] = useState('');
  const { data, isLoading, error } = useQuery({
    queryKey: ['products', q, make],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (make) params.set('make', make);
      return apiFetch<{ total: number; items: ProductCard[] }>(`/api/products?${params}`);
    },
  });

  return (
    <div style={{ background: 'var(--dm-canvas)', minHeight: '100vh' }}>
      <div style={{ background: 'var(--dm-graphite-900)', color: '#fff', padding: '20px 24px' }}>
        <MarketplaceTopNav />
        <div style={{ paddingTop: 56 }}>
          <h1 style={{ fontFamily: 'var(--dm-font-display)', margin: '0 0 8px' }}>Vehicles</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)' }}>Published listings only · QAR</p>
        </div>
      </div>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          <input
            placeholder="Search make or model"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minHeight: 44, padding: '0 12px', borderRadius: 8, border: '1px solid var(--dm-slate-200)', minWidth: 220 }}
          />
          <input
            placeholder="Make filter"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            style={{ minHeight: 44, padding: '0 12px', borderRadius: 8, border: '1px solid var(--dm-slate-200)' }}
          />
        </div>
        {isLoading && <p>Loading…</p>}
        {error && <p style={{ color: 'var(--dm-danger)' }}>{(error as Error).message}</p>}
        {!isLoading && data?.items.length === 0 && (
          <p style={{ color: 'var(--dm-slate-600)' }}>No vehicles match these filters.</p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
          {data?.items.map((p) => (
            <Link
              key={p.id}
              to={`/vehicles/${p.slug}`}
              style={{
                textDecoration: 'none',
                color: 'inherit',
                background: 'var(--dm-surface)',
                borderRadius: 16,
                overflow: 'hidden',
                border: '1px solid var(--dm-slate-200)',
                boxShadow: 'var(--dm-shadow-1)',
                transition: 'transform 180ms var(--dm-ease)',
              }}
            >
              <div
                style={{
                  aspectRatio: '16 / 10',
                  background: `center / cover no-repeat url(${p.primary_image || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=800&q=60'}), var(--dm-surface-muted)`,
                }}
              />
              <div style={{ padding: 16 }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>
                  {p.make} {p.model}
                </h3>
                <p style={{ margin: '0 0 8px', color: 'var(--dm-slate-600)', fontSize: 13 }}>
                  {p.model_year} · {p.company_name}
                </p>
                <MoneyText style={{ fontSize: 18, fontWeight: 600 }}>{formatQar(p.price)}</MoneyText>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function VehicleDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => apiFetch<Record<string, unknown>>(`/api/products/by-slug/${slug}`),
    enabled: !!slug,
  });

  const product = data?.product as
    | {
        id: string;
        make: string;
        model: string;
        model_year: number;
        price: number;
        finance_eligible: boolean;
        description?: string;
        color?: string;
        mileage?: number;
      }
    | undefined;
  const offer = data?.offer as
    | {
        id: string;
        annual_rent_rate: number;
        tenure_options: number[];
        min_down_payment_pct: number;
      }
    | null
    | undefined;
  const images = (data?.images as { storage_path: string }[]) ?? [];

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

  if (isLoading) return <p style={{ padding: 48 }}>Loading…</p>;
  if (!data?.available || !product) {
    return (
      <div style={{ padding: 48 }}>
        <MarketplaceTopNav />
        <h1 style={{ fontFamily: 'var(--dm-font-display)' }}>Unavailable</h1>
        <p>This listing is not available.</p>
        <Link to="/vehicles">Back to vehicles</Link>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--dm-canvas)', minHeight: '100vh' }}>
      <div style={{ background: 'var(--dm-graphite-900)', height: 72 }}>
        <MarketplaceTopNav />
      </div>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24, display: 'grid', gap: 32, gridTemplateColumns: '1.2fr 1fr' }}>
        <div>
          <div
            style={{
              aspectRatio: '16 / 9',
              borderRadius: 16,
              background: `center / cover no-repeat url(${images[0]?.storage_path || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1600&q=70'})`,
            }}
          />
          <h1 style={{ fontFamily: 'var(--dm-font-display)', marginBottom: 8 }}>
            {product.make} {product.model}
          </h1>
          <p style={{ color: 'var(--dm-slate-600)' }}>
            {product.model_year}
            {product.color ? ` · ${product.color}` : ''}
            {product.mileage != null ? ` · ${product.mileage.toLocaleString()} km` : ''}
          </p>
          <p>{product.description}</p>
        </div>
        <div style={{ background: 'var(--dm-surface)', borderRadius: 16, padding: 24, border: '1px solid var(--dm-slate-200)', alignSelf: 'start' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: 'var(--dm-slate-600)', fontSize: 13 }}>List price</div>
            <MoneyText style={{ fontSize: 28, fontWeight: 600 }}>{formatQar(product.price)}</MoneyText>
          </div>
          {offer && (
            <>
              <label style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>
                Tenure (months)
                <select value={tenure} onChange={(e) => setTenure(Number(e.target.value))} style={{ display: 'block', width: '100%', minHeight: 40, marginTop: 6 }}>
                  {(offer.tenure_options || [12, 24, 36, 48, 60]).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'block', marginBottom: 16, fontSize: 14 }}>
                Down payment %
                <input
                  type="number"
                  min={offer.min_down_payment_pct}
                  max={80}
                  value={downPct}
                  onChange={(e) => setDownPct(Number(e.target.value))}
                  style={{ display: 'block', width: '100%', minHeight: 40, marginTop: 6 }}
                />
              </label>
              <div style={{ marginBottom: 20 }}>
                <div style={{ color: 'var(--dm-slate-600)', fontSize: 13 }}>Est. monthly</div>
                <MoneyText style={{ fontSize: 24, fontWeight: 600 }}>{formatQar(Math.round(monthly), true)}</MoneyText>
                <p style={{ fontSize: 12, color: 'var(--dm-slate-600)' }}>Estimate only — subject to underwriting.</p>
              </div>
            </>
          )}
          {product.finance_eligible ? (
            <button
              type="button"
              className="dm-btn-cta"
              style={{ width: '100%' }}
              onClick={() => navigate(`/app/applications/new?product=${slug}`)}
            >
              Apply for financing
            </button>
          ) : (
            <p style={{ color: 'var(--dm-warning)' }}>Not finance-eligible</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ApplyWizardPage() {
  const [params] = useSearchParams();
  const productSlug = params.get('product') || '';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ['product', productSlug],
    queryFn: () => apiFetch<Record<string, unknown>>(`/api/products/by-slug/${productSlug}`),
    enabled: !!productSlug,
  });
  const product = detail.data?.product as { id: string; make: string; model: string; price: number } | undefined;
  const offer = detail.data?.offer as { id: string; annual_rent_rate: number; min_down_payment_pct: number } | undefined;

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [qid, setQid] = useState('');
  const [employment, setEmployment] = useState('');
  const [income, setIncome] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!product || !offer) throw new Error('listing_not_available');
      const down = (product.price * Number(offer.min_down_payment_pct)) / 100;
      const monthly = estimateMonthlyPayment({
        price: product.price,
        downPayment: down,
        annualRatePercent: offer.annual_rent_rate,
        tenureMonths: 36,
      });
      return apiFetch('/api/applications', {
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
            tenor: 36,
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
    onError: (e: Error) => setError(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  if (!productSlug) return <Navigate to="/vehicles" replace />;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 32 }}>
      <h1 style={{ fontFamily: 'var(--dm-font-display)' }}>Apply for financing</h1>
      {product && (
        <p style={{ color: 'var(--dm-slate-600)' }}>
          {product.make} {product.model} · <MoneyText>{formatQar(product.price)}</MoneyText>
        </p>
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
          {mutation.isPending ? 'Submitting…' : 'Submit application'}
        </button>
      </form>
    </div>
  );
}

function ApplicationsListPage() {
  const { data } = useQuery({
    queryKey: ['my-apps'],
    queryFn: () => apiFetch<Array<{ id: string; status: string; product: { make: string; model: string } }>>('/api/applications/mine'),
  });
  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      <h1 style={{ fontFamily: 'var(--dm-font-display)' }}>My applications</h1>
      {!data?.length && <p style={{ color: 'var(--dm-slate-600)' }}>No applications yet. <Link to="/vehicles">Browse vehicles</Link></p>}
      <ul>
        {data?.map((a) => (
          <li key={a.id}>
            <Link to={`/app/applications/${a.id}`}>
              {a.product.make} {a.product.model} — {a.status}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ApplicationDetailPage() {
  const { id } = useParams();
  const { data } = useQuery({
    queryKey: ['app', id],
    queryFn: () => apiFetch<Record<string, unknown>>(`/api/applications/${id}`),
    enabled: !!id,
  });
  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      <h1 style={{ fontFamily: 'var(--dm-font-display)' }}>Application</h1>
      <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--dm-surface)', padding: 16, borderRadius: 12 }}>
        {JSON.stringify(
          {
            id: data?.id,
            status: data?.status,
            pricing: data?.pricingSnapshot,
            product: data?.product,
          },
          null,
          2,
        )}
      </pre>
      <Link to="/app/applications">Back</Link>
    </div>
  );
}

function CustomerDashboard() {
  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      <h1 style={{ fontFamily: 'var(--dm-font-display)' }}>Your dashboard</h1>
      <p style={{ color: 'var(--dm-slate-600)' }}>Track applications and continue browsing.</p>
      <p>
        <Link to="/app/applications">My applications</Link> · <Link to="/vehicles">Browse vehicles</Link>
      </p>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/vehicles" element={<VehiclesPage />} />
      <Route path="/vehicles/:slug" element={<VehicleDetailPage />} />
      <Route path="/help" element={<div style={{ padding: 48 }}><MarketplaceTopNav /><h1 style={{ paddingTop: 64, fontFamily: 'var(--dm-font-display)' }}>Help</h1><p>FAQ coming soon.</p></div>} />
      <Route path="/auth/login" element={<GuestGuard><LoginPage portalLabel="Customer marketplace" homePath="/app/dashboard" /></GuestGuard>} />
      <Route path="/app/dashboard" element={<AuthGuard allowedRole="customer" reasonParam="not_customer"><CustomerDashboard /></AuthGuard>} />
      <Route path="/app/applications" element={<AuthGuard allowedRole="customer" reasonParam="not_customer"><ApplicationsListPage /></AuthGuard>} />
      <Route path="/app/applications/new" element={<AuthGuard allowedRole="customer" reasonParam="not_customer"><ApplyWizardPage /></AuthGuard>} />
      <Route path="/app/applications/:id" element={<AuthGuard allowedRole="customer" reasonParam="not_customer"><ApplicationDetailPage /></AuthGuard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
