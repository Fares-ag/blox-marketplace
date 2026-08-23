import { bloxTokens } from '../config/blox-tokens';

export function OpsSegmentedControl<T extends string>({
  value,
  options,
  onChange,
  size = 'sm',
  'aria-label': ariaLabel,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  'aria-label'?: string;
}) {
  return (
    <div
      className={`blox-segmented blox-segmented--${size}`}
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
          style={
            value === opt.value
              ? { background: bloxTokens.emerald, color: bloxTokens.deepGreen }
              : undefined
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
