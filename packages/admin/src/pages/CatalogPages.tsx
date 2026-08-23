import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiFetch,
  buildPaginationQuery,
  paginationWindow,
  ConfirmDialog,
  ExportButton,
  OpsDataTable,
  OpsEmptyState,
  OpsListPage,
  OpsPageHeader,
} from '@drivemarket/shared';
import { toast } from 'react-toastify';

type CatalogKind = 'promotions' | 'insurance-rates' | 'packages';

const META: Record<CatalogKind, { title: string; fields: Array<{ key: string; label: string; type?: string }> }> = {
  promotions: {
    title: 'Promotions',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Description' },
      { key: 'discountPercentage', label: 'Discount %', type: 'number' },
      { key: 'discountAmount', label: 'Discount amount', type: 'number' },
      { key: 'status', label: 'Status' },
    ],
  },
  'insurance-rates': {
    title: 'Insurance & Rates',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Description' },
      { key: 'annualRate', label: 'Annual rate', type: 'number' },
      { key: 'annualRateProvider', label: 'Provider rate', type: 'number' },
      { key: 'coverageType', label: 'Coverage' },
      { key: 'status', label: 'Status' },
    ],
  },
  packages: {
    title: 'Packages',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Description' },
      { key: 'price', label: 'Price', type: 'number' },
      { key: 'status', label: 'Status' },
    ],
  },
};

function CatalogList({ kind }: { kind: CatalogKind }) {
  const [page, setPage] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: [kind, page],
    queryFn: () =>
      apiFetch<{ total: number; items: Array<Record<string, unknown> & { id: string; name: string }> }>(
        `/api/ops/${kind}?${buildPaginationQuery(page)}`,
      ),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/ops/${kind}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Deleted');
      void qc.invalidateQueries({ queryKey: [kind] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const { from, to, total } = paginationWindow(data?.total ?? 0, page);
  return (
    <OpsListPage
      title={META[kind].title}
      headerActions={
        <>
          <ExportButton data={(data?.items ?? []) as Record<string, unknown>[]} filename={kind} />
          <Link className="blox-btn blox-btn--primary" to={`/main/${kind}/new`}>
            Add
          </Link>
        </>
      }
    >
      <OpsDataTable
        columns={['Name', 'Status', '']}
        pagination={{ from, to, total, onPrev: () => setPage((p) => Math.max(0, p - 1)), onNext: () => setPage((p) => p + 1) }}
        empty={<OpsEmptyState title="No records" body="" />}
        rows={(data?.items ?? []).map((row) => [
          <Link key="n" to={`/main/${kind}/${row.id}`}>
            {row.name}
          </Link>,
          String(row.status ?? '—'),
          <button key="d" type="button" className="blox-btn blox-btn--ghost" onClick={() => setDeleteId(row.id)}>
            Delete
          </button>,
        ])}
      />
      <ConfirmDialog
        open={!!deleteId}
        title="Delete record"
        message="This cannot be undone."
        variant="danger"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) del.mutate(deleteId);
          setDeleteId(null);
        }}
      />
    </OpsListPage>
  );
}

function CatalogEdit({ kind }: { kind: CatalogKind }) {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({ status: 'active' });
  const existing = useQuery({
    queryKey: [kind, id],
    queryFn: () => apiFetch<Record<string, unknown>>(`/api/ops/${kind}/${id}`),
    enabled: !isNew,
  });
  useEffect(() => {
    if (!existing.data) return;
    const next: Record<string, string> = {};
    for (const field of META[kind].fields) {
      next[field.key] = existing.data[field.key] != null ? String(existing.data[field.key]) : '';
    }
    setForm((prev) => ({ ...prev, ...next }));
  }, [existing.data, kind]);
  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      for (const field of META[kind].fields) {
        const value = form[field.key];
        body[field.key] = field.type === 'number' ? Number(value || 0) : value;
      }
      return apiFetch(isNew ? `/api/ops/${kind}` : `/api/ops/${kind}/${id}`, {
        method: isNew ? 'POST' : 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast.success('Saved');
      void qc.invalidateQueries({ queryKey: [kind] });
      navigate(`/main/${kind}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }
  return (
    <div className="blox-page">
      <OpsPageHeader title={`${isNew ? 'Add' : 'Edit'} ${META[kind].title}`} />
      <form className="blox-form" onSubmit={onSubmit} style={{ maxWidth: 480 }}>
        {META[kind].fields.map((field) => (
          <label key={field.key}>
            {field.label}
            <input
              type={field.type ?? 'text'}
              value={form[field.key] ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
            />
          </label>
        ))}
        <button type="submit" className="blox-btn blox-btn--primary" disabled={save.isPending}>
          Save
        </button>
      </form>
    </div>
  );
}

export function PromotionsPage() {
  return <CatalogList kind="promotions" />;
}
export function PromotionEditPage() {
  return <CatalogEdit kind="promotions" />;
}
export function InsuranceRatesPage() {
  return <CatalogList kind="insurance-rates" />;
}
export function InsuranceRateEditPage() {
  return <CatalogEdit kind="insurance-rates" />;
}
export function PackagesPage() {
  return <CatalogList kind="packages" />;
}
export function PackageEditPage() {
  return <CatalogEdit kind="packages" />;
}

export function SettlementSettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['settlement-settings'],
    queryFn: () => apiFetch<Record<string, unknown>>('/api/ops/settings/settlement-discounts'),
  });
  const [form, setForm] = useState({
    principalDiscountEnabled: false,
    principalDiscountValue: 0,
    interestDiscountEnabled: false,
    interestDiscountValue: 0,
    minSettlementAmount: 0,
  });
  useEffect(() => {
    if (!data) return;
    setForm({
      principalDiscountEnabled: Boolean(data.principalDiscountEnabled),
      principalDiscountValue: Number(data.principalDiscountValue ?? 0),
      interestDiscountEnabled: Boolean(data.interestDiscountEnabled),
      interestDiscountValue: Number(data.interestDiscountValue ?? 0),
      minSettlementAmount: Number(data.minSettlementAmount ?? 0),
    });
  }, [data]);
  const save = useMutation({
    mutationFn: () =>
      apiFetch('/api/ops/settings/settlement-discounts', {
        method: 'PATCH',
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      toast.success('Settings saved');
      void qc.invalidateQueries({ queryKey: ['settlement-settings'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="blox-page">
      <OpsPageHeader title="Settlement discounts" subtitle="Early settlement rules" />
      <section className="blox-panel" style={{ maxWidth: 520 }}>
        <label>
          <input
            type="checkbox"
            checked={form.principalDiscountEnabled}
            onChange={(e) => setForm((p) => ({ ...p, principalDiscountEnabled: e.target.checked }))}
          />{' '}
          Principal discount enabled
        </label>
        <label>
          Principal discount value
          <input
            type="number"
            value={form.principalDiscountValue}
            onChange={(e) => setForm((p) => ({ ...p, principalDiscountValue: Number(e.target.value) }))}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.interestDiscountEnabled}
            onChange={(e) => setForm((p) => ({ ...p, interestDiscountEnabled: e.target.checked }))}
          />{' '}
          Interest discount enabled
        </label>
        <label>
          Interest discount value
          <input
            type="number"
            value={form.interestDiscountValue}
            onChange={(e) => setForm((p) => ({ ...p, interestDiscountValue: Number(e.target.value) }))}
          />
        </label>
        <label>
          Min settlement amount
          <input
            type="number"
            value={form.minSettlementAmount}
            onChange={(e) => setForm((p) => ({ ...p, minSettlementAmount: Number(e.target.value) }))}
          />
        </label>
        <button type="button" className="blox-btn blox-btn--primary" onClick={() => save.mutate()}>
          Save settings
        </button>
      </section>
    </div>
  );
}

export function ClearStoragePage() {
  return (
    <div className="blox-page">
      <OpsPageHeader title="Dev tools" subtitle="Local storage utilities (non-prod)" />
      <button
        type="button"
        className="blox-btn blox-btn--secondary"
        onClick={() => {
          localStorage.clear();
          toast.success('Local storage cleared');
        }}
      >
        Clear local storage
      </button>
    </div>
  );
}
