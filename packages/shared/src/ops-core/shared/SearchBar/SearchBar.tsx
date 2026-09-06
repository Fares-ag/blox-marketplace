import React, { useEffect, useRef } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSearch?: (value: string) => void;
  className?: string;
  /** Focus the field when "/" is pressed outside another control. Defaults to on. */
  shortcut?: boolean;
}

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Search field — Phase 1 §08: leading icon, "/" shortcut, Esc clears, Enter runs onSearch. */
export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search…',
  onSearch,
  className = '',
  shortcut = true,
}) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key === '/' && !TYPING_TAGS.has(target?.tagName ?? '') && !target?.isContentEditable) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shortcut]);

  return (
    <div className={`blox-search ${className}`.trim()}>
      <svg className="blox-search__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5L14 14" />
      </svg>
      <input
        ref={ref}
        type="search"
        className="blox-search__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSearch?.(value);
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            onChange('');
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value ? (
        <button type="button" className="blox-search__clear" aria-label="Clear search" onClick={() => onChange('')}>
          ×
        </button>
      ) : shortcut ? (
        <kbd className="blox-search__kbd" aria-hidden>
          /
        </kbd>
      ) : null}
    </div>
  );
};
