import { KycCheckStatus, KycCheckType } from '@prisma/client';

/** Context passed to every check adapter when it runs against a case. */
export interface CheckContext {
  caseId: string;
  applicationId: string;
  customerUserId: string;
  companyId: string;
}

/** Normalized result every adapter returns. Stored as one KycCheck row. */
export interface CheckResult {
  status: KycCheckStatus;
  score?: number;
  provider: string;
  providerVersion: string;
  reason?: string;
  evidence?: Record<string, unknown>;
}

/**
 * The port every check implements. Real OCR/MRZ, document-authenticity, bank
 * parsing, and AML screening plug in here without touching the case engine.
 */
export interface KycCheckPort {
  readonly type: KycCheckType;
  run(ctx: CheckContext): Promise<CheckResult>;
}

/** DI token used to collect all registered check adapters. */
export const KYC_CHECK = Symbol('KYC_CHECK');

/** Which checks must be present/passed for v1 (bureau is Phase 3, excluded). */
export const V1_REQUIRED_CHECKS: readonly KycCheckType[] = [
  'qid',
  'passport',
  'doc_authenticity',
  'identity_binding',
  'aml_screen',
  'bank_statement',
];
