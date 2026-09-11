import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch, formatQar } from '@drivemarket/shared';

type UnitOffer = {
  id: string;
  period: number;
  units_offered: number;
  rent_amount: number;
  total_amount: number;
  status: string;
  expires_at: string | null;
};

type OffersPayload = {
  disclosure_required: boolean;
  disclosure_ack_at: string | null;
  items: UnitOffer[];
};

export function UnitOffersPanel({ applicationId }: { applicationId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['unit-offers', applicationId],
    queryFn: () => apiFetch<OffersPayload>(`/api/applications/${applicationId}/unit-offers`),
    retry: false,
  });
  const ack = useMutation({
    mutationFn: () => apiFetch(`/api/applications/${applicationId}/unit-offers/disclosure`, { method: 'POST', body: '{}' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['unit-offers', applicationId] }),
  });
  const accept = useMutation({
    mutationFn: (offerId: string) =>
      apiFetch(`/api/applications/${applicationId}/unit-offers/${offerId}/accept`, { method: 'POST', body: '{}' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['unit-offers', applicationId] }),
  });

  const open = (data?.items ?? []).filter((row) => row.status === 'offered');
  if (!data || open.length === 0) return null;

  return (
    <section className="dm-card" aria-label={t('ownershipHero.unitOffer', { defaultValue: 'Unit offer' })}>
      <h3>{t('ownershipHero.unitOffer', { defaultValue: 'This period’s unit offer' })}</h3>
      {data.disclosure_required && !data.disclosure_ack_at && (
        <p>
          {t('ownershipHero.unitOfferDisclosure', {
            defaultValue:
              'You are buying a further share of the vehicle and paying rent on Blox’s remaining share. There is no interest charge.',
          })}
          <button type="button" className="dm-btn-cta" onClick={() => ack.mutate()}>
            {t('ownershipHero.acknowledge', { defaultValue: 'I understand' })}
          </button>
        </p>
      )}
      <ul>
        {open.map((row) => (
          <li key={row.id}>
            {t('ownershipHero.period', { defaultValue: 'Period' })} {row.period} · {formatQar(row.total_amount)}
            <button
              type="button"
              className="dm-btn-cta"
              disabled={data.disclosure_required && !data.disclosure_ack_at}
              onClick={() => accept.mutate(row.id)}
            >
              {t('ownershipHero.acceptOffer', { defaultValue: 'Accept offer' })}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
