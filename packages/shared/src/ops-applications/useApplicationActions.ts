import type { UserRole } from '../types/domain';
import type { ApplicationStatus } from '../types/domain';

export function isFullAdminRole(role?: UserRole | null) {
  return role === 'admin' || role === 'super_admin';
}

export function canCreditDecide(role?: UserRole | null) {
  return role === 'credit_officer' || isFullAdminRole(role);
}

export function canFinanceAct(role?: UserRole | null) {
  return role === 'finance_officer' || isFullAdminRole(role);
}

export function visibleWorkspaceActions(status: ApplicationStatus, role?: UserRole | null) {
  const dealer = role === 'dealer_agent';
  const credit = canCreditDecide(role);
  const finance = canFinanceAct(role);
  return {
    submitToCredit:
      (dealer || isFullAdminRole(role)) && (status === 'draft' || status === 'resubmission_required'),
    approveContract: credit && status === 'under_review',
    reject: credit && ['under_review', 'resubmission_required', 'contract_signing_required'].includes(status),
    requestResubmission: credit && ['under_review', 'resubmission_required', 'contract_signing_required'].includes(status),
    startContractReview: credit && status === 'contracts_submitted',
    approveSignedContract: credit && status === 'contract_under_review',
    requireDownPayment: credit && status === 'contract_under_review',
    activate: credit && status === 'pending_finance_activation',
    directActivate: credit && status === 'under_review',
    reopen: credit && status === 'rejected',
    recordDownPayment: finance && (status === 'down_payment_required' || status === 'down_payment_submitted'),
    markInstallmentPaid: finance && status === 'active',
    complianceCheck: credit,
    comment: credit || dealer || isFullAdminRole(role),
    edit: isFullAdminRole(role),
    uploadDocs:
      (dealer || credit || isFullAdminRole(role)) &&
      ['draft', 'under_review', 'resubmission_required', 'contract_signing_required'].includes(status),
    uploadSignedContract: credit && status === 'contract_signing_required',
    waiveSchedule: isFullAdminRole(role) && status === 'active',
    deleteApp: isFullAdminRole(role) && ['draft', 'rejected', 'submission_cancelled'].includes(status),
    assignCompany: isFullAdminRole(role),
    editInstallments: isFullAdminRole(role),
    convertDaily: isFullAdminRole(role) && status === 'active',
  };
}
