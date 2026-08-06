import { PageHeader, PrimaryButton, SecondaryButton, StatusPill } from '../components/ui';

const products = [
  {
    title: 'Hyundai Tucson Limited',
    meta: '2024 · Automatic · 12,400 km',
    price: 'QAR 119,500',
    status: 'published' as const,
    image: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=600&q=70',
  },
  {
    title: 'Toyota Camry SE',
    meta: '2023 · Automatic · 28,100 km',
    price: 'QAR 98,200',
    status: 'published' as const,
    image: 'https://images.unsplash.com/photo-1621007947382-b76b334c3a4d?auto=format&fit=crop&w=600&q=70',
  },
  {
    title: 'Nissan Patrol SE',
    meta: '2022 · Automatic · 45,000 km',
    price: 'QAR 245,000',
    status: 'draft' as const,
    image: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=600&q=70',
  },
  {
    title: 'Kia Sportage GT',
    meta: '2024 · Automatic · 8,200 km',
    price: 'QAR 87,400',
    status: 'published' as const,
    image: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=600&q=70',
  },
];

export function ProductsPage() {
  return (
    <div className="blox-page">
      <PageHeader
        title="Products"
        subtitle="Vehicle catalog across all dealers"
        actions={
          <>
            <SecondaryButton>Import</SecondaryButton>
            <PrimaryButton>Add product</PrimaryButton>
          </>
        }
      />

      <div className="blox-filter-bar">
        <input type="search" placeholder="Search make, model, VIN…" />
        <select defaultValue="">
          <option value="">All makes</option>
          <option value="hyundai">Hyundai</option>
          <option value="toyota">Toyota</option>
        </select>
        <select defaultValue="">
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      <div className="blox-product-grid">
        {products.map((p) => (
          <article key={p.title} className="blox-product-card">
            <img className="blox-product-card__image" src={p.image} alt="" />
            <div className="blox-product-card__body">
              <h3 className="blox-product-card__title">{p.title}</h3>
              <p className="blox-product-card__meta">{p.meta}</p>
              <div className="blox-product-card__footer">
                <span className="blox-money">{p.price}</span>
                <StatusPill label={p.status} variant={p.status} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
