import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  ConfirmDialog,
  OpsDataTable,
  OpsEmptyState,
  OpsField,
  OpsFormSection,
  OpsGhostButton,
  OpsPrimaryButton,
  OpsStatusPill,
  PageSkeleton,
  apiFetch,
} from '@drivemarket/shared';
import type { BranchDto, BranchFormValues } from '../types';
import { apiErrorCode, companyBranchesKey, useCompanyBranches } from '../lib/customer-platform';

const EMPTY_FORM: BranchFormValues = { code: '', name: '', city: '', address: '', phone: '' };

type Mode = { kind: 'create' } | { kind: 'edit'; branch: BranchDto };

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Branches of one company: list, add, edit, deactivate/reactivate.
 * `GET/POST /api/companies/:id/branches`, `PATCH /api/companies/:id/branches/:branchId`.
 */
export function CompanyBranchesSection({ companyId, readOnly }: { companyId: string; readOnly?: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const branches = useCompanyBranches(companyId);
  const [mode, setMode] = useState<Mode>({ kind: 'create' });
  const [form, setForm] = useState<BranchFormValues>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const invalidate = () => void qc.invalidateQueries({ queryKey: companyBranchesKey(companyId) });
  const describeError = (error: unknown) => {
    const code = apiErrorCode(error);
    return code === 'branch_code_exists' ? t('adminOps.companies.branchCodeExists') : code;
  };
  const patch = (next: Partial<BranchFormValues>) => setForm((prev) => ({ ...prev, ...next }));
  const resetForm = () => {
    setMode({ kind: 'create' });
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const save = useMutation({
    mutationFn: () => {
      if (mode.kind === 'edit') {
        return apiFetch<BranchDto>(`/api/companies/${companyId}/branches/${mode.branch.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: form.name.trim(),
            city: nullable(form.city),
            address: nullable(form.address),
            phone: nullable(form.phone),
          }),
        });
      }
      return apiFetch<BranchDto>(`/api/companies/${companyId}/branches`, {
        method: 'POST',
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          city: optional(form.city),
          address: optional(form.address),
          phone: optional(form.phone),
        }),
      });
    },
    onSuccess: () => {
      toast.success(t('branchOps.saved'));
      resetForm();
      invalidate();
    },
    onError: (error) => setFormError(describeError(error)),
  });

  const toggleActive = useMutation({
    mutationFn: (branch: BranchDto) =>
      apiFetch<BranchDto>(`/api/companies/${companyId}/branches/${branch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !branch.active }),
      }),
    onSuccess: () => {
      toast.success(t('branchOps.saved'));
      invalidate();
    },
    onError: (error) => toast.error(describeError(error)),
  });

  const startEdit = (branch: BranchDto) => {
    setMode({ kind: 'edit', branch });
    setForm({
      code: branch.code,
      name: branch.name,
      city: branch.city ?? '',
      address: branch.address ?? '',
      phone: branch.phone ?? '',
    });
    setFormError(null);
  };

  const askToggle = (branch: BranchDto) =>
    setConfirm({
      title: t(branch.active ? 'adminOps.companies.deactivateBranchTitle' : 'adminOps.companies.activateBranchTitle', {
        name: branch.name,
      }),
      message: t(branch.active ? 'adminOps.companies.deactivateBranchBody' : 'adminOps.companies.activateBranchBody'),
      onConfirm: () => toggleActive.mutate(branch),
    });

  const items = branches.data ?? [];
  const canSubmit =
    form.name.trim().length > 0 && (mode.kind === 'edit' || form.code.trim().length > 0) && !save.isPending;

  return (
    <>
      {!readOnly && (
        <OpsFormSection
          title={mode.kind === 'edit' ? t('branchOps.edit') : t('branchOps.add')}
          description={t('adminOps.companies.branchesSubtitle')}
          actions={
            mode.kind === 'edit' ? (
              <OpsGhostButton type="button" onClick={resetForm}>
                {t('adminOps.common.cancel')}
              </OpsGhostButton>
            ) : undefined
          }
        >
          <OpsField
            label={t('branchOps.code')}
            value={form.code}
            onChange={(e) => patch({ code: e.target.value.toUpperCase() })}
            required
            disabled={mode.kind === 'edit'}
            hint={t('adminOps.companies.branchCodeHint')}
            mono
          />
          <OpsField label={t('branchOps.name')} value={form.name} onChange={(e) => patch({ name: e.target.value })} required />
          <OpsField
            label={t('branchOps.city')}
            value={form.city}
            onChange={(e) => patch({ city: e.target.value })}
            optionalLabel={t('adminOps.common.optional')}
          />
          <OpsField
            label={t('branchOps.phone')}
            value={form.phone}
            onChange={(e) => patch({ phone: e.target.value })}
            optionalLabel={t('adminOps.common.optional')}
            inputMode="tel"
            mono
          />
          <OpsField
            label={t('branchOps.address')}
            value={form.address}
            onChange={(e) => patch({ address: e.target.value })}
            optionalLabel={t('adminOps.common.optional')}
            fullWidth
          />
          {formError && (
            <p className="blox-form-error blox-form-grid__full" role="alert">
              {formError}
            </p>
          )}
          <div className="blox-form-grid__full blox-inline-actions">
            <OpsPrimaryButton type="button" disabled={!canSubmit} loading={save.isPending} onClick={() => save.mutate()}>
              {mode.kind === 'edit' ? t('adminOps.common.save') : t('branchOps.add')}
            </OpsPrimaryButton>
          </div>
        </OpsFormSection>
      )}

      {branches.isLoading ? (
        <PageSkeleton variant="list" />
      ) : branches.isError ? (
        <p className="blox-form-error" role="alert">
          {apiErrorCode(branches.error)}
        </p>
      ) : (
        <OpsDataTable
          columns={[
            t('branchOps.code'),
            t('branchOps.name'),
            t('branchOps.city'),
            t('branchOps.phone'),
            t('adminOps.companies.staffColumn'),
            t('adminOps.common.status'),
            '',
          ]}
          numericColumns={[4]}
          empty={<OpsEmptyState title={t('branchOps.empty')} />}
          rows={items.map((b) => [
            <span key="c" className="blox-table__mono">
              {b.code}
            </span>,
            b.name,
            b.city ?? '—',
            b.phone ?? '—',
            t('branchOps.staff', { count: b.staff_count ?? 0 }),
            <OpsStatusPill
              key="s"
              label={b.active ? t('branchOps.active') : t('branchOps.inactive')}
              variant={b.active ? 'success' : 'neutral'}
            />,
            readOnly ? (
              '—'
            ) : (
              <span key="a" className="blox-cell-row blox-cell-row--wrap">
                <OpsGhostButton type="button" size="sm" onClick={() => startEdit(b)}>
                  {t('adminOps.common.edit')}
                </OpsGhostButton>
                <OpsGhostButton type="button" size="sm" disabled={toggleActive.isPending} onClick={() => askToggle(b)}>
                  {b.active ? t('adminOps.common.deactivate') : t('adminOps.common.activate')}
                </OpsGhostButton>
              </span>
            ),
          ])}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmText={t('adminOps.common.confirm')}
        cancelText={t('adminOps.common.cancel')}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          confirm?.onConfirm();
          setConfirm(null);
        }}
      />
    </>
  );
}
