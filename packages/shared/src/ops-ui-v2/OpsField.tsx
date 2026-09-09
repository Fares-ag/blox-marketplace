import { useState } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

type FieldShellProps = {
  label: string;
  hint?: string;
  error?: string;
  fullWidth?: boolean;
  /** Shows the red asterisk after the label (mirrors the control's `required`). */
  required?: boolean;
  /** Writes "Optional" (or a custom word) at the end of the label line. */
  optionalLabel?: string | boolean;
  /** Mono, tabular digits — for QIDs, phone numbers, amounts and references. */
  mono?: boolean;
  htmlFor?: string;
  children: ReactNode;
};

/**
 * Field shell — Phase 1 §04. Label, control, hint and error in one place; the hint stays
 * visible when an error is shown so guidance is never replaced by the complaint.
 */
function OpsFieldShell({ label, hint, error, fullWidth, required, optionalLabel, mono, htmlFor, children }: FieldShellProps) {
  const classes = [
    'blox-field',
    error ? 'blox-field--error' : '',
    fullWidth ? 'blox-form-grid__full' : '',
    mono ? 'blox-field--mono' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes}>
      <label className="blox-field__label" htmlFor={htmlFor}>
        <span>{label}</span>
        {required && (
          <span className="blox-field__req" aria-hidden>
            *
          </span>
        )}
        {optionalLabel && !required && (
          <span className="blox-field__optional">{optionalLabel === true ? 'Optional' : optionalLabel}</span>
        )}
      </label>
      {children}
      {hint ? <p className="blox-field__hint">{hint}</p> : null}
      {error ? (
        <p className="blox-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type ShellExtras = {
  label: string;
  hint?: string;
  error?: string;
  fullWidth?: boolean;
  optionalLabel?: string | boolean;
  mono?: boolean;
};

export function OpsField({
  label,
  hint,
  error,
  fullWidth,
  optionalLabel,
  mono,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & ShellExtras) {
  return (
    <OpsFieldShell
      label={label}
      hint={hint}
      error={error}
      fullWidth={fullWidth}
      required={rest.required}
      optionalLabel={optionalLabel}
      mono={mono}
      htmlFor={rest.id}
    >
      <input aria-invalid={error ? true : undefined} {...rest} />
    </OpsFieldShell>
  );
}

export function OpsSelect({
  label,
  hint,
  error,
  fullWidth,
  optionalLabel,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & ShellExtras & { children: ReactNode }) {
  return (
    <OpsFieldShell
      label={label}
      hint={hint}
      error={error}
      fullWidth={fullWidth}
      required={rest.required}
      optionalLabel={optionalLabel}
      htmlFor={rest.id}
    >
      <select aria-invalid={error ? true : undefined} {...rest}>
        {children}
      </select>
    </OpsFieldShell>
  );
}

export function OpsTextarea({
  label,
  hint,
  error,
  fullWidth,
  optionalLabel,
  mono,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & ShellExtras) {
  return (
    <OpsFieldShell
      label={label}
      hint={hint}
      error={error}
      fullWidth={fullWidth}
      required={rest.required}
      optionalLabel={optionalLabel}
      mono={mono}
      htmlFor={rest.id}
    >
      <textarea aria-invalid={error ? true : undefined} {...rest} />
    </OpsFieldShell>
  );
}

type OpsNumberFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> &
  ShellExtras & {
    value: number | null;
    onValueChange: (value: number) => void;
    /** Inclusive band the committed value is held inside on blur. */
    min?: number;
    max?: number;
    /** Committed when the box is left empty. */
    emptyValue?: number;
  };

function clampNumber(value: number, min?: number, max?: number): number {
  let out = value;
  if (typeof min === 'number' && out < min) out = min;
  if (typeof max === 'number' && out > max) out = max;
  return out;
}

/**
 * Numeric input that keeps what the user typed while they are typing.
 *
 * A plain `value={n}` number box mangles its own contents: emptying it parses
 * to 0, React writes "0" back, and the next keystroke reads "030". Holding the
 * draft text locally lets the box be empty, and shows a real 0 instead of
 * blanking it the way `value={n || ''}` does. The band is applied on blur, not
 * per keystroke, so typing "3" on the way to "30" is not snapped to the
 * minimum.
 */
export function OpsNumberField({
  label,
  hint,
  error,
  fullWidth,
  optionalLabel,
  mono,
  value,
  onValueChange,
  min,
  max,
  emptyValue = 0,
  onBlur,
  ...rest
}: OpsNumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value == null ? '' : String(value));

  return (
    <OpsFieldShell
      label={label}
      hint={hint}
      error={error}
      fullWidth={fullWidth}
      required={rest.required}
      optionalLabel={optionalLabel}
      mono={mono}
      htmlFor={rest.id}
    >
      <input
        type="number"
        inputMode="decimal"
        aria-invalid={error ? true : undefined}
        {...rest}
        min={min}
        max={max}
        value={shown}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          if (raw.trim() === '') {
            onValueChange(emptyValue);
            return;
          }
          const parsed = Number(raw);
          if (Number.isFinite(parsed)) onValueChange(parsed);
        }}
        onBlur={(e) => {
          const raw = e.target.value.trim();
          const parsed = raw === '' ? emptyValue : Number(raw);
          const committed = clampNumber(Number.isFinite(parsed) ? parsed : emptyValue, min, max);
          setDraft(null);
          onValueChange(committed);
          onBlur?.(e);
        }}
      />
    </OpsFieldShell>
  );
}
export function OpsFormGrid({ children }: { children: ReactNode }) {
  return <div className="blox-form-grid">{children}</div>;
}

export function OpsContentCard({
  children,
  className,
  staticHover,
}: {
  children: ReactNode;
  className?: string;
  staticHover?: boolean;
}) {
  return (
    <section className={`blox-content-card${staticHover ? ' blox-content-card--static' : ''}${className ? ` ${className}` : ''}`}>
      {children}
    </section>
  );
}
