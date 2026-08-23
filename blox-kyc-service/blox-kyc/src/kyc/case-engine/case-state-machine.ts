import { KycCaseStatus } from '@prisma/client';

/**
 * KYC case state machine. Every transition is explicit and guarded; the engine
 * refuses any move not listed here. Mirrors the plan (§9):
 *   created -> capturing -> checks_running ->
 *     (needs_review | step_up_required | reviewing) -> (approved | rejected)
 *   any active state -> expired
 */
export type CaseTransition = {
  from: KycCaseStatus;
  to: KycCaseStatus;
};

const TRANSITIONS: ReadonlyArray<CaseTransition> = [
  { from: 'created', to: 'capturing' },
  { from: 'capturing', to: 'checks_running' },
  { from: 'checks_running', to: 'needs_review' },
  { from: 'checks_running', to: 'step_up_required' },
  { from: 'checks_running', to: 'reviewing' },
  { from: 'checks_running', to: 'approved' }, // auto-approve
  { from: 'step_up_required', to: 'capturing' },
  { from: 'step_up_required', to: 'checks_running' },
  { from: 'needs_review', to: 'reviewing' },
  { from: 'reviewing', to: 'approved' },
  { from: 'reviewing', to: 'rejected' },
  { from: 'reviewing', to: 'step_up_required' },
  { from: 'needs_review', to: 'step_up_required' },
  // Expiry is allowed from any non-terminal state.
  ...(['created', 'capturing', 'checks_running', 'needs_review', 'step_up_required', 'reviewing'] as KycCaseStatus[]).map(
    (from) => ({ from, to: 'expired' as KycCaseStatus }),
  ),
];

const TERMINAL: ReadonlySet<KycCaseStatus> = new Set<KycCaseStatus>(['approved', 'rejected', 'expired']);

export function isTerminal(status: KycCaseStatus): boolean {
  return TERMINAL.has(status);
}

export function canTransition(from: KycCaseStatus, to: KycCaseStatus): boolean {
  return TRANSITIONS.some((t) => t.from === from && t.to === to);
}

export function assertTransition(from: KycCaseStatus, to: KycCaseStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`illegal_transition:${from}->${to}`);
  }
}

export function nextStatesFrom(from: KycCaseStatus): KycCaseStatus[] {
  return TRANSITIONS.filter((t) => t.from === from).map((t) => t.to);
}
