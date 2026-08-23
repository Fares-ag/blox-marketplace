import { useState, type ComponentType } from 'react';
import { Box, Button, Step, StepLabel, Stepper } from '@mui/material';

export type StepProps<TData> = {
  data: TData;
  updateData: (data: Partial<TData>) => void;
  onNext: () => void;
  onPrevious: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
};

export type StepConfig<TData> = {
  label: string;
  component: ComponentType<StepProps<TData>>;
};

export function MultiStepForm<TData extends Record<string, unknown>>({
  steps,
  initialData,
  onSubmit,
  onCancel,
  canAdvance,
}: {
  steps: StepConfig<TData>[];
  initialData: TData;
  onSubmit: (data: TData) => void | Promise<void>;
  onCancel?: () => void;
  canAdvance?: (step: number, data: TData) => boolean;
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<TData>(initialData);
  const Current = steps[activeStep].component;
  const isFirstStep = activeStep === 0;
  const isLastStep = activeStep === steps.length - 1;
  const allowed = canAdvance ? canAdvance(activeStep, formData) : true;

  return (
    <Box>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
        {steps.map((step) => (
          <Step key={step.label}>
            <StepLabel>{step.label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <Box sx={{ mb: 3 }}>
        <Current
          data={formData}
          updateData={(next) => setFormData((prev) => ({ ...prev, ...next }))}
          onNext={() => setActiveStep((s) => s + 1)}
          onPrevious={() => setActiveStep((s) => s - 1)}
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
        />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        {onCancel ? (
          <Button color="inherit" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <span />
        )}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {!isFirstStep && (
            <Button onClick={() => setActiveStep((s) => s - 1)}>Previous</Button>
          )}
          {!isLastStep ? (
            <Button variant="contained" disabled={!allowed} onClick={() => setActiveStep((s) => s + 1)}>
              Next
            </Button>
          ) : (
            <Button variant="contained" disabled={!allowed} onClick={() => void onSubmit(formData)}>
              Submit
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}
