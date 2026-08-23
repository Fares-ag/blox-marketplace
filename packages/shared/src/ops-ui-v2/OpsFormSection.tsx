import type { ReactNode } from 'react';
import { OpsFormGrid } from './OpsField';

export function OpsFormSection({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="blox-form-section blox-detail-section">
      <div className="blox-form-section__head">
        <div>
          <h2 className="blox-form-section__title">{title}</h2>
          {description && <p className="blox-form-section__desc">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="blox-form-section__body">
        <OpsFormGrid>{children}</OpsFormGrid>
      </div>
    </section>
  );
}
