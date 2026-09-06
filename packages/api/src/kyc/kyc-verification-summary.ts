import type {
  DiditCaseSummary,
  ExtractedIdentityField,
  KycCaseDetail,
  KycVerificationResult,
} from './kyc-platform.client';

export type VerificationCheckDto = {
  score: number | null;
  passed: boolean | null;
  status: 'passed' | 'failed' | 'processing' | 'not_submitted';
  reasons: string[];
  vendor_status?: string | null;
};

export type KycVerificationSummaryDto = {
  case_id: string;
  case_status: string;
  kyc_status: string | null;
  provider: 'didit' | 'native' | null;
  didit_session_id: string | null;
  didit_session_status: string | null;
  didit_verified_at: string | null;
  document_type: string | null;
  image_quality_score: number | null;
  liveness_method: string | null;
  extracted_identity: ExtractedIdentityField[];
  didit_steps: DiditCaseSummary | null;
  overall_status: 'approved' | 'declined' | 'processing' | 'not_started';
  checks: {
    id_document: VerificationCheckDto;
    liveness: VerificationCheckDto;
    face_match: VerificationCheckDto;
    authenticity: VerificationCheckDto;
    ocr: VerificationCheckDto;
  };
  warnings: string[];
};

function latestResult(
  results: KycVerificationResult[],
  kind: KycVerificationResult['kind'],
): KycVerificationResult | undefined {
  let found: KycVerificationResult | undefined;
  for (const row of results) {
    if (row.kind !== kind) continue;
    if (!found || new Date(row.created_at) > new Date(found.created_at)) found = row;
  }
  return found;
}

function parseReasons(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is string => typeof r === 'string');
}

function humanizeReason(code: string): string {
  if (code.startsWith('DIDIT_SESSION:')) return `Session ${code.slice('DIDIT_SESSION:'.length)}`;
  if (code.startsWith('DIDIT_')) return code.slice('DIDIT_'.length).replace(/_/g, ' ').toLowerCase();
  return code.replace(/_/g, ' ').toLowerCase();
}

function isDiditProvider(results: KycVerificationResult[]): boolean {
  return results.some((r) => r.model_version?.startsWith('didit/'));
}

const ID_DOC_TYPES = ['qid_front', 'qid_back', 'passport'] as const;

function idDocumentCheck(kase: KycCaseDetail): VerificationCheckDto {
  const docs = kase.documents.filter((d) => ID_DOC_TYPES.includes(d.type as (typeof ID_DOC_TYPES)[number]));
  if (docs.length === 0) {
    return { score: null, passed: null, status: 'not_submitted', reasons: [] };
  }
  if (docs.some((d) => d.status === 'FAILED' || d.status === 'REJECTED')) {
    return { score: null, passed: false, status: 'failed', reasons: [] };
  }
  if (docs.some((d) => d.status === 'UPLOADED' || d.status === 'PROCESSING')) {
    return { score: null, passed: null, status: 'processing', reasons: [] };
  }
  const auth = latestResult(kase.verification_results ?? [], 'authenticity');
  const score = auth?.score != null ? Number(auth.score) : null;
  const reasons = parseReasons(auth?.reasons).map(humanizeReason);
  const declined = reasons.some((r) => r.includes('declined'));
  return {
    score,
    passed: declined ? false : true,
    status: declined ? 'failed' : 'passed',
    reasons,
  };
}

function livenessCheck(kase: KycCaseDetail): VerificationCheckDto {
  const live = latestResult(kase.verification_results ?? [], 'liveness');
  const selfie = kase.documents.find((d) => d.type === 'selfie');
  if (!live && !selfie) {
    return { score: null, passed: null, status: 'not_submitted', reasons: [] };
  }
  if (selfie && (selfie.status === 'FAILED' || selfie.status === 'REJECTED')) {
    return { score: null, passed: false, status: 'failed', reasons: [] };
  }
  const score = live?.score != null ? Number(live.score) : null;
  const reasons = parseReasons(live?.reasons).map(humanizeReason);
  if (live && score != null && score < 0.8) {
    return { score, passed: false, status: 'failed', reasons };
  }
  if (selfie?.status === 'UPLOADED' || selfie?.status === 'PROCESSING') {
    return { score, passed: null, status: 'processing', reasons };
  }
  return { score, passed: true, status: 'passed', reasons };
}

function faceMatchCheck(kase: KycCaseDetail): VerificationCheckDto {
  const match = latestResult(kase.verification_results ?? [], 'face_match');
  if (!match) {
    return { score: null, passed: null, status: 'not_submitted', reasons: [] };
  }
  const score = match.score != null ? Number(match.score) : null;
  const reasons = parseReasons(match.reasons).map(humanizeReason);
  const passed = score != null ? score >= 0.75 : null;
  return {
    score,
    passed,
    status: passed === false ? 'failed' : passed ? 'passed' : 'processing',
    reasons,
  };
}

function authenticityCheck(kase: KycCaseDetail): VerificationCheckDto {
  const auth = latestResult(kase.verification_results ?? [], 'authenticity');
  if (!auth) {
    return { score: null, passed: null, status: 'not_submitted', reasons: [] };
  }
  const score = auth.score != null ? Number(auth.score) : null;
  const reasons = parseReasons(auth.reasons).map(humanizeReason);
  const declined = reasons.some((r) => r.includes('declined'));
  const approved = reasons.some((r) => r.includes('approved'));
  const passed = declined ? false : approved || (score != null && score >= 0.6);
  return {
    score,
    passed: declined ? false : passed ? true : null,
    status: declined ? 'failed' : passed ? 'passed' : 'processing',
    reasons,
  };
}

function collectWarnings(results: KycVerificationResult[], didit: DiditCaseSummary | null | undefined): string[] {
  const warnings = new Set<string>();
  for (const row of results) {
    for (const reason of parseReasons(row.reasons)) {
      if (reason.startsWith('DIDIT_SESSION:') || reason.startsWith('DIDIT_')) continue;
      warnings.add(humanizeReason(reason));
    }
  }
  if (didit) {
    for (const step of [didit.id_verification, didit.liveness, didit.face_match, didit.poa]) {
      for (const w of step.warnings) warnings.add(w);
    }
  }
  return [...warnings];
}

function parseDiditSession(results: KycVerificationResult[]): {
  sessionId: string | null;
  sessionStatus: string | null;
} {
  for (const row of results) {
    for (const reason of parseReasons(row.reasons)) {
      if (reason.startsWith('DIDIT_SESSION:')) {
        return { sessionId: null, sessionStatus: reason.slice('DIDIT_SESSION:'.length) };
      }
    }
  }
  return { sessionId: null, sessionStatus: null };
}

function overallStatus(
  kase: KycCaseDetail,
  checks: KycVerificationSummaryDto['checks'],
): KycVerificationSummaryDto['overall_status'] {
  const caseStatus = kase.status.toUpperCase();
  if (caseStatus === 'APPROVED') return 'approved';
  if (caseStatus === 'REJECTED') return 'declined';
  const allChecks = [checks.id_document, checks.liveness, checks.face_match];
  if (allChecks.every((c) => c.status === 'not_submitted')) return 'not_started';
  if (allChecks.some((c) => c.status === 'failed')) return 'declined';
  if (allChecks.some((c) => c.status === 'processing' || c.status === 'not_submitted')) {
    return 'processing';
  }
  if (checks.id_document.status === 'passed' && checks.liveness.status === 'passed') {
    return 'approved';
  }
  return 'processing';
}

function ocrCheck(kase: KycCaseDetail): VerificationCheckDto {
  const ocr = latestResult(kase.verification_results ?? [], 'ocr');
  if (!ocr) {
    return { score: null, passed: null, status: 'not_submitted', reasons: [] };
  }
  const score = ocr.score != null ? Number(ocr.score) : null;
  const reasons = parseReasons(ocr.reasons).map(humanizeReason);
  const passed = score != null ? score >= 0.7 : null;
  return {
    score,
    passed,
    status: passed === false ? 'failed' : passed ? 'passed' : 'processing',
    reasons,
  };
}

function mergeDiditVendorStatus(
  check: VerificationCheckDto,
  step: { status: string | null; warnings: string[] } | undefined,
): VerificationCheckDto {
  if (!step?.status) return check;
  const approved = step.status.toLowerCase() === 'approved';
  const declined = step.status.toLowerCase() === 'declined';
  const warnings = [...new Set([...check.reasons, ...step.warnings])];
  return {
    ...check,
    vendor_status: step.status,
    reasons: warnings,
    passed: declined ? false : approved ? true : check.passed,
    status: declined ? 'failed' : approved ? 'passed' : check.status,
  };
}

export function buildKycVerificationSummary(
  kase: KycCaseDetail,
  kycStatus: string | null,
): KycVerificationSummaryDto {
  const results = kase.verification_results ?? [];
  const didit = kase.didit ?? null;
  let checks = {
    id_document: idDocumentCheck(kase),
    liveness: livenessCheck(kase),
    face_match: faceMatchCheck(kase),
    authenticity: authenticityCheck(kase),
    ocr: ocrCheck(kase),
  };

  if (didit) {
    checks = {
      id_document: mergeDiditVendorStatus(checks.id_document, didit.id_verification),
      liveness: mergeDiditVendorStatus(checks.liveness, didit.liveness),
      face_match: mergeDiditVendorStatus(checks.face_match, didit.face_match),
      authenticity: checks.authenticity,
      ocr: checks.ocr,
    };
    if (didit.image_quality_score != null && checks.id_document.score == null) {
      checks.id_document.score = didit.image_quality_score / 100;
    }
    if (didit.liveness.score != null && checks.liveness.score == null) {
      checks.liveness.score = didit.liveness.score / 100;
    }
    if (didit.face_match.score != null && checks.face_match.score == null) {
      checks.face_match.score = didit.face_match.score / 100;
    }
  }

  const { sessionStatus } = parseDiditSession(results);
  const diditProvider = isDiditProvider(results) || Boolean(didit);

  return {
    case_id: kase.id,
    case_status: kase.status,
    kyc_status: kycStatus,
    provider: diditProvider ? 'didit' : results.length > 0 || kase.documents.length > 0 ? 'native' : null,
    didit_session_id: didit?.session_id ?? null,
    didit_session_status: didit?.session_status ?? sessionStatus,
    didit_verified_at: didit?.updated_at ?? null,
    document_type: didit?.document_type ?? null,
    image_quality_score: didit?.image_quality_score ?? null,
    liveness_method: didit?.liveness_method ?? null,
    extracted_identity: kase.extracted_identity ?? [],
    didit_steps: didit,
    overall_status: overallStatus(kase, checks),
    checks,
    warnings: collectWarnings(results, didit),
  };
}
