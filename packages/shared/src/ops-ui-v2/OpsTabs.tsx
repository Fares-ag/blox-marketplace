import { Children, isValidElement, useRef, type KeyboardEvent, type ReactElement, type ReactNode, type SyntheticEvent } from 'react';

/**
 * Tabs — Phase 2. Native buttons with the WAI-ARIA tabs pattern (arrow keys move focus,
 * Home/End jump). Keeps the MUI-era API: `<OpsTabs value onChange={(e, v) => …}>` with
 * `<OpsTab value label />` children; a tab without `value` uses its index, as MUI did.
 */
export type OpsTabProps = {
  value?: string | number;
  label: ReactNode;
  count?: number;
  disabled?: boolean;
};

export function OpsTab(_props: OpsTabProps) {
  return null;
}

type OpsTabsProps = {
  value: string | number | false;
  onChange: (event: SyntheticEvent, value: any) => void;
  tabVariant?: 'status' | 'workspace';
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
  /** Accepted for MUI-era call sites; ignored. */
  sx?: unknown;
  variant?: unknown;
  scrollButtons?: unknown;
  allowScrollButtonsMobile?: unknown;
};

export function OpsTabs({ value, onChange, tabVariant = 'status', className, children, 'aria-label': ariaLabel }: OpsTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const tabs = Children.toArray(children).filter((child): child is ReactElement<OpsTabProps> => isValidElement(child));
  const wrapperClass = tabVariant === 'workspace' ? 'blox-workspace-tabs' : 'blox-status-tabs';

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') ?? []);
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    let next = current;
    if (e.key === 'ArrowRight') next = (current + 1) % buttons.length;
    else if (e.key === 'ArrowLeft') next = (current - 1 + buttons.length) % buttons.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = buttons.length - 1;
    else return;
    e.preventDefault();
    buttons[next]?.focus();
    buttons[next]?.click();
  }

  return (
    <div className={`${wrapperClass}${className ? ` ${className}` : ''}`}>
      <div ref={listRef} className="blox-tabs" role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown}>
        {tabs.map((tab, index) => {
          const tabValue = tab.props.value ?? index;
          const active = tabValue === value;
          return (
            <button
              key={String(tabValue)}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              disabled={tab.props.disabled}
              className={`blox-tabs__tab${active ? ' is-active' : ''}`}
              onClick={(e) => onChange(e, tabValue)}
            >
              {tab.props.label}
              {tab.props.count !== undefined && <span className="blox-tabs__count">{tab.props.count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
