import { Navigate, useParams } from 'react-router-dom';
import { PartnerApplicationDetail, PartnerApplicationsList } from '@drivemarket/shared';

/** `/partner` — the finance-partner (`partner_viewer`) read-only list. */
export function PartnerListPage() {
  return <PartnerApplicationsList basePath="/partner" />;
}

/** `/partner/:id` — read-only detail with the masked snapshot, credit assessment and documents. */
export function PartnerDetailPage() {
  const { id } = useParams();
  if (!id) return <Navigate to="/partner" replace />;
  return <PartnerApplicationDetail id={id} backTo="/partner" />;
}
