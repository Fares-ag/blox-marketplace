import type { ReactNode } from 'react';

export function OpsToolbar({
  search,
  tabs,
  filters,
  actions,
}: {
  search?: ReactNode;
  tabs?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="blox-toolbar">
      <div className="blox-toolbar__row">
        {search && <div className="blox-toolbar__search">{search}</div>}
        {actions && <div className="blox-toolbar__actions">{actions}</div>}
      </div>
      {tabs}
      {filters && <div className="blox-toolbar__filters">{filters}</div>}
    </section>
  );
}
