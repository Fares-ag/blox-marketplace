import React, { useState } from 'react';
import { Button as CustomButton } from '../../core/Button/Button';

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
}

interface MultiStepFormProps<TData = any> {
  steps: StepConfig<TData>[];
  initialData?: TData;
  onSubmit: (data: TData) => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  labels?: { cancel?: string; previous?: string; next?: string; submit?: string };
}

/** Multi-step form with a native stepper — no MUI (Phase 2). Steps are 1-based in the rail because order carries meaning here. */
export const MultiStepForm: React.FC<MultiStepFormProps> = ({
  steps,
  initialData = {} as any,
  onSubmit,
  onCancel,
  isSubmitting = false,
  labels,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<any>(initialData);
  const [stepError, setStepError] = useState<string | null>(null);

  const CurrentStepComponent = steps[activeStep].component;

  const validateCurrentStep = () => {
    const message = steps[activeStep].validate?.(formData) ?? null;
    setStepError(message);
    return message == null;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    if (activeStep < steps.length - 1) setActiveStep((prev) => prev + 1);
  };
  const handleBack = () => {
    setStepError(null);
    setActiveStep((prev) => Math.max(0, prev - 1));
  };
  const handleUpdateData = (stepData: any) => {
    setStepError(null);
    setFormData((prev: any) => ({ ...(prev || {}), ...(stepData || {}) }));
  };
  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!validateCurrentStep()) return;
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

      <div className="blox-stepper-form__content">
        <CurrentStepComponent
          data={formData}
          updateData={handleUpdateData}
          onNext={handleNext}
          onPrevious={handleBack}
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
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
