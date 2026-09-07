import type { IdentityRevealProps, OpsAudience, OpsWorkspace } from '../types';
import type { ConsentStatusDto, CreditAssessmentDto, GuarantorSessionDto } from '../../types/customer-platform';
import type { visibleWorkspaceActions } from '../useApplicationActions';
import type { WorkspaceMutations } from './useWorkspaceMutations';

export type WorkspaceActions = ReturnType<typeof visibleWorkspaceActions>;

export type ConfirmRequest = { title: string; message: string; onConfirm: () => void; danger?: boolean };

/** Guarantor consent state the workspace shares with the facts strip and the guarantor card. */
export type WorkspaceGuarantorProps = {
  hasGuarantor: boolean;
  session?: GuarantorSessionDto | null;
  /** Dealer (own company), credit, admin and super-admin may send / resend / cancel the request. */
  canSend: boolean;
};

/**
 * Customer-platform extras the workspace hands to its panels: masked-identity
 * reveal, consents status, takaful verification, lender tagging, the live
 * credit assessment and the guarantor consent session. Optional so portals
 * rendering the panels on their own keep working.
 */
export type WorkspacePlatformProps = {
  audience?: OpsAudience;
  reveal?: IdentityRevealProps;
  consents?: ConsentStatusDto | null;
  consentsPending?: boolean;
  consentsError?: string | null;
  canVerifyTakaful?: boolean;
  onVerifyTakaful?: (policyId: string) => void;
  verifyingTakaful?: boolean;
  onTagLender?: () => void;
  /** `GET /api/ops/applications/:id/credit-assessment`, recomputed live for the signed-in officer. */
  creditAssessment?: CreditAssessmentDto | null;
  creditAssessmentPending?: boolean;
  creditAssessmentError?: string | null;
  guarantor?: WorkspaceGuarantorProps;
};

/** Shared props every tab panel and the decision panel receive. */
export type WorkspacePanelProps = {
  id: string;
  data: OpsWorkspace;
  actions: WorkspaceActions;
  mutations: WorkspaceMutations;
  /** Short "Make Model · Customer" label used in confirmation copy. */
  label: string;
  setConfirm: (req: ConfirmRequest | null) => void;
  setError: (message: string | null) => void;
  platform?: WorkspacePlatformProps;
};

export type PayTarget = {
  id: string;
  sequence: number;
  amount: number | null;
  remaining_amount: number;
  status: string;
  pending_waive_reason?: string | null;
  pending_waive_requested_by_id?: string | null;
};
