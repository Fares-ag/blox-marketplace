/**
 * Accessible form primitives shared by the apply stepper, the eligibility
 * calculator and the consent centre. Every control is labelled, hints and
 * errors are wired through `aria-describedby`, and layout uses logical CSS so
 * the Arabic RTL rendering needs no overrides.
 */
import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes } from 'react';

export type FieldA11y = {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  'aria-required'?: true;
};

type FieldProps = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  /** Success/neutral status shown in place of the hint (e.g. "Matches your Qatar ID"). */
  status?: ReactNode;
  required?: boolean;
  optionalLabel?: ReactNode;
  className?: string;
  children: (a11y: FieldA11y) => ReactNode;
};

export function Field({ id, label, hint, error, status, required, optionalLabel, className, children }: FieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const statusId = `${id}-status`;
  const describedBy = [hint ? hintId : null, status ? statusId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  const a11y: FieldA11y = { id };
  if (describedBy) a11y['aria-describedby'] = describedBy;
  if (error) a11y['aria-invalid'] = true;
  if (required) a11y['aria-required'] = true;

  return (
    <div className={`dm-field${error ? ' is-invalid' : ''}${className ? ` ${className}` : ''}`}>
      <label className="dm-field__label" htmlFor={id}>
        <span>{label}</span>
        {!required && optionalLabel ? <span className="dm-field__optional">{optionalLabel}</span> : null}
      </label>
      {children(a11y)}
      {hint ? (
        <p className="dm-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {status ? (
        <p className="dm-field__status" id={statusId}>
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="dm-field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & FieldA11y & { numeric?: boolean; ref?: Ref<HTMLInputElement> };

export function TextInput({ className, numeric, ref, ...rest }: TextInputProps) {
  return (
    <input
      {...rest}
      ref={ref}
      className={`dm-input${numeric ? ' dm-numeric' : ''}${className ? ` ${className}` : ''}`}
      inputMode={rest.inputMode ?? (numeric ? 'decimal' : undefined)}
    />
  );
}

type SelectInputProps = SelectHTMLAttributes<HTMLSelectElement> &
  FieldA11y & {
    options: ReadonlyArray<{ value: string; label: string; disabled?: boolean }>;
    placeholder?: string;
  };

export function SelectInput({ className, options, placeholder, ...rest }: SelectInputProps) {
  return (
    <select {...rest} className={`dm-input dm-select${className ? ` ${className}` : ''}`}>
      {placeholder != null ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

type ChipOption<T extends string> = { value: T; label: ReactNode; description?: ReactNode; disabled?: boolean };

type ChipRadioGroupProps<T extends string> = {
  name: string;
  legend: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  options: ReadonlyArray<ChipOption<T>>;
  value: T | '';
  onChange: (value: T) => void;
  onBlur?: () => void;
  size?: 'sm' | 'md';
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

/** Radio buttons rendered as chips — native inputs keep keyboard and screen-reader behaviour. */
export function ChipRadioGroup<T extends string>({
  name,
  legend,
  hint,
  error,
  options,
  value,
  onChange,
  onBlur,
  size = 'md',
  required,
  disabled = false,
  className,
}: ChipRadioGroupProps<T>) {
  const base = useId();
  const hintId = `${base}-hint`;
  const errorId = `${base}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <fieldset
      className={`dm-field dm-chipset${error ? ' is-invalid' : ''}${className ? ` ${className}` : ''}`}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      aria-required={required ? true : undefined}
    >
      <legend className="dm-field__label">{legend}</legend>
      <div className={`dm-chipset__options dm-chipset__options--${size}`} role="presentation">
        {options.map((o) => {
          const id = `${base}-${o.value}`;
          const checked = value === o.value;
          return (
            <label key={o.value} htmlFor={id} className={`dm-chip${checked ? ' is-checked' : ''}${o.disabled || disabled ? ' is-disabled' : ''}`}>
              <input
                type="radio"
                id={id}
                name={name}
                value={o.value}
                checked={checked}
                disabled={o.disabled || disabled}
                onChange={() => onChange(o.value)}
                onBlur={onBlur}
              />
              <span className="dm-chip__label">{o.label}</span>
              {o.description ? <span className="dm-chip__desc">{o.description}</span> : null}
            </label>
          );
        })}
      </div>
      {hint ? (
        <p className="dm-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="dm-field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export type NoticeTone = 'info' | 'success' | 'warn' | 'danger';

export function Notice({
  tone = 'info',
  title,
  children,
  action,
  className,
  live,
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** Announce to assistive tech; use `assertive` for blocking errors. */
  live?: 'polite' | 'assertive';
}) {
  const role = tone === 'danger' ? 'alert' : live ? 'status' : undefined;
  return (
    <div className={`dm-notice dm-notice--${tone}${className ? ` ${className}` : ''}`} role={role} aria-live={live}>
      <span className="dm-notice__icon" aria-hidden>
        {tone === 'success' ? '✓' : tone === 'danger' ? '!' : tone === 'warn' ? '!' : 'i'}
      </span>
      <div className="dm-notice__body">
        {title ? <p className="dm-notice__title">{title}</p> : null}
        {children ? <div className="dm-notice__text">{children}</div> : null}
        {action ? <div className="dm-notice__action">{action}</div> : null}
      </div>
    </div>
  );
}

export type PillTone = 'neutral' | 'success' | 'warn' | 'danger' | 'info';

export function Pill({ tone = 'neutral', children, className }: { tone?: PillTone; children: ReactNode; className?: string }) {
  return <span className={`dm-pill dm-pill--${tone}${className ? ` ${className}` : ''}`}>{children}</span>;
}

/** Visually hidden text for screen readers. */
export function SrOnly({ children }: { children: ReactNode }) {
  return <span className="dm-sr-only">{children}</span>;
}

/** Range + number pair for percentages (down payment). */
export function PercentSlider({
  id,
  label,
  hint,
  error,
  min,
  max,
  value,
  onChange,
  onBlur,
  step = 1,
  valueText,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  step?: number;
  valueText?: string;
}) {
  return (
    <Field id={id} label={label} hint={hint} error={error} required>
      {(a11y) => (
        <div className="dm-slider">
          <input
            type="range"
            className="dm-slider__range"
            min={min}
            max={max}
            step={step}
            value={value}
            aria-label={typeof label === 'string' ? label : undefined}
            aria-valuetext={valueText}
            onChange={(e) => onChange(Number(e.target.value))}
            onBlur={onBlur}
          />
          <div className="dm-slider__number">
            <input
              {...a11y}
              type="number"
              className="dm-input dm-numeric"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
              onBlur={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) onChange(min);
                else onChange(Math.min(Math.max(n, min), max));
                onBlur?.();
              }}
            />
            <span aria-hidden>%</span>
          </div>
          <div className="dm-slider__scale" aria-hidden>
            <span className="dm-numeric">{min}%</span>
            <span className="dm-numeric">{max}%</span>
          </div>
        </div>
      )}
    </Field>
  );
}
