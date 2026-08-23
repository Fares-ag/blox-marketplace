import type { OpsPortalKey } from './ops-portal-keys';

/** Resolve portal auth copy from i18n `ops.auth.portals.*` keys. */
export function opsPortalAuthKeys(portal: OpsPortalKey) {
  return {
    portalLabelKey: `ops.auth.portals.${portal}.label` as const,
    taglineKey: `ops.auth.portals.${portal}.tagline` as const,
    brandPointKeys: [
      'ops.auth.brandPoints.pipeline',
      'ops.auth.brandPoints.audit',
      'ops.auth.brandPoints.secure',
    ] as const,
  };
}

export type { OpsPortalKey } from './ops-portal-keys';
