import React from 'react';

/**
 * Ops button — Phase 1 §03. Native <button> styled by `styles/ops/_buttons.scss`.
 * Legacy MUI-era variant names are still accepted and alias onto the five real ones.
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'icon'
  // legacy aliases
  | 'secondary-neutral'
  | 'destructive'
  | 'tertiary'
  | 'outlined'
  | 'contained'
  | 'text'
  | 'small';

export type ButtonSize = 'md' | 'sm';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows the spinner, swaps out the leading icon and disables the button. */
  loading?: boolean;
  /** Danger only: solid red fill, reserved for the confirm step of a destructive dialog. */
  solid?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

const VARIANT_CLASS: Record<ButtonVariant, 'primary' | 'secondary' | 'ghost' | 'danger'> = {
  primary: 'primary',
  contained: 'primary',
  small: 'primary',
  secondary: 'secondary',
  'secondary-neutral': 'secondary',
  outlined: 'secondary',
  danger: 'danger',
  destructive: 'danger',
  ghost: 'ghost',
  tertiary: 'ghost',
  text: 'ghost',
  icon: 'ghost',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size,
    loading = false,
    solid = false,
    disabled,
    className = '',
    children,
    type = 'button',
    startIcon,
    endIcon,
    ...rest
  },
  ref,
) {
  const resolvedSize = size ?? (variant === 'small' ? 'sm' : 'md');
  const classes = [
    'blox-btn',
    `blox-btn--${VARIANT_CLASS[variant] ?? 'primary'}`,
    resolvedSize === 'sm' ? 'blox-btn--sm' : '',
    variant === 'icon' ? 'blox-btn--icon' : '',
    solid ? 'blox-btn--solid' : '',
    loading ? 'is-loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="blox-btn__spinner" aria-hidden />
      ) : startIcon ? (
        <span className="blox-btn__icon">{startIcon}</span>
      ) : null}
      {children}
      {endIcon && !loading ? <span className="blox-btn__icon">{endIcon}</span> : null}
    </button>
  );
});
