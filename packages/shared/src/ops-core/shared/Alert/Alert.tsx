import React from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';

export interface AlertProps {
  variant?: 'error' | 'warning' | 'info' | 'success';
  title?: string;
  /** Small action rendered at the end (e.g. "Run check", "Retry"). */
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const ICONS = {
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
  success: CircleCheck,
} as const;

/**
 * Inline alert — Phase 1 §07. Soft ground, tinted border, 3px bar, leading icon, and always
 * says what to do next. Use for anything the user must act on; toasts are for confirmations only.
 */
export const Alert: React.FC<AlertProps> = ({ variant = 'info', title, action, children, className = '' }) => {
  const role = variant === 'error' ? 'alert' : 'status';
  const Icon = ICONS[variant];
  return (
    <div className={`blox-alert blox-alert--${variant} ${className}`.trim()} role={role}>
      <span className="blox-alert__bar" aria-hidden />
      <Icon size={16} strokeWidth={1.75} className="blox-alert__icon" aria-hidden />
      <div className="blox-alert__content">
        {title ? <strong className="blox-alert__title">{title}</strong> : null}
        {children ? <div className="blox-alert__body">{children}</div> : null}
      </div>
      {action ? <div className="blox-alert__action">{action}</div> : null}
    </div>
  );
};
