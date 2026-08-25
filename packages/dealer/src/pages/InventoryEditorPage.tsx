import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  OpsFormPage,
  OpsFormSection,
  apiFetch,
  useOpsLabels,
  type DealerInventoryItem,
} from '@drivemarket/shared';

export function InventoryEditorPage() {
  const { t } = useOpsLabels();
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [trim, setTrim] = useState('');
  const [modelYear, setModelYear] = useState(2024);
  const [price, setPrice] = useState(100000);
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<'new' | 'used'>('used');
  const [engine, setEngine] = useState('');
  const [transmission, setTransmission] = useState<'automatic' | 'manual' | ''>('');
  const [cylinders, setCylinders] = useState<number | ''>('');
  const [drivetrain, setDrivetrain] = useState<'fwd' | 'rwd' | 'awd' | 'four_wd' | ''>('');
  const [bodyType, setBodyType] = useState<'sedan' | 'suv' | 'coupe' | 'hatchback' | 'pickup' | 'van' | 'other' | ''>('');
  const [color, setColor] = useState('');
  const [mileage, setMileage] = useState<number | ''>('');
  const [warrantyMonths, setWarrantyMonths] = useState<number | ''>('');
  const [warrantyNotes, setWarrantyNotes] = useState('');
  const [financeEligible, setFinanceEligible] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ['dealer-inventory-item', id],
    queryFn: () => apiFetch<DealerInventoryItem>(`/api/dealer/inventory/${id}`),
    enabled: !isNew && !!id,
  });

  useEffect(() => {
    if (isNew || !existing.data) return;
    const row = existing.data;
    if (!row) return;
    setMake(String(row.make ?? ''));
    setModel(String(row.model ?? ''));
    setTrim(String(row.trim ?? ''));
    setModelYear(Number(row.model_year ?? 2024));
    setPrice(Number(row.price ?? 0));
    setDescription(String(row.description ?? ''));
    setCondition((row.condition as 'new' | 'used') ?? 'used');
    setEngine(String(row.engine ?? ''));
    setTransmission((row.transmission as 'automatic' | 'manual') ?? '');
    setCylinders(row.cylinders != null ? Number(row.cylinders) : '');
    setDrivetrain((row.drivetrain as typeof drivetrain) ?? '');
    setBodyType((row.body_type as typeof bodyType) ?? '');
    setColor(String(row.color ?? ''));
    setMileage(row.mileage != null ? Number(row.mileage) : '');
    setWarrantyMonths(row.warranty_months != null ? Number(row.warranty_months) : '');
    setWarrantyNotes(String(row.warranty_notes ?? ''));
    setFinanceEligible(row.finance_eligible !== false);
  }, [existing.data, id, isNew]);

  const save = useMutation({
    mutationFn: async () => {
      if (!make.trim() || !model.trim()) {
        throw new Error('Make and model are required.');
      }
      if (!Number.isFinite(price) || price < 1) {
        throw new Error('Enter a price of at least QAR 1.');
      }
      const body = {
        make: make.trim(),
        model: model.trim(),
        trim: trim.trim() || undefined,
        modelYear,
        price,
        description: description.trim() || undefined,
        condition,
        engine: engine.trim() || undefined,
        transmission: transmission || undefined,
        cylinders: cylinders === '' ? undefined : Math.trunc(Number(cylinders)),
        drivetrain: drivetrain || undefined,
        bodyType: bodyType || undefined,
        color: color.trim() || undefined,
        mileage: mileage === '' ? undefined : Math.trunc(Number(mileage)),
        warrantyMonths: warrantyMonths === '' ? undefined : Math.trunc(Number(warrantyMonths)),
        warrantyNotes: warrantyNotes.trim() || undefined,
        financeEligible,
      };
      if (isNew) {
        return apiFetch<{ id: string }>('/api/dealer/inventory', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      await apiFetch(`/api/dealer/inventory/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      return { id: id as string };
    },
    onSuccess: (row: { id: string }) => {
      void qc.invalidateQueries({ queryKey: ['dealer-inventory'] });
      navigate(`/inventory/${row.id}`);
    },
    onError: (e: Error) => {
      setError(e.message);
      toast.error(e.message);
    },
  });

  const publish = useMutation({
    mutationFn: () => apiFetch(`/api/dealer/inventory/${id}/publish`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dealer-inventory'] }),
    onError: (e: Error) => {
      setError(e.message);
      toast.error(e.message);
    },
  });

  const unpublish = useMutation({
    mutationFn: () => apiFetch(`/api/dealer/inventory/${id}/unpublish`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dealer-inventory'] }),
    onError: (e: Error) => {
      setError(e.message);
      toast.error(e.message);
    },
  });

  const inventoryBusy = save.isPending || publish.isPending || unpublish.isPending;

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || isNew || !id) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      await apiFetch(`/api/dealer/inventory/${id}/images`, { method: 'POST', body: fd });
      void qc.invalidateQueries({ queryKey: ['dealer-inventory'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    save.mutate();
  }

  return (
    <OpsFormPage
      title={isNew ? t('ops.dealer.newListing') : t('ops.dealer.editListing')}
      subtitle={t('ops.dealer.listingSubtitle')}
    >
      <OpsFormSection title={t('ops.dealer.listingDetails')}>
      <form onSubmit={onSubmit} className="blox-form">
        <label>
          Make
          <input required value={make} onChange={(e) => setMake(e.target.value)} />
        </label>
        <label>
          Model
          <input required value={model} onChange={(e) => setModel(e.target.value)} />
        </label>
        <label>
          Trim
          <input value={trim} onChange={(e) => setTrim(e.target.value)} />
        </label>
        <label>
          Year
          <input type="number" required value={modelYear} onChange={(e) => setModelYear(Number(e.target.value))} />
        </label>
        <label>
          Condition
          <select value={condition} onChange={(e) => setCondition(e.target.value as 'new' | 'used')}>
            <option value="used">Used</option>
            <option value="new">New</option>
          </select>
        </label>
        <label>
          Transmission
          <select value={transmission} onChange={(e) => setTransmission(e.target.value as typeof transmission)}>
            <option value="">—</option>
            <option value="automatic">Automatic</option>
            <option value="manual">Manual</option>
          </select>
        </label>
        <label>
          Cylinders
          <input type="number" value={cylinders} onChange={(e) => setCylinders(e.target.value ? Number(e.target.value) : '')} />
        </label>
        <label>
          Drivetrain
          <select value={drivetrain} onChange={(e) => setDrivetrain(e.target.value as typeof drivetrain)}>
            <option value="">—</option>
            <option value="fwd">FWD</option>
            <option value="rwd">RWD</option>
            <option value="awd">AWD</option>
            <option value="four_wd">4WD</option>
          </select>
        </label>
        <label>
          Body type
          <select value={bodyType} onChange={(e) => setBodyType(e.target.value as typeof bodyType)}>
            <option value="">—</option>
            <option value="sedan">Sedan</option>
            <option value="suv">SUV</option>
            <option value="coupe">Coupe</option>
            <option value="hatchback">Hatchback</option>
            <option value="pickup">Pickup</option>
            <option value="van">Van</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Engine
          <input value={engine} onChange={(e) => setEngine(e.target.value)} />
        </label>
        <label>
          Color
          <input value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <label>
          Mileage (km)
          <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value ? Number(e.target.value) : '')} />
        </label>
        <label>
          Warranty months
          <input type="number" value={warrantyMonths} onChange={(e) => setWarrantyMonths(e.target.value ? Number(e.target.value) : '')} />
        </label>
        <label>
          Warranty notes
          <input value={warrantyNotes} onChange={(e) => setWarrantyNotes(e.target.value)} />
        </label>
        <label>
          Price (QAR)
          <input type="number" required value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={financeEligible}
            onChange={(e) => setFinanceEligible(e.target.checked)}
          />
          Finance eligible
        </label>
        {error && <p style={{ color: '#b42318', margin: 0 }}>{error}</p>}
        <button type="submit" className="blox-btn blox-btn--primary" disabled={inventoryBusy}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </form>
      </OpsFormSection>
      {!isNew && (
        <OpsFormSection title={t('ops.dealer.publishMedia')}>
        <div className="blox-panel" style={{ maxWidth: 560, boxShadow: 'none', border: 'none', padding: 0 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: '0.875rem', fontWeight: 600 }}>
            Upload image
            <input type="file" accept="image/*" onChange={onUpload} />
          </label>
          <button
            type="button"
            className="blox-btn blox-btn--secondary"
            style={{ marginTop: 12 }}
            disabled={inventoryBusy}
            onClick={() => publish.mutate()}
          >
            {publish.isPending ? 'Publishing…' : 'Publish'}
          </button>
          <button
            type="button"
            className="blox-btn blox-btn--ghost"
            style={{ marginTop: 12, marginLeft: 8 }}
            disabled={inventoryBusy}
            onClick={() => unpublish.mutate()}
          >
            {unpublish.isPending ? 'Unpublishing…' : 'Unpublish'}
          </button>
          {error && error.includes('listing_has_active_financing') && (
            <p style={{ color: '#b42318', marginTop: 8 }}>
              This listing has an in-flight financing application and cannot be unpublished.
            </p>
          )}
        </div>
        </OpsFormSection>
      )}
    </OpsFormPage>
  );
}

export const InventoryEditor = InventoryEditorPage;
