import type { ReactNode } from 'react';
import { OpsPageHeader } from '../../components/ops-ui';
import { Alert } from '../../ops-core';
import { PageSkeleton } from '../PageSkeleton';

/**
 * Form page template — Phase 2. Header → (error) → sections → sticky footer actions.
 * Put the primary Save and a ghost Cancel in `footer`; it stays visible on long forms.
 */
export function OpsFormPage({
  title,
  subtitle,
  headerActions,
  wide,
  children,
  error,
  loading,
  footer,
}: {
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  wide?: boolean;
  children: ReactNode;
  error?: ReactNode;
  loading?: boolean;
  footer?: ReactNode;
}) {
  return (
    <div className="blox-page">
      <OpsPageHeader title={title} subtitle={subtitle} actions={headerActions} />
      {typeof error === 'string' ? <Alert variant="error">{error}</Alert> : error}
      <div className={wide ? 'blox-form-page blox-form-page--wide' : 'blox-form-page'}>
        {loading ? <PageSkeleton variant="form" /> : children}
        {footer && !loading && <div className="blox-form-page__footer">{footer}</div>}
      </div>
    </div>
  );
}
