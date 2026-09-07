import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EMPLOYMENT_DURATION_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  MoneyText,
  RESIDENCE_DURATION_OPTIONS,
  formatQar,
  getAppLocale,
  type ConsentStatusDto,
  type DocumentSlot,
  type PricingSnapshot,
} from '@drivemarket/shared';
import { Notice, Pill } from '../fields';
import { formatDate } from '../format';
import { GENDER_OPTIONS, GUARANTOR_RELATIONSHIP_OPTIONS, parseAmount, type ApplyForm, type ApplyStep, type DerivedIdentity } from '../apply-model';
import type { PlanVehicle } from '../PlanSummaryRail';

type Props = {
  form: ApplyForm;
  derived: DerivedIdentity;
  vehicle: PlanVehicle;
  pricing: PricingSnapshot;
  tenure: number;
  slots: DocumentSlot[];
  uploaded: Set<string>;
  consentStatus: ConsentStatusDto | null;
  declaration: boolean;
  declarationError: boolean;
  onDeclarationChange: (value: boolean) => void;
  onEdit: (step: ApplyStep) => void;
};

function labelFor(options: ReadonlyArray<{ value: string; labelKey: string }>, value: string, t: (k: string) => string): string {
  const hit = options.find((o) => o.value === value);
  return hit ? t(hit.labelKey) : value;
}

export function ReviewStep({ form, derived, vehicle, pricing, tenure, slots, uploaded, consentStatus, declaration, declarationError, onDeclarationChange, onEdit }: Props) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const none = t('applyFlow.review.notProvided');
  const money = (v: number | null | undefined, exact = false) => (v == null ? none : <MoneyText>{formatQar(v, exact, locale)}</MoneyText>);
  const required = slots.filter((s) => s.required);
  const missing = required.filter((s) => !uploaded.has(s.category));
  const consentsMissing = consentStatus ? consentStatus.missing.length : 4;

  return (
    <div className="dm-step">
      <p className="dm-step__intro">{t('applyFlow.review.intro')}</p>

      <ReviewSection title={t('applyFlow.review.vehicle')} onEdit={() => onEdit('vehicle')} editLabel={t('applyFlow.review.edit')}>
        <Row label={t('applyFlow.plan.vehicle')}>
          {vehicle.title}
          {vehicle.year ? <span className="dm-numeric"> · {vehicle.year}</span> : null}
        </Row>
        <Row label={t('applyFlow.plan.price')}>{money(pricing.list_price)}</Row>
        <Row label={t('applyFlow.plan.tenure')}>
          <span className="dm-numeric">{t('applyFlow.vehicle.tenureMonths', { months: tenure })}</span>
        </Row>
        <Row label={t('applyFlow.plan.downPayment')}>
          <span className="dm-numeric">{pricing.down_payment_pct}%</span> · {money(pricing.down_payment)}
        </Row>
        <Row label={t('applyFlow.plan.financed')}>{money(Math.max(pricing.list_price - pricing.down_payment, 0))}</Row>
        <Row label={t('applyFlow.plan.monthly')}>{money(pricing.monthly, true)}</Row>
      </ReviewSection>

      <ReviewSection title={t('applyFlow.review.identity')} onEdit={() => onEdit('identity')} editLabel={t('applyFlow.review.edit')}>
        <Row label={t('applyFlow.review.name')}>{`${form.firstName} ${form.lastName}`.trim() || none}</Row>
        <Row label={t('applyFlow.review.gender')}>{form.gender ? labelFor(GENDER_OPTIONS, form.gender, t) : none}</Row>
        <Row label={t('applyFlow.review.qid')}>
          <span className="dm-numeric">{form.qid || none}</span>
        </Row>
        <Row label={t('applyFlow.review.dateOfBirth')}>
          <span className="dm-numeric">{form.dateOfBirth ? formatDate(form.dateOfBirth, locale) : none}</span>
        </Row>
        <Row label={t('applyFlow.review.nationality')}>{derived.nationalityLabel || form.nationality || none}</Row>
        <Row label={t('applyFlow.review.residency')}>
          {derived.residency === 'qatari' ? t('applyFlow.identity.residencyQatari') : derived.residency === 'expat' ? t('applyFlow.identity.residencyExpat') : none}
          {derived.residency === 'expat' && form.residenceDuration ? ` · ${labelFor(RESIDENCE_DURATION_OPTIONS, form.residenceDuration, t)}` : ''}
        </Row>
        <Row label={t('applyFlow.review.phone')}>
          <span className="dm-numeric">{form.phone || none}</span>
        </Row>
        <Row label={t('applyFlow.review.email')}>{form.email || none}</Row>
        <Row label={t('applyFlow.review.city')}>{form.city || none}</Row>
      </ReviewSection>

      <ReviewSection title={t('applyFlow.review.employment')} onEdit={() => onEdit('employment')} editLabel={t('applyFlow.review.edit')}>
        <Row label={t('applyFlow.review.employer')}>{form.employer || none}</Row>
        <Row label={t('applyFlow.review.employmentType')}>{form.employmentType ? labelFor(EMPLOYMENT_TYPE_OPTIONS, form.employmentType, t) : none}</Row>
        <Row label={t('applyFlow.review.employmentDuration')}>{form.employmentDuration ? labelFor(EMPLOYMENT_DURATION_OPTIONS, form.employmentDuration, t) : none}</Row>
        <Row label={t('applyFlow.review.income')}>{money(parseAmount(form.monthlyIncome))}</Row>
        <Row label={t('applyFlow.review.liabilities')}>{money(parseAmount(form.monthlyLiabilities) ?? 0)}</Row>
      </ReviewSection>

      <ReviewSection title={t('applyFlow.review.guarantor')} onEdit={() => onEdit('guarantor')} editLabel={t('applyFlow.review.edit')}>
        {form.hasGuarantor ? (
          <>
            <Row label={t('applyFlow.review.name')}>{form.guarantor.fullName || none}</Row>
            <Row label={t('applyFlow.review.qid')}>
              <span className="dm-numeric">{form.guarantor.qid || none}</span>
            </Row>
            <Row label={t('applyFlow.review.phone')}>
              <span className="dm-numeric">{form.guarantor.phone || none}</span>
            </Row>
            <Row label={t('applyFlow.review.relationship')}>{form.guarantor.relationship ? labelFor(GUARANTOR_RELATIONSHIP_OPTIONS, form.guarantor.relationship, t) : none}</Row>
            <Row label={t('applyFlow.review.income')}>{money(parseAmount(form.guarantor.monthlyIncome))}</Row>
          </>
        ) : (
          <p className="dm-muted">{t('applyFlow.review.guarantorNone')}</p>
        )}
      </ReviewSection>

      <ReviewSection title={t('applyFlow.review.documents')} onEdit={() => onEdit('documents')} editLabel={t('applyFlow.review.edit')}>
        <div className="dm-review__status">
          <Pill tone={missing.length === 0 ? 'success' : 'warn'}>{t('applyFlow.review.docsProgress', { done: required.length - missing.length, total: required.length })}</Pill>
          {missing.length > 0 ? <p className="dm-muted">{t('applyFlow.review.docsMissing', { list: missing.map((s) => t(s.labelKey)).join(', ') })}</p> : null}
        </div>
      </ReviewSection>

      <ReviewSection title={t('applyFlow.review.consents')} onEdit={() => onEdit('consents')} editLabel={t('applyFlow.review.edit')}>
        <div className="dm-review__status">
          <Pill tone={consentsMissing === 0 ? 'success' : 'warn'}>{consentsMissing === 0 ? t('applyFlow.review.consentsDone') : t('applyFlow.review.consentsMissing', { count: consentsMissing })}</Pill>
        </div>
      </ReviewSection>

      <div className={`dm-declaration${declarationError ? ' is-invalid' : ''}`}>
        <label className="dm-check">
          <input type="checkbox" checked={declaration} onChange={(e) => onDeclarationChange(e.target.checked)} aria-invalid={declarationError || undefined} aria-describedby={declarationError ? 'apply-declaration-error' : undefined} />
          <span>{t('applyFlow.review.declaration')}</span>
        </label>
        {declarationError ? (
          <p className="dm-field__error" id="apply-declaration-error" role="alert">
            {t('applyFlow.review.declarationRequired')}
          </p>
        ) : null}
        <p className="dm-muted">{t('applyFlow.review.submitHint')}</p>
      </div>

      <Notice tone="info" title={t('applyFlow.review.afterSubmit')}>
        {t('applyFlow.review.afterSubmitBody')}
      </Notice>
    </div>
  );
}

function ReviewSection({ title, onEdit, editLabel, children }: { title: string; onEdit: () => void; editLabel: string; children: ReactNode }) {
  return (
    <section className="dm-review">
      <div className="dm-review__head">
        <h3>{title}</h3>
        <button type="button" className="dm-linkbtn" onClick={onEdit} aria-label={`${editLabel}: ${title}`}>
          {editLabel}
        </button>
      </div>
      <dl className="dm-review__rows">{children}</dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="dm-review__row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
