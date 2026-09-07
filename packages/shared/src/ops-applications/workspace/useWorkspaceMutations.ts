import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { apiFetch } from '../../lib/api';
import type { OpsUnmaskField, OpsUnmaskResponse } from '../types';

/**
 * Every server action the application workspace can take, in one place (Phase 1 §11).
 * Tab panels receive this object instead of owning their own mutations.
 */
export type WorkspaceMutationOptions = {
  backHref: string;
  /** Read lazily so the latest textarea value is sent, not a stale closure. */
  getReason: () => string;
  getComment: () => string;
  downPaymentAmount: () => number;
  loadCompanies: boolean;
  /** The raw error is passed too so callers can map machine codes (submit gates) to guidance. */
  onError: (message: string, error?: Error) => void;
  onCommentPosted?: () => void;
  onEditSaved?: () => void;
  onPaid?: () => void;
  onSignedContractUploaded?: () => void;
};

export function useWorkspaceMutations(id: string, opts: WorkspaceMutationOptions) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['ops-app', id] });
    void qc.invalidateQueries({ queryKey: ['ops-apps'] });
    void qc.invalidateQueries({ queryKey: ['credit-queue'] });
  };
  const fail = (e: Error) => opts.onError(e.message, e);

  const transition = useMutation({
    mutationFn: (toStatus: string) =>
      apiFetch(`/api/ops/applications/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ toStatus, reason: opts.getReason().trim() || undefined }),
      }),
    onSuccess: invalidate,
    onError: fail,
  });
  const approve = useMutation({
    mutationFn: () => apiFetch(`/api/ops/applications/${id}/approve-contract`, { method: 'POST' }),
    onSuccess: invalidate,
    onError: fail,
  });
  const activate = useMutation({
    mutationFn: (direct?: boolean) =>
      apiFetch(`/api/ops/applications/${id}/activate`, {
        method: 'POST',
        body: JSON.stringify({ direct: !!direct }),
      }),
    onSuccess: invalidate,
    onError: fail,
  });
  const submit = useMutation({
    mutationFn: () => apiFetch(`/api/ops/applications/${id}/submit`, { method: 'POST' }),
    onSuccess: invalidate,
    onError: (e: Error) => {
      fail(e);
      toast.error(e.message);
    },
  });
  const compliance = useMutation({
    mutationFn: () => apiFetch(`/api/ops/applications/${id}/compliance-check`, { method: 'POST' }),
    onSuccess: invalidate,
    onError: fail,
  });
  const postComment = useMutation({
    mutationFn: () =>
      apiFetch(`/api/ops/applications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ comment: opts.getComment() }),
      }),
    onSuccess: () => {
      opts.onCommentPosted?.();
      invalidate();
    },
    onError: fail,
  });
  const patchEdit = useMutation({
    mutationFn: (body: { hideInterest?: boolean; agentUserId?: string | null; companyId?: string }) =>
      apiFetch(`/api/ops/applications/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      opts.onEditSaved?.();
      invalidate();
    },
    onError: fail,
  });
  const pay = useMutation({
    mutationFn: (payload: { id: string; method: string; reference: string; amount: number }) =>
      apiFetch(`/api/ops/payment-schedules/${payload.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          method: payload.method,
          reference: payload.reference || undefined,
          amount: payload.amount,
        }),
      }),
    onSuccess: () => {
      opts.onPaid?.();
      invalidate();
    },
    onError: fail,
  });
  const uploadSignedContract = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return apiFetch(`/api/ops/applications/${id}/contract/signed`, { method: 'POST', body: fd });
    },
    onSuccess: () => {
      opts.onSignedContractUploaded?.();
      invalidate();
    },
    onError: fail,
  });
  const uploadDoc = useMutation({
    mutationFn: (payload: { category: string; file: File }) => {
      const fd = new FormData();
      fd.append('category', payload.category);
      fd.append('file', payload.file);
      return apiFetch(`/api/ops/applications/${id}/documents`, { method: 'POST', body: fd });
    },
    onSuccess: invalidate,
    onError: fail,
  });
  const deleteApp = useMutation({
    mutationFn: () => apiFetch(`/api/ops/applications/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Application deleted');
      window.location.href = opts.backHref;
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const convertDaily = useMutation({
    mutationFn: () =>
      apiFetch(`/api/ops/applications/${id}/convert-daily-to-monthly`, { method: 'POST', body: '{}' }),
    onSuccess: () => {
      toast.success('Schedule converted');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rebuild = useMutation({
    mutationFn: (body: { tenureMonths?: number; downPaymentPct?: number }) =>
      apiFetch(`/api/ops/applications/${id}/rebuild-schedule`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Installments updated');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const downPay = useMutation({
    mutationFn: () =>
      apiFetch(`/api/ops/applications/${id}/down-payment`, {
        method: 'POST',
        body: JSON.stringify({ amount: opts.downPaymentAmount() || 1 }),
      }),
    onSuccess: invalidate,
    onError: fail,
  });
  const companies = useQuery({
    queryKey: ['ws-companies'],
    queryFn: () =>
      apiFetch<{ items: Array<{ id: string; name: string }> }>('/api/companies/all?limit=100&offset=0'),
    enabled: opts.loadCompanies,
  });

  // Customer-platform actions: every one of them is audited server-side.
  const clearIdentityHold = useMutation({
    mutationFn: (note: string) =>
      apiFetch(`/api/ops/applications/${id}/identity-hold/clear`, { method: 'POST', body: JSON.stringify({ note }) }),
    onSuccess: invalidate,
    onError: fail,
  });
  const unmask = useMutation({
    mutationFn: (payload: { field: OpsUnmaskField; reason: string }) =>
      apiFetch<OpsUnmaskResponse>(`/api/ops/applications/${id}/unmask`, {
        method: 'POST',
        body: JSON.stringify({ field: payload.field, reason: payload.reason }),
      }),
    onError: fail,
  });
  const tagLender = useMutation({
    mutationFn: (payload: { finance_partner_id: string; finance_partner_branch_id?: string }) =>
      apiFetch(`/api/ops/applications/${id}/lender`, {
        method: 'POST',
        body: JSON.stringify({
          finance_partner_id: payload.finance_partner_id,
          ...(payload.finance_partner_branch_id ? { finance_partner_branch_id: payload.finance_partner_branch_id } : {}),
        }),
      }),
    onSuccess: invalidate,
    onError: fail,
  });
  const verifyTakaful = useMutation({
    mutationFn: (policyId: string) =>
      apiFetch(`/api/ops/applications/${id}/takaful/${policyId}/verify`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ops-app-takaful', id] });
      invalidate();
    },
    onError: fail,
  });

  const busy =
    transition.isPending ||
    approve.isPending ||
    activate.isPending ||
    submit.isPending ||
    patchEdit.isPending ||
    uploadSignedContract.isPending;

  return {
    invalidate,
    transition,
    approve,
    activate,
    submit,
    compliance,
    postComment,
    patchEdit,
    pay,
    uploadSignedContract,
    uploadDoc,
    deleteApp,
    convertDaily,
    rebuild,
    downPay,
    companies,
    clearIdentityHold,
    unmask,
    tagLender,
    verifyTakaful,
    busy,
  };
}

export type WorkspaceMutations = ReturnType<typeof useWorkspaceMutations>;
