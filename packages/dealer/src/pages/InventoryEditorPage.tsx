import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  OpsAlert,
  OpsFormPage,
  OpsFormSection,
  PRODUCT_RULES,
  apiFetch,
  useOpsLabels,
  type DealerInventoryItem,
} from '@drivemarket/shared';

/** Longest tenure (months) a model year can carry under the 10-year age limit at tenure end. */
function maxTenureMonthsForModelYear(modelYear: number, now = new Date()): number {
  const ageNow = now.getFullYear() - modelYear;
  const years = PRODUCT_RULES.vehicleAge.maxYearsAtTenureEnd - ageNow;
  return Math.max(0, Math.floor(years * 12));
}

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
  const [vin, setVin] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [engineNumber, setEngineNumber] = useState('');
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
    setVin(String(row.vin ?? ''));
    setChassisNumber(String(row.chassis_number ?? ''));
    setEngineNumber(String(row.engine_number ?? ''));
  }, [existing.data, id, isNew]);

  const identityComplete = !!vin.trim() && !!chassisNumber.trim() && !!engineNumber.trim();
  const identitySaved = !isNew && existing.data?.identity_complete === identityComplete;
  const maxTenureForYear = Number.isFinite(modelYear) ? maxTenureMonthsForModelYear(modelYear) : null;
  const longestTenure = PRODUCT_RULES.tenure.maxMonths.qatari;

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
        vin: vin.trim() || undefined,
        chassis_number: chassisNumber.trim() || undefined,
        engine_number: engineNumber.trim() || undefined,
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
      void qc.invalidateQueries({ queryKey: ['dealer-inventory-item', row.id] });
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
      wide
      title={isNew ? t('ops.dealer.newListing') : t('ops.dealer.editListing')}
      subtitle={t('ops.dealer.listingSubtitle')}
    >
      <OpsFormSection title={t('ops.dealer.listingDetails')}>
      <form onSubmit={onSubmit} className="blox-form-grid__full blox-form blox-form--wide blox-form--3col">
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
        <label className="blox-form__full">
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        </label>
        <label className="blox-checkbox-row blox-form__full">
          <input
            type="checkbox"
            checked={financeEligible}
            onChange={(e) => setFinanceEligible(e.target.checked)}
          />
          Finance eligible
        </label>

        <div className="blox-form-block">
          <h3 className="blox-panel__subtitle">{t('inventoryRules.identityTitle')}</h3>
          <p className="blox-field__hint">{t('inventoryRules.identityHint')}</p>
          <div className="blox-grid-3">
            <label>
              {t('inventoryRules.vin')}
              <input value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} autoComplete="off" spellCheck={false} />
            </label>
            <label>
              {t('inventoryRules.chassisNumber')}
              <input
                value={chassisNumber}
                onChange={(e) => setChassisNumber(e.target.value.toUpperCase())}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label>
              {t('inventoryRules.engineNumber')}
              <input
                value={engineNumber}
                onChange={(e) => setEngineNumber(e.target.value.toUpperCase())}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          </div>
          {identityComplete ? (
            <OpsAlert variant="success" title={t('inventoryRules.identityTitle')}>
              {t('dealerOps.vehicle.identityComplete')}
              {!isNew && !identitySaved ? ` ${t('dealerOps.vehicle.identitySaveHint')}` : ''}
            </OpsAlert>
          ) : (
            <OpsAlert variant="info" title={t('inventoryRules.identityTitle')}>
              {t('inventoryRules.identityOptionalHint')}
            </OpsAlert>
          )}
          {maxTenureForYear != null && maxTenureForYear <= 0 && (
            <OpsAlert variant="error" title={t('inventoryRules.ageBlocked')}>
              {t('dealerOps.vehicle.ageHint', { year: modelYear, months: 0 })}
            </OpsAlert>
          )}
          {maxTenureForYear != null && maxTenureForYear > 0 && maxTenureForYear < longestTenure && (
            <OpsAlert variant="info">
              {t('dealerOps.vehicle.ageHint', { year: modelYear, months: maxTenureForYear })}
            </OpsAlert>
          )}
        </div>

        {error && <p className="blox-form-error blox-form__full" role="alert">{error}</p>}
        <button type="submit" className="blox-btn blox-btn--primary blox-form__full" disabled={inventoryBusy}>
          {save.isPending ? t('dealerOps.vehicle.saving') : t('dealerOps.vehicle.save')}
        </button>
      </form>
      </OpsFormSection>
      {!isNew && (
        <OpsFormSection title={t('ops.dealer.publishMedia')}>
        <div className="blox-media-panel">
          <label className="blox-field">
            Upload image
            <input type="file" accept="image/*" onChange={onUpload} />
          </label>
          <div className="blox-inline-actions">
            <button
              type="button"
              className="blox-btn blox-btn--secondary"
              disabled={inventoryBusy}
              onClick={() => publish.mutate()}
            >
              {publish.isPending ? 'Publishing…' : 'Publish'}
            </button>
            <button
              type="button"
              className="blox-btn blox-btn--ghost"
              disabled={inventoryBusy}
              onClick={() => unpublish.mutate()}
            >
              {unpublish.isPending ? 'Unpublishing…' : 'Unpublish'}
            </button>
          </div>
          {error && error.includes('listing_has_active_financing') && (
            <p className="blox-form-error" role="alert">
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
