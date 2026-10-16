import { Navigate, useParams } from 'react-router-dom';

/** Ancienne route pleine page : redirige vers la carte avec la fiche en query. */
export function OfferDetailPage() {
  const { id } = useParams();
  return <Navigate to={id ? `/carte?offre=${id}` : '/carte'} replace />;
}
