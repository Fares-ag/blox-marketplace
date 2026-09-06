export function OpsSegmentedControl<T extends string>({
  value,
  options,
  onChange,
  size = 'sm',
  tone = 'dark',
  'aria-label': ariaLabel,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  /** `dark` for the sidebar chrome, `light` for toolbars and pagination on surfaces. */
  tone?: 'dark' | 'light';
  'aria-label'?: string;
}) {
  return (
    <div
      className={`blox-segmented blox-segmented--${size}${tone === 'light' ? ' blox-segmented--light' : ''}`}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={value === opt.value ? 'is-active' : undefined}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
