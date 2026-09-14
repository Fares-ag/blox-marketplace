/**
 * Guided seven-step financing application (`/app/applications/new`).
 *
 * Draft lifecycle: the draft is created on the API when the customer leaves
 * "About you" (the first step with identifying data), then patched on every
 * later step and on "Save and continue later". An existing draft for the same
 * vehicle is detected up front and offered for resumption.
 *
 * Wave 2: guarantor consent request from the guarantor step, document
 * freshness (`documents_stale`), and an informational credit preview on the
 * review step.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ApiError,
  DocumentMeta,
  apiFetch,
  documentSlotsFor,
  getAppLocale,
  labelCondition,
  resolveListingImageUrl,
  trackProductEvent,
  useAuthStore,
  type ConsentStatusDto,
  type DocumentSlot,
  type ProductDetailResponse,
  type ProductRuleViolation,
} from '@drivemarket/shared';
import { MarketplaceNav } from '../../components/MarketplaceNav';
import { BrandBadge } from '../../components/BrandProvider';
import { ConsentChecklist } from '../../components/consents/ConsentChecklist';
import {
  APPLY_STEPS,
  buildPlanPricing,
  creditPreviewFor,
  deriveIdentity,
  documentProfile,
  emptyApplyForm,
  firstIncompleteStep,
  formFromSnapshot,
  normalizePlan,
  planFromPricingSnapshot,
  planMinDownPct,
  planTenureOptions,
  planViolations,
  prefillFromAccount,
  snapshotFromForm,
  staleDocumentCategories,
  stepIndex,
  validateGuarantor,
  validateIdentity,
  validateStep,
  type ApplyForm,
  type ApplyPlan,
  type ApplyStep,
  type FieldErrors,
  type GuarantorForm,
  type PlanContext,
} from './apply-model';
import { clearApplyDraft, loadApplyDraft, saveApplyDraft } from './apply-draft-cache';
import {
  applyErrorCode,
  blockingApplicationIdFrom,
  createDraft,
  fetchBlockingApplicationId,
  fetchDraftDetail,
  fetchMyApplications,
  loadUploadedDocuments,
  missingDocumentsFrom,
  patchDraft,
  ruleViolationsFrom,
  staleDocumentsFrom,
  submitApplication,
  uploadApplicationDocument,
  type ApplicationDraftDto,
} from './apply-api';
import {
  cancelGuarantorSession,
  createGuarantorSession,
  fetchGuarantorSessionForApplication,
  guarantorSessionIsOpen,
  resendGuarantorSessionLink,
} from '../../lib/guarantor-api';
import { apiErrorCode, errorStatus } from '../../lib/errors';
import { Notice, type NoticeTone } from './fields';
import { StepProgress } from './StepProgress';
import { ApplyStickyBar, PlanSummaryRail, type PlanVehicle } from './PlanSummaryRail';
import { VehiclePlanStep } from './steps/VehiclePlanStep';
import { IdentityStep } from './steps/IdentityStep';
import { EmploymentStep } from './steps/EmploymentStep';
import { GuarantorStep } from './steps/GuarantorStep';
import { GuarantorConsentPanel, type GuarantorBusy } from './steps/GuarantorConsentPanel';
import { DocumentsStep, type UploadState } from './steps/DocumentsStep';
import { ReviewStep } from './steps/ReviewStep';

type Banner = { tone: NoticeTone; text: string; action?: { label: string; to: string } };

const STEP_TITLE_KEY: Record<ApplyStep, string> = {
  vehicle: 'applyFlow.vehicle.title',
  identity: 'applyFlow.identity.title',
  employment: 'applyFlow.employment.title',
  guarantor: 'applyFlow.guarantor.title',
  documents: 'applyFlow.docs.title',
  consents: 'applyFlow.consents.title',
  review: 'applyFlow.review.title',
};

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function guarantorQueryKey(draftId: string | null) {
  return ['app', draftId ?? '', 'guarantor-session'] as const;
}

function Shell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="dm-apply">
      <DocumentMeta title={title} />
      <header className="dm-band dm-apply__head">
        <div className="dm-band__inner">
          <MarketplaceNav />
        </div>
      </header>
      <div className="dm-apply__layout dm-apply__layout--single">
        <main className="dm-apply__main">{children}</main>
      </div>
    </div>
  );
}

export function ApplyPage() {
  const [params] = useSearchParams();
  const productSlug = params.get('product') || '';
  const quoteToken = params.get('quote') || undefined;
  // Negotiated price forwarded from the quote redeem page (or direct URL with ?price=).
  const quotedPrice = params.get('price') ? Number(params.get('price')) : null;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const locale = getAppLocale();
  const user = useAuthStore((s) => s.user);

  const detail = useQuery({
    queryKey: ['product', productSlug],
    queryFn: () => apiFetch<ProductDetailResponse>(`/api/products/by-slug/${productSlug}`),
    enabled: !!productSlug,
  });
  const product = detail.data?.product;
  const offer = detail.data?.offer ?? null;
  const company = detail.data?.company;
  const images = detail.data?.images ?? [];
  const available = detail.data?.available !== false && !!product && !!offer && product.finance_eligible;

  const ctx = useMemo<PlanContext | null>(() => {
    if (!product || !offer) return null;
    const options = Array.isArray(offer.tenure_options) ? offer.tenure_options.map(Number).filter((n) => Number.isFinite(n) && n > 0) : [];
    // Use the dealer-negotiated price when this apply session originated from a quote link.
    const price = (quotedPrice && Number.isFinite(quotedPrice) && quotedPrice > 0) ? quotedPrice : Number(product.price);
    return {
      price,
      condition: product.condition === 'used' ? 'used' : 'new',
      modelYear: product.model_year ?? null,
      annualRatePercent: Number(offer.annual_rent_rate),
      offerTenureOptions: options,
      offerMinDownPct: Number(offer.min_down_payment_pct ?? 0),
    };
  }, [product, offer, quotedPrice]);

  const vehicle = useMemo<PlanVehicle | null>(() => {
    if (!product) return null;
    return {
      title: `${product.make} ${product.model}${product.trim ? ` ${product.trim}` : ''}`.trim(),
      year: product.model_year ?? null,
      imageUrl: resolveListingImageUrl(images[0]?.storage_path ?? product.primary_image),
      dealerName: company?.name ?? product.company_name ?? null,
      conditionLabel: labelCondition(product.condition, t),
    };
  }, [product, images, company, t]);

  // ---- form state -------------------------------------------------------
  const [form, setForm] = useState<ApplyForm>(() =>
    prefillFromAccount(emptyApplyForm(), { fullName: user?.full_name, phone: user?.phone, email: user?.email, qid: user?.qid }),
  );
  const [prefilled] = useState(() => Boolean(user?.full_name || user?.phone || user?.qid));
  const [plan, setPlan] = useState<ApplyPlan>({
    tenure: Number(params.get('tenure')) || 36,
    downPct: Number(params.get('downPct')) || 0,
  });
  const [planReady, setPlanReady] = useState(false);
  const [adjustedTenure, setAdjustedTenure] = useState<number | null>(null);
  const [step, setStep] = useState<ApplyStep>('vehicle');
  const [maxReached, setMaxReached] = useState(0);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submittedSteps, setSubmittedSteps] = useState<Partial<Record<ApplyStep, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [draftId, setDraftId] = useState<string | null>(null);
  const [resumeCandidate, setResumeCandidate] = useState<ApplicationDraftDto | null>(null);
  const [resumeDecided, setResumeDecided] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [busy, setBusy] = useState(false);
  const [declaration, setDeclaration] = useState(false);
  const [declarationError, setDeclarationError] = useState(false);
  const [consentStatus, setConsentStatus] = useState<ConsentStatusDto | null>(null);
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  /** Violations the API reported on the last save (its env flags may be stricter than ours). */
  const [serverViolations, setServerViolations] = useState<ProductRuleViolation[]>([]);
  const [guarantorBusy, setGuarantorBusy] = useState<GuarantorBusy>(null);
  const [guarantorLink, setGuarantorLink] = useState<string | null>(null);
  const [guarantorNotice, setGuarantorNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const idempotencyKey = useRef(newIdempotencyKey());
  const stepTitleRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const derived = useMemo(() => deriveIdentity(form, locale), [form, locale]);
  const residency = derived.residency;

  // Keep the plan inside the accepted bands, and start the down payment at the
  // recommended contribution when the customer did not bring one in the link.
  useEffect(() => {
    if (!ctx) return;
    if (!planReady && !params.get('downPct') && plan.downPct === 0) {
      setPlan((prev) => ({ ...prev, downPct: planMinDownPct(ctx) }));
      return;
    }
    const { plan: next, adjusted } = normalizePlan(plan, ctx, residency);
    if (adjusted) {
      setPlan(next);
      if (planReady && next.tenure !== plan.tenure) setAdjustedTenure(next.tenure);
    }
    if (!planReady) setPlanReady(true);
  }, [ctx, residency, plan, planReady, params]);

  useEffect(() => {
    if (!product?.id) return;
    trackProductEvent('application_started', {
      product_id: product.id,
      company_id: product.company_id,
      source: 'stepper_open',
    });
  }, [product?.id, product?.company_id]);

  // ---- resume an existing draft for this vehicle ------------------------
  const myApps = useQuery({
    queryKey: ['my-apps', 'resume-scan'],
    queryFn: fetchMyApplications,
    enabled: !!product && !resumeDecided && !draftId,
  });
  const existingDraftId = useMemo(
    () => myApps.data?.find((a) => a.status === 'draft' && a.product?.slug === productSlug)?.id ?? null,
    [myApps.data, productSlug],
  );
  const existingDraft = useQuery({
    queryKey: ['app', existingDraftId, 'resume'],
    queryFn: () => fetchDraftDetail(existingDraftId!),
    enabled: !!existingDraftId && !resumeDecided,
  });
  useEffect(() => {
    if (existingDraft.data && !resumeDecided) setResumeCandidate(existingDraft.data);
  }, [existingDraft.data, resumeDecided]);
  const showResume = !!resumeCandidate && !resumeDecided;

  function resumeDraft() {
    const candidate = resumeCandidate;
    if (!candidate) return;
    const hydrated = formFromSnapshot(candidate.customer_snapshot);
    const hydratedResidency = deriveIdentity(hydrated, locale).residency;
    const storedPlan = planFromPricingSnapshot(candidate.pricing_snapshot);
    const nextPlan = ctx ? normalizePlan(storedPlan ?? plan, ctx, hydratedResidency).plan : storedPlan ?? plan;
    setForm(hydrated);
    setPlan(nextPlan);
    setDraftId(candidate.id);
    const first = firstIncompleteStep(hydrated, nextPlan, ctx, hydratedResidency);
    setStep(first);
    setMaxReached(stepIndex(first));
    setResumeDecided(true);
  }

  useEffect(() => {
    if (!resumeCandidate || resumeDecided) return;
    resumeDraft();
    // Auto-resume the only draft for this vehicle so uploaded documents come back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeCandidate, resumeDecided]);

  function startOver() {
    // The API keeps one draft per vehicle, so a fresh start reuses the record
    // and simply overwrites it on the next save.
    setDraftId(resumeCandidate?.id ?? null);
    setResumeDecided(true);
  }

  // ---- local autosave (survives refresh / accidental close) -----------------
  // Restore any locally cached progress once, before the server draft (if any)
  // loads. A server-side draft resumes afterwards and takes precedence.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !product || !productSlug) return;
    hydratedRef.current = true;
    const cached = loadApplyDraft(user?.id, productSlug);
    if (!cached) return;
    setForm(cached.form);
    setPlan(cached.plan);
    setPlanReady(true);
    setStep(cached.step);
    setMaxReached(stepIndex(cached.step));
  }, [product, productSlug, user?.id]);

  // Mirror in-progress input to localStorage so nothing is lost mid-application.
  useEffect(() => {
    if (!productSlug || showResume) return;
    const started =
      step !== 'vehicle' ||
      !!(form.firstName || form.lastName || form.qid || form.dateOfBirth || form.phone || form.email);
    if (!started) return;
    saveApplyDraft(user?.id, productSlug, { form, plan, step });
  }, [form, plan, step, productSlug, user?.id, showResume]);

  // ---- derived plan numbers ---------------------------------------------
  const pricing = useMemo(() => (ctx ? buildPlanPricing(plan, ctx) : null), [plan, ctx]);
  const localViolations = useMemo(() => (ctx ? planViolations(plan, ctx, residency) : []), [plan, ctx, residency]);
  const violations = useMemo(() => {
    const serverCodes = new Set(serverViolations.map((v) => v.code));
    return [...serverViolations, ...localViolations.filter((v) => !serverCodes.has(v.code))];
  }, [localViolations, serverViolations]);
  const tenureOptions = useMemo(() => (ctx ? planTenureOptions(ctx, residency) : []), [ctx, residency]);
  const minDownPct = ctx ? planMinDownPct(ctx) : 0;
  const creditPreview = useMemo(() => creditPreviewFor(form, residency, pricing, violations), [form, residency, pricing, violations]);

  // ---- validation ---------------------------------------------------------
  const stepErrors = useMemo(
    () => ({ ...validateStep(step, form, plan, ctx, residency), ...serverErrors }),
    [step, form, plan, ctx, residency, serverErrors],
  );
  const visibleErrors = useMemo(() => {
    const out: FieldErrors = {};
    for (const [field, key] of Object.entries(stepErrors)) {
      if (submittedSteps[step] || touched[field] || serverErrors[field]) out[field] = key;
    }
    return out;
  }, [stepErrors, submittedSteps, step, touched, serverErrors]);

  const updateForm = useCallback((patch: Partial<ApplyForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setServerErrors((prev) => {
      const keys = Object.keys(patch).filter((k) => k in prev);
      if (!keys.length) return prev;
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
    setSaveState('idle');
  }, []);
  const updateGuarantor = useCallback((patch: Partial<GuarantorForm>) => {
    setForm((prev) => ({ ...prev, guarantor: { ...prev.guarantor, ...patch } }));
    setSaveState('idle');
  }, []);
  const markTouched = useCallback((field: string) => {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }, []);
  const onPlanChange = useCallback((next: ApplyPlan) => {
    setPlan(next);
    setAdjustedTenure(null);
    setServerViolations([]);
    setSaveState('idle');
  }, []);

  // ---- documents ------------------------------------------------------------
  const docsQuery = useQuery({
    queryKey: ['app-docs', draftId],
    queryFn: () => loadUploadedDocuments(draftId!),
    enabled: !!draftId,
  });
  const localSlots = useMemo(() => documentSlotsFor(documentProfile(form, residency)), [form, residency]);
  const slots = useMemo(
    () => (docsQuery.data?.slots?.length ? docsQuery.data.slots : localSlots),
    [docsQuery.data?.slots, localSlots],
  );
  const uploadedSet = useMemo(() => new Set(docsQuery.data?.uploaded ?? []), [docsQuery.data]);
  const uploadedAt = useMemo(() => docsQuery.data?.uploadedAt ?? {}, [docsQuery.data]);
  const staleSet = useMemo(
    () => new Set(staleDocumentCategories(slots, uploadedAt, docsQuery.data?.stale ?? [])),
    [slots, uploadedAt, docsQuery.data?.stale],
  );
  const requiredSlots = useMemo(() => slots.filter((s) => s.required), [slots]);
  const missingRequired = useMemo(() => requiredSlots.filter((s) => !uploadedSet.has(s.category)), [requiredSlots, uploadedSet]);
  const staleRequired = useMemo(
    () => requiredSlots.filter((s) => uploadedSet.has(s.category) && staleSet.has(s.category)),
    [requiredSlots, uploadedSet, staleSet],
  );
  const docsReady = missingRequired.length === 0 && staleRequired.length === 0;

  useEffect(() => {
    if (docsReady) setBanner(null);
  }, [docsReady]);

  useEffect(() => {
    if (step === 'documents') {
      setUploads((u) => {
        const next: Record<string, UploadState> = {};
        for (const [key, state] of Object.entries(u)) {
          if (state.status === 'error') continue;
          next[key] = state;
        }
        return next;
      });
    }
  }, [step]);

  async function onUpload(slot: DocumentSlot, file: File) {
    let id = draftId;
    if (!id) {
      id = await persistDraft();
      if (!id) return;
    }
    setUploads((u) => ({ ...u, [slot.category]: { status: 'uploading', error: undefined } }));
    setBanner(null);
    try {
      await uploadApplicationDocument(id, slot.category, file);
      setUploads((u) => ({ ...u, [slot.category]: { status: 'idle' } }));
      trackProductEvent('document_uploaded', { application_id: id, category: slot.category, source: 'stepper' });
      await docsQuery.refetch();
      void qc.invalidateQueries({ queryKey: ['app', id] });
    } catch (error) {
      setUploads((u) => ({
        ...u,
        [slot.category]: { status: 'error', error: error instanceof ApiError ? error.message : t('applyFlow.docs.uploadFailed') },
      }));
    }
  }
  function onRejectUpload(slot: DocumentSlot, message: string) {
    setUploads((u) => ({ ...u, [slot.category]: { status: 'error', error: message } }));
  }

  // ---- guarantor consent session --------------------------------------------
  const guarantorQuery = useQuery({
    queryKey: guarantorQueryKey(draftId),
    queryFn: () => fetchGuarantorSessionForApplication(draftId!),
    enabled: !!draftId && form.hasGuarantor,
    retry: false,
    refetchInterval: (query) => (guarantorSessionIsOpen(query.state.data ?? null) ? 10_000 : false),
  });
  const guarantorSession = form.hasGuarantor ? (guarantorQuery.data ?? null) : null;
  const guarantorNeedsFix = form.hasGuarantor && Object.keys(validateGuarantor(form)).length > 0;

  async function sendGuarantorRequest() {
    if (busy || guarantorBusy) return;
    if (Object.keys(validateGuarantor(form)).length) {
      setSubmittedSteps((s) => ({ ...s, guarantor: true }));
      setGuarantorNotice({ tone: 'warn', text: t('applyFlow.guarantor.consent.fixFirst') });
      focusFirstInvalid();
      return;
    }
    setGuarantorBusy('send');
    setGuarantorNotice(null);
    try {
      // The session is built from the saved snapshot, so the guarantor details go up first.
      const id = await persistDraft();
      if (!id) return;
      const created = await createGuarantorSession(id);
      qc.setQueryData(guarantorQueryKey(id), created);
      setGuarantorLink(created.link ?? null);
      setGuarantorNotice({ tone: 'success', text: t('applyFlow.guarantor.consent.sent', { phone: created.phone_masked }) });
    } catch (error) {
      const code = apiErrorCode(error);
      setGuarantorNotice({
        tone: 'danger',
        text: code === 'application_closed' ? t('applyFlow.error.generic') : t('applyFlow.guarantor.consent.sendError'),
      });
    } finally {
      setGuarantorBusy(null);
    }
  }

  async function resendGuarantorRequest() {
    if (!draftId || guarantorBusy) return;
    setGuarantorBusy('resend');
    setGuarantorNotice(null);
    try {
      const updated = await resendGuarantorSessionLink(draftId);
      qc.setQueryData(guarantorQueryKey(draftId), updated);
      if (updated.link) setGuarantorLink(updated.link);
      setGuarantorNotice({ tone: 'success', text: t('applyFlow.guarantor.consent.resent') });
    } catch (error) {
      const limited = errorStatus(error) === 429 || apiErrorCode(error) === 'otp_resend_limit';
      setGuarantorNotice({ tone: limited ? 'warn' : 'danger', text: limited ? t('applyFlow.guarantor.consent.resendLimit') : t('applyFlow.guarantor.consent.sendError') });
    } finally {
      setGuarantorBusy(null);
    }
  }

  async function cancelGuarantorRequest() {
    if (!draftId || guarantorBusy) return;
    setGuarantorBusy('cancel');
    setGuarantorNotice(null);
    try {
      await cancelGuarantorSession(draftId);
      setGuarantorLink(null);
      await guarantorQuery.refetch();
      setGuarantorNotice({ tone: 'info', text: t('applyFlow.guarantor.consent.cancelled') });
    } catch {
      setGuarantorNotice({ tone: 'danger', text: t('applyFlow.error.generic') });
    } finally {
      setGuarantorBusy(null);
    }
  }

  // ---- persistence ----------------------------------------------------------
  async function handleApiError(error: unknown, phase: 'save' | 'submit') {
    const code = applyErrorCode(error);
    switch (code) {
      case 'blocking_application': {
        const blockingId = blockingApplicationIdFrom(error) ?? (await fetchBlockingApplicationId());
        setBanner({
          tone: 'warn',
          text: t('applyFlow.error.blocking'),
          action: blockingId
            ? { label: t('applyFlow.error.openApplication'), to: `/app/applications/${blockingId}` }
            : { label: t('application.title'), to: '/app/applications' },
        });
        return;
      }
      case 'product_rule_violation':
      case 'vehicle_age_rule': {
        // The server's list (its env flags may make a soft rule hard) is shown
        // ahead of ours until the customer changes the plan.
        setServerViolations(ruleViolationsFrom(error));
        goTo('vehicle');
        setBanner({ tone: 'danger', text: t('applyFlow.error.ruleViolation') });
        return;
      }
      case 'dob_qid_mismatch':
        goTo('identity');
        setServerErrors({ dateOfBirth: 'applyFlow.identity.dobMismatch' });
        setBanner({ tone: 'danger', text: t('applyFlow.error.fixFields') });
        return;
      case 'identity_hold':
        setBanner({ tone: 'warn', text: t('applyFlow.error.identityHold') });
        return;
      case 'consents_required':
        goTo('consents');
        setBanner({ tone: 'warn', text: t('applyFlow.error.consentsRequired') });
        return;
      case 'documents_missing': {
        const labels = missingDocumentsFrom(error).map((category) => {
          const slot = slots.find((s) => s.category === category);
          return slot ? t(slot.labelKey) : category;
        });
        goTo('documents');
        setBanner({
          tone: 'warn',
          text: labels.length
            ? `${t('applyFlow.error.documentsRequired')} ${t('applyFlow.review.docsMissing', { list: labels.join(', ') })}`
            : t('applyFlow.error.documentsRequired'),
        });
        void docsQuery.refetch();
        return;
      }
      case 'documents_stale': {
        const labels = staleDocumentsFrom(error).map((category) => {
          const slot = slots.find((s) => s.category === category);
          return slot ? t(slot.labelKey) : category;
        });
        goTo('documents');
        setBanner({
          tone: 'warn',
          text: labels.length ? `${t('applyFlow.error.documentsStale')} ${labels.join(', ')}` : t('applyFlow.error.documentsStale'),
        });
        void docsQuery.refetch();
        return;
      }
      case 'guarantor_consent_required':
        goTo('guarantor');
        setBanner({ tone: 'warn', text: t('applyFlow.error.guarantorConsentRequired') });
        void guarantorQuery.refetch();
        return;
      case 'vehicle_identity_incomplete':
        setBanner({ tone: 'warn', text: t('applyFlow.error.vehicleIdentity') });
        return;
      case 'listing_not_available':
        setBanner({ tone: 'danger', text: t('applyFlow.error.listingUnavailable'), action: { label: t('applyFlow.notFound.browse'), to: '/' } });
        return;
      default:
        setBanner({ tone: 'danger', text: phase === 'save' ? t('applyFlow.error.saveFailed') : t('applyFlow.error.generic') });
    }
  }

  async function persistDraft(): Promise<string | null> {
    if (!ctx || !product || !offer) return null;
    const snapshot = snapshotFromForm(form, derived);
    const pricingSnapshot = buildPlanPricing(plan, ctx);
    setSaveState('saving');
    setBanner(null);
    try {
      if (draftId) {
        await patchDraft(draftId, { customerSnapshot: snapshot, pricingSnapshot, offerId: offer.id });
        setSaveState('saved');
        return draftId;
      }
      const created = await createDraft(
        { productId: product.id, offerId: offer.id, quoteToken, customerSnapshot: snapshot, pricingSnapshot },
        idempotencyKey.current,
      );
      setDraftId(created.id);
      setResumeDecided(true);
      if (created.resumed) {
        // A draft already existed server-side: the values just typed win.
        try {
          await patchDraft(created.id, { customerSnapshot: snapshot, pricingSnapshot, offerId: offer.id });
        } catch {
          /* the draft exists; later steps patch again */
        }
      }
      void qc.invalidateQueries({ queryKey: ['my-apps'] });
      setSaveState('saved');
      return created.id;
    } catch (error) {
      setSaveState('error');
      await handleApiError(error, 'save');
      return null;
    }
  }

  // ---- navigation -------------------------------------------------------------
  function goTo(next: ApplyStep) {
    setStep(next);
    setMaxReached((m) => Math.max(m, stepIndex(next)));
    setBanner(null);
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById('apply-step-card')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    stepTitleRef.current?.focus({ preventScroll: true });
  }, [step]);

  function focusFirstInvalid() {
    requestAnimationFrame(() => {
      const target =
        document.querySelector<HTMLElement>('#apply-step-card [aria-invalid="true"]') ??
        document.querySelector<HTMLElement>('#apply-step-card .dm-field__error');
      if (!target) return;
      // Take the customer straight to the first problem — they usually trigger
      // validation from the sticky bar at the bottom of the page.
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target.focus({ preventScroll: true });
    });
  }

  const currentIndex = stepIndex(step);
  const primaryDisabled =
    busy ||
    (step === 'vehicle' && violations.some((v) => v.severity === 'hard')) ||
    (step === 'documents' && (!draftId || docsQuery.isLoading || !docsReady)) ||
    (step === 'consents' && !consentStatus?.complete);

  async function goNext() {
    if (busy) return;
    const errors = validateStep(step, form, plan, ctx, residency);
    if (Object.keys(errors).length) {
      setSubmittedSteps((s) => ({ ...s, [step]: true }));
      focusFirstInvalid();
      return;
    }
    if (step === 'documents' && missingRequired.length) {
      setBanner({ tone: 'warn', text: t('applyFlow.docs.missing', { count: missingRequired.length }) });
      return;
    }
    if (step === 'documents' && staleRequired.length) {
      setBanner({ tone: 'warn', text: t('applyFlow.docs.staleCount', { count: staleRequired.length }) });
      return;
    }
    if (step === 'consents' && !consentStatus?.complete) {
      setBanner({ tone: 'warn', text: t('applyFlow.error.consentsRequired') });
      return;
    }
    const needsPersist =
      (currentIndex >= stepIndex('identity') && currentIndex <= stepIndex('guarantor')) ||
      step === 'documents' ||
      (step === 'vehicle' && !!draftId);
    if (needsPersist) {
      setBusy(true);
      const id = await persistDraft();
      setBusy(false);
      if (!id) return;
    }
    goTo(APPLY_STEPS[currentIndex + 1]);
  }

  function goBack() {
    if (currentIndex === 0) return;
    goTo(APPLY_STEPS[currentIndex - 1]);
  }

  async function saveForLater() {
    if (busy) return;
    if (!draftId && Object.keys(validateIdentity(form)).length) {
      goTo('identity');
      setSubmittedSteps((s) => ({ ...s, identity: true }));
      setBanner({ tone: 'info', text: t('applyFlow.error.fixFields') });
      focusFirstInvalid();
      return;
    }
    setBusy(true);
    const id = await persistDraft();
    setBusy(false);
    if (id) navigate('/app/dashboard');
  }

  async function submitAll() {
    if (busy) return;
    if (!declaration) {
      setDeclarationError(true);
      return;
    }
    setBusy(true);
    const id = await persistDraft();
    if (!id) {
      setBusy(false);
      return;
    }
    try {
      await submitApplication(id);
      trackProductEvent('application_submitted', {
        application_id: id,
        product_id: product?.id,
        company_id: product?.company_id,
        source: 'stepper',
      });
      clearApplyDraft(user?.id, productSlug);
      void qc.invalidateQueries({ queryKey: ['my-apps'] });
      void qc.invalidateQueries({ queryKey: ['apps-blocking'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['app', id] });
      navigate(`/app/applications/${id}`);
    } catch (error) {
      await handleApiError(error, 'submit');
    } finally {
      setBusy(false);
    }
  }

  function onPrimary() {
    if (step === 'review') void submitAll();
    else void goNext();
  }

  function onFormSubmit(e: FormEvent) {
    e.preventDefault();
    onPrimary();
  }

  const isComplete = useCallback(
    (s: ApplyStep): boolean => {
      switch (s) {
        case 'documents':
          return !!draftId && docsQuery.isSuccess && docsReady;
        case 'consents':
          return !!consentStatus?.complete;
        case 'review':
          return false;
        default:
          return Object.keys(validateStep(s, form, plan, ctx, residency)).length === 0;
      }
    },
    [draftId, docsQuery.isSuccess, docsReady, consentStatus?.complete, form, plan, ctx, residency],
  );

  // ---- render -----------------------------------------------------------------
  if (!productSlug) return <Navigate to="/" replace />;

  if (detail.isLoading) {
    return (
      <Shell title={t('applyFlow.title')}>
        <p className="dm-muted" role="status">
          {t('applyFlow.header.loading')}
        </p>
      </Shell>
    );
  }

  if (!available || !ctx || !product || !vehicle || !pricing || !offer) {
    return (
      <Shell title={t('applyFlow.notFound.title')}>
        <section className="dm-apply__card">
          <h1 className="dm-apply__step-title">{t('applyFlow.notFound.title')}</h1>
          <p className="dm-muted">{t('applyFlow.notFound.body')}</p>
          <p>
            <Link className="dm-btn-cta" to="/">
              {t('applyFlow.notFound.browse')}
            </Link>
          </p>
        </section>
      </Shell>
    );
  }

  const primaryLabel = step === 'review' ? (busy ? t('applyFlow.submitting') : t('applyFlow.submit')) : t('applyFlow.next');
  const showFixBanner = !!submittedSteps[step] && Object.keys(visibleErrors).length > 0;

  return (
    <div className="dm-apply">
      <DocumentMeta title={`${t('applyFlow.title')} · ${vehicle.title}`} />
      <header className="dm-band dm-apply__head">
        <div className="dm-band__inner">
          <MarketplaceNav />
          <div className="dm-apply__head-row">
            <div className="dm-apply__head-copy">
              <BrandBadge size="sm" className="dm-apply__brand" />
              <p className="dm-band__eyebrow">{t('applyFlow.header.eyebrow')}</p>
              <h1>{t('applyFlow.title')}</h1>
              <p className="dm-band__lead">
                {vehicle.title}
                {vehicle.year ? <span className="dm-numeric"> · {vehicle.year}</span> : null}
                {draftId ? <span className="dm-band__chip">{t('applyFlow.resumeChip')}</span> : null}
              </p>
            </div>
            <div className="dm-apply__head-actions">
              <span className="dm-apply__save-state" aria-live="polite">
                {saveState === 'saving' ? t('applyFlow.saving') : saveState === 'saved' ? t('applyFlow.saved') : ''}
              </span>
              <button type="button" className="dm-btn-ghost dm-apply__save" onClick={() => void saveForLater()} disabled={busy}>
                {t('applyFlow.saveDraft')}
              </button>
            </div>
          </div>
          <StepProgress current={step} maxReached={maxReached} isComplete={isComplete} onSelect={goTo} />
        </div>
      </header>

      <div className="dm-apply__layout">
        <main className="dm-apply__main">
          {showResume ? (
            <section className="dm-apply__card dm-resume" role="dialog" aria-labelledby="apply-resume-title" aria-describedby="apply-resume-body">
              <h2 id="apply-resume-title" className="dm-apply__step-title">
                {t('applyFlow.resumeTitle')}
              </h2>
              <p id="apply-resume-body" className="dm-step__intro">
                {t('applyFlow.resumeBody', { vehicle: vehicle.title })}
              </p>
              <div className="dm-apply__actions">
                <button type="button" className="dm-btn-ghost dm-btn-ghost--on-light" onClick={startOver}>
                  {t('applyFlow.startOver')}
                </button>
                <button type="button" className="dm-btn-cta dm-apply__next" onClick={resumeDraft} autoFocus>
                  {t('applyFlow.resume')}
                </button>
              </div>
            </section>
          ) : (
            <form className="dm-apply__card" id="apply-step-card" onSubmit={onFormSubmit} noValidate aria-labelledby="apply-step-title">
              <p className="dm-apply__step-count">{t('applyFlow.progress', { current: currentIndex + 1, total: APPLY_STEPS.length })}</p>
              <h2 id="apply-step-title" ref={stepTitleRef} tabIndex={-1} className="dm-apply__step-title">
                {t(STEP_TITLE_KEY[step])}
              </h2>

              {banner ? (
                <Notice
                  tone={banner.tone}
                  live="polite"
                  action={
                    banner.action ? (
                      <Link className="dm-btn-ghost dm-btn-ghost--on-light" to={banner.action.to}>
                        {banner.action.label}
                      </Link>
                    ) : undefined
                  }
                >
                  {banner.text}
                </Notice>
              ) : null}
              {showFixBanner ? <Notice tone="danger">{t('applyFlow.error.fixFields')}</Notice> : null}

              {step === 'vehicle' ? (
                <VehiclePlanStep
                  ctx={ctx}
                  vehicle={vehicle}
                  plan={plan}
                  onPlanChange={onPlanChange}
                  residency={residency}
                  pricing={pricing}
                  violations={violations}
                  tenureOptions={tenureOptions}
                  minDownPct={minDownPct}
                  adjustedTenure={adjustedTenure}
                />
              ) : null}
              {step === 'identity' ? (
                <IdentityStep form={form} derived={derived} errors={visibleErrors} onChange={updateForm} onBlur={markTouched} prefilled={prefilled} />
              ) : null}
              {step === 'employment' ? (
                <EmploymentStep
                  form={form}
                  errors={visibleErrors}
                  onChange={updateForm}
                  onBlur={markTouched}
                  residency={residency}
                  installment={pricing.monthly}
                  financedAmount={Math.max(pricing.list_price - pricing.down_payment, 0)}
                />
              ) : null}
              {step === 'guarantor' ? (
                <GuarantorStep
                  form={form}
                  errors={visibleErrors}
                  onChange={updateForm}
                  onGuarantorChange={updateGuarantor}
                  onBlur={markTouched}
                  consentPanel={
                    <GuarantorConsentPanel
                      session={guarantorSession}
                      loading={guarantorQuery.isLoading}
                      error={guarantorQuery.isError}
                      draftExists={!!draftId}
                      needsFix={guarantorNeedsFix}
                      busy={guarantorBusy}
                      link={guarantorLink}
                      notice={guarantorNotice}
                      onSend={() => void sendGuarantorRequest()}
                      onResend={() => void resendGuarantorRequest()}
                      onCancel={() => void cancelGuarantorRequest()}
                    />
                  }
                />
              ) : null}
              {step === 'documents' ? (
                <DocumentsStep
                  slots={slots}
                  uploaded={uploadedSet}
                  stale={staleSet}
                  uploadedAt={uploadedAt}
                  fileNames={docsQuery.data?.names ?? {}}
                  uploads={uploads}
                  onUpload={(slot, file) => void onUpload(slot, file)}
                  onReject={onRejectUpload}
                  onRefresh={() => void docsQuery.refetch()}
                  disabled={!draftId}
                  loading={docsQuery.isFetching}
                  requiredDone={requiredSlots.length - missingRequired.length}
                  requiredTotal={requiredSlots.length}
                  staleRequired={staleRequired.length}
                  ekycRequired={docsQuery.data?.ekycRequired}
                />
              ) : null}
              {step === 'consents' ? (
                <div className="dm-step">
                  <p className="dm-step__intro">{t('applyFlow.consents.intro')}</p>
                  <ConsentChecklist applicationId={draftId} onStatusChange={setConsentStatus} hideIntro />
                </div>
              ) : null}
              {step === 'review' ? (
                <ReviewStep
                  form={form}
                  derived={derived}
                  vehicle={vehicle}
                  pricing={pricing}
                  tenure={plan.tenure}
                  slots={slots}
                  uploaded={uploadedSet}
                  stale={staleSet}
                  consentStatus={consentStatus}
                  guarantorSession={guarantorSession}
                  creditPreview={creditPreview}
                  declaration={declaration}
                  declarationError={declarationError}
                  onDeclarationChange={(v) => {
                    setDeclaration(v);
                    if (v) setDeclarationError(false);
                  }}
                  onEdit={goTo}
                />
              ) : null}

              <div className="dm-apply__actions">
                {currentIndex > 0 ? (
                  <button type="button" className="dm-btn-ghost dm-btn-ghost--on-light" onClick={goBack} disabled={busy}>
                    {t('applyFlow.back')}
                  </button>
                ) : (
                  <span />
                )}
                <button type="submit" className="dm-btn-cta dm-apply__next" disabled={primaryDisabled} aria-busy={busy || undefined}>
                  {primaryLabel}
                </button>
              </div>
            </form>
          )}
        </main>

        <div className="dm-apply__rail">
          <PlanSummaryRail
            vehicle={vehicle}
            pricing={pricing}
            tenure={plan.tenure}
            onChangePlan={step !== 'vehicle' && !showResume ? () => goTo('vehicle') : undefined}
            note={residency === 'expat' ? t('applyFlow.vehicle.tenureCapNote', { max: Math.max(...tenureOptions, 0) }) : undefined}
          />
        </div>
      </div>

      {!showResume ? (
        <ApplyStickyBar monthly={pricing.monthly} primaryLabel={primaryLabel} onPrimary={onPrimary} disabled={primaryDisabled} busy={busy} />
      ) : null}
    </div>
  );
}
