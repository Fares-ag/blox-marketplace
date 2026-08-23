import type { ReactNode } from 'react';
import { OpsPageHeader } from '../../components/ops-ui';

export function OpsFormPage({
  title,
  subtitle,
  headerActions,
  wide,
  children,
}: {
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="blox-page">
      <OpsPageHeader title={title} subtitle={subtitle} actions={headerActions} />
      <div className={wide ? 'blox-form-page blox-form-page--wide' : 'blox-form-page'}>{children}</div>
    </div>
  );
}
