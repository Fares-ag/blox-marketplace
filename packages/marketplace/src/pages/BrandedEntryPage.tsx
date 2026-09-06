import { Navigate, useParams } from 'react-router-dom';

/**
 * Placeholder for the dealer-branded customer entry (`/dealers/:code/apply`).
 * Until the white-label entry is built it forwards to the dealer showroom.
 */
export function BrandedEntryPage() {
  const { code } = useParams();
  return <Navigate to={code ? `/dealers/${code}` : '/dealers'} replace />;
}
