import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

type FieldShellProps = {
  label: string;
  hint?: string;
  error?: string;
  fullWidth?: boolean;
  children: ReactNode;
};

function OpsFieldShell({ label, hint, error, fullWidth, children }: FieldShellProps) {
  return (
    <div className={`blox-field${error ? ' blox-field--error' : ''}${fullWidth ? ' blox-form-grid__full' : ''}`}>
      <label className="blox-field__label">{label}</label>
      {children}
      {error ? <p className="blox-field__error">{error}</p> : hint ? <p className="blox-field__hint">{hint}</p> : null}
    </div>
  );
}

export function OpsField({
  label,
  hint,
  error,
  fullWidth,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  fullWidth?: boolean;
}) {
  return (
    <OpsFieldShell label={label} hint={hint} error={error} fullWidth={fullWidth}>
      <input {...rest} />
    </OpsFieldShell>
  );
}

export function OpsSelect({
  label,
  hint,
  error,
  fullWidth,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
  fullWidth?: boolean;
  children: ReactNode;
}) {
  return (
    <OpsFieldShell label={label} hint={hint} error={error} fullWidth={fullWidth}>
      <select {...rest}>{children}</select>
    </OpsFieldShell>
  );
}

export function OpsTextarea({
  label,
  hint,
  error,
  fullWidth,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
  fullWidth?: boolean;
}) {
  return (
    <OpsFieldShell label={label} hint={hint} error={error} fullWidth={fullWidth}>
      <textarea {...rest} />
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
