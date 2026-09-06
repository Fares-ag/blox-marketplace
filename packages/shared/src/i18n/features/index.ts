/**
 * Feature-scoped translation blocks, merged on top of the legacy `locales.ts`
 * dictionaries at i18n init. One file per feature keeps EN/AR side by side and
 * the `ar: typeof en` typing guarantees parity per feature.
 *
 * Namespaces are deliberately distinct from the legacy top-level keys so the
 * two dictionaries never shadow each other.
 */
import * as applyFlow from './apply-flow';
import * as consentCentre from './consent-centre';
import * as eligibilityCheck from './eligibility';
import * as customerProfile from './customer-profile';
import * as ownershipHero from './ownership-hero';
import * as takaful from './takaful';
import * as assistMode from './assist-mode';
import * as sessionPolicy from './session-policy';
import * as ops from './ops-features';
import * as dealerOps from './dealer-ops';
import * as adminOps from './admin-ops';

export const featureEn = {
  dealerOps: dealerOps.en,
  adminOps: adminOps.en,
  applyFlow: applyFlow.en,
  consentCentre: consentCentre.en,
  eligibilityCheck: eligibilityCheck.en,
  customerProfile: customerProfile.en,
  ownershipHero: ownershipHero.en,
  takaful: takaful.en,
  assistMode: assistMode.en,
  sessionPolicy: sessionPolicy.en,
  identityHold: ops.en.identityHold,
  inventoryRules: ops.en.inventoryRules,
  branchOps: ops.en.branches,
  financeProviders: ops.en.financeProviders,
  originationAnalytics: ops.en.analytics,
  whiteLabel: ops.en.whiteLabel,
  privacy: ops.en.privacy,
};

export const featureAr: typeof featureEn = {
  dealerOps: dealerOps.ar,
  adminOps: adminOps.ar,
  applyFlow: applyFlow.ar,
  consentCentre: consentCentre.ar,
  eligibilityCheck: eligibilityCheck.ar,
  customerProfile: customerProfile.ar,
  ownershipHero: ownershipHero.ar,
  takaful: takaful.ar,
  assistMode: assistMode.ar,
  sessionPolicy: sessionPolicy.ar,
  identityHold: ops.ar.identityHold,
  inventoryRules: ops.ar.inventoryRules,
  branchOps: ops.ar.branches,
  financeProviders: ops.ar.financeProviders,
  originationAnalytics: ops.ar.analytics,
  whiteLabel: ops.ar.whiteLabel,
  privacy: ops.ar.privacy,
};
