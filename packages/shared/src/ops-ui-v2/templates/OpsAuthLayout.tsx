import type { ReactNode } from 'react';
import { bloxMeta } from '../../config/blox-tokens';
import { BloxLogo } from '../../components/BloxLogo';

export function OpsAuthLayout({
  portalLabel,
  tagline = bloxMeta.tagline,
  children,
  brandPanel,
  brandPoints,
}: {
  portalLabel: string;
  tagline?: string;
  children: ReactNode;
  brandPanel?: ReactNode;
  brandPoints?: string[];
}) {
  return (
    <div className="blox-ops-auth dm-auth-layout blox-auth-layout">
      {brandPanel ?? (
        <OpsAuthBrandPanel portalLabel={portalLabel} tagline={tagline} brandPoints={brandPoints} />
      )}
      <div className="dm-auth-card blox-auth-card">{children}</div>
    </div>
  );
}

const DEFAULT_OPS_BRAND_POINTS = [
  'End-to-end application pipeline',
  'Full audit trail on every action',
  'Role-based access with MFA',
];

export function OpsAuthBrandPanel({
  portalLabel,
  tagline,
  brandPoints = DEFAULT_OPS_BRAND_POINTS,
}: {
  portalLabel: string;
  tagline: string;
  brandPoints?: string[];
}) {
  return (
    <aside className="dm-auth-brand blox-auth-brand" aria-label="Blox brand">
      <div
        className="dm-auth-brand__media blox-auth-brand__media"
        role="img"
        aria-label="Vehicle on a coastal road at dusk"
      />
      <div className="dm-auth-brand__scrim blox-auth-brand__scrim" />
      <div className="dm-auth-brand__glow blox-auth-brand__glow" aria-hidden />
      <div className="dm-auth-brand__content blox-auth-brand__content">
        <p className="dm-auth-brand__portal blox-auth-brand__portal">{portalLabel}</p>
        <BloxLogo height={44} tone="onDark" className="dm-auth-brand__logo blox-auth-brand__logo" />
        <p className="dm-auth-brand__tag blox-auth-brand__tag">{tagline}</p>
        <ul className="dm-auth-brand__points blox-auth-brand__points">
          {brandPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

export function OpsAuthCardInner({ children }: { children: ReactNode }) {
  return <div className="dm-auth-card__inner blox-auth-card__inner">{children}</div>;
}
