import type { OpsWorkspace } from '../types';
import type { visibleWorkspaceActions } from '../useApplicationActions';
import type { WorkspaceMutations } from './useWorkspaceMutations';

export type WorkspaceActions = ReturnType<typeof visibleWorkspaceActions>;

export type ConfirmRequest = { title: string; message: string; onConfirm: () => void; danger?: boolean };

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
