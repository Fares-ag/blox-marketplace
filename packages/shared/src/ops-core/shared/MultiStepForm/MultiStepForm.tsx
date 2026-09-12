import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button as CustomButton } from '../../core/Button/Button';

/** Chosen files cannot be serialised; keep them in memory for the tab session. */
const fileHold = new Map<string, Partial<Record<string, File>>>();

function stashFiles(storageKey: string | undefined, files: unknown) {
  if (!storageKey || !files || typeof files !== 'object') return;
  const prev = fileHold.get(storageKey) ?? {};
  fileHold.set(storageKey, { ...prev, ...(files as Partial<Record<string, File>>) });
}

function heldFiles(storageKey: string | undefined): Partial<Record<string, File>> {
  if (!storageKey) return {};
  return fileHold.get(storageKey) ?? {};
}

/** Draft survives a reload, a wrong turn, or a session that has to be renewed. */
function readDraft(storageKey: string | undefined): unknown {
  if (!storageKey || typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeDraft(storageKey: string | undefined, data: unknown): void {
  if (!storageKey || typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(data));
  } catch {
    // A full or blocked store must not take the form down with it.
  }
}

/**
 * Drops the fields a draft must not carry across a reload. Chosen files are the
 * case that matters: `JSON.stringify(File)` yields `{}`, and restoring that
 * empty object in place of a file would fail the upload while still looking
 * like a file was attached.
 */
function omitKeys(data: any, keys: string[] | undefined): any {
  if (!keys?.length || !data || typeof data !== 'object') return data;
  const out: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const key of keys) delete out[key];
  return out;
}

export function clearMultiStepDraft(storageKey: string): void {
  fileHold.delete(storageKey);
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Nothing to do; the draft simply outlives this submit.
  }
}

export interface StepConfig<TData = any> {
  label: string;
  component: React.ComponentType<StepProps<TData>>;
  /** When set, blocks Next/Submit until this returns null. */
  validate?: (data: TData) => string | null;
}

export interface StepProps<TData = any> {
  data: TData;
  updateData: (data: any) => void;
  onNext: () => void;
  onPrevious: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  /** True after the user clicked Next/Submit and the step validation failed — lets the step component highlight all invalid fields. */
  submitted: boolean;
}

interface MultiStepFormProps<TData = any> {
  steps: StepConfig<TData>[];
  initialData?: TData;
  onSubmit: (data: TData) => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  labels?: { cancel?: string; previous?: string; next?: string; submit?: string };
  /**
   * When set, the entered data and the current step are mirrored into
   * `sessionStorage` under this key, so leaving the page or signing back in
   * does not throw the work away. Clear it after a successful submit with
   * `clearMultiStepDraft`.
   */
  storageKey?: string;
  /** Fields excluded from the stored draft, e.g. chosen `File` objects. */
  storageOmitKeys?: string[];
}

/** Multi-step form with a native stepper — no MUI (Phase 2). Steps are 1-based in the rail because order carries meaning here. */
export const MultiStepForm: React.FC<MultiStepFormProps> = ({
  steps,
  initialData = {} as any,
  onSubmit,
  onCancel,
  isSubmitting = false,
  labels,
  storageKey,
  storageOmitKeys,
}) => {
  const restored = useRef<{ step?: number; data?: any } | null>(null);
  if (restored.current === null) {
    const saved = readDraft(storageKey) as { step?: number; data?: any } | null;
    restored.current = saved && typeof saved === 'object' ? saved : {};
  }

  const [activeStep, setActiveStep] = useState(() => {
    const step = restored.current?.step;
    return typeof step === 'number' && step >= 0 && step < steps.length ? step : 0;
  });
  const [formData, setFormData] = useState<any>(() => {
    const data = restored.current?.data;
    const merged = data && typeof data === 'object' ? { ...(initialData as any), ...data } : initialData;
    const files = heldFiles(storageKey);
    return Object.keys(files).length ? { ...(merged as any), files: { ...((merged as any).files ?? {}), ...files } } : merged;
  });
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const firstRender = useRef(true);

  const omitRef = useRef(storageOmitKeys);
  omitRef.current = storageOmitKeys;

  useEffect(() => {
    if (formData?.files) stashFiles(storageKey, formData.files);
    writeDraft(storageKey, { step: activeStep, data: omitKeys(formData, omitRef.current) });
  }, [storageKey, activeStep, formData]);

  // Every step opens at its own top. Without this the next step inherits the
  // scroll position of the last one and appears to open halfway down. The page
  // may scroll on the window or inside the ops shell, so reset both.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    for (let el = contentRef.current?.parentElement; el; el = el.parentElement) {
      if (el.scrollTop > 0) el.scrollTop = 0;
    }
  }, [activeStep]);

  const CurrentStepComponent = steps[activeStep].component;

  const validateCurrentStep = () => {
    const message = steps[activeStep].validate?.(formData) ?? null;
    setStepError(message);
    return message == null;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) {
      setSubmitted(true);
      return;
    }
    setSubmitted(false);
    if (activeStep < steps.length - 1) setActiveStep((prev) => prev + 1);
  };
  const handleBack = () => {
    setStepError(null);
    setSubmitted(false);
    setActiveStep((prev) => Math.max(0, prev - 1));
  };
  const handleUpdateData = useCallback((stepData: any) => {
    setStepError(null);
    setFormData((prev: any) => {
      const next = { ...(prev || {}), ...(stepData || {}) };
      if (stepData?.files && prev?.files) {
        next.files = { ...prev.files, ...stepData.files };
      }
      if (next.files) stashFiles(storageKey, next.files);
      return next;
    });
  }, [storageKey]);
  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!validateCurrentStep()) {
      setSubmitted(true);
      return;
    }
    try {
      await onSubmit(formData);
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Form submission error:', error);
    }
  };

  const isFirstStep = activeStep === 0;
  const isLastStep = activeStep === steps.length - 1;

  return (
    <div className="blox-stepper-form">
      <ol className="blox-stepper" aria-label="Steps">
        {steps.map((step, index) => {
          const state = index < activeStep ? 'done' : index === activeStep ? 'active' : 'todo';
          return (
            <li key={index} className={`blox-stepper__step is-${state}`} aria-current={state === 'active' ? 'step' : undefined}>
              <span className="blox-stepper__index">{state === 'done' ? '✓' : index + 1}</span>
              <span className="blox-stepper__label">{step.label}</span>
            </li>
          );
        })}
      </ol>

      <div className="blox-stepper-form__content" ref={contentRef}>
        <CurrentStepComponent
          data={formData}
          updateData={handleUpdateData}
          onNext={handleNext}
          onPrevious={handleBack}
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          submitted={submitted}
        />
      </div>

      {stepError && (
        <div className="blox-form-error blox-stepper-form__error" role="alert">
          {stepError}
        </div>
      )}

      <div className="blox-stepper-form__actions">
        {onCancel && (
          <CustomButton variant="ghost" onClick={onCancel}>
            {labels?.cancel ?? 'Cancel'}
          </CustomButton>
        )}
        <div className="blox-stepper-form__nav">
          {!isFirstStep && (
            <CustomButton variant="secondary" onClick={handleBack}>
              {labels?.previous ?? 'Previous'}
            </CustomButton>
          )}
          {!isLastStep ? (
            <CustomButton variant="primary" disabled={isSubmitting} onClick={handleNext}>
              {labels?.next ?? 'Next'}
            </CustomButton>
          ) : (
            <CustomButton variant="primary" disabled={isSubmitting} loading={isSubmitting} onClick={handleSubmit}>
              {labels?.submit ?? 'Submit'}
            </CustomButton>
          )}
        </div>
      </div>
    </div>
  );
};
