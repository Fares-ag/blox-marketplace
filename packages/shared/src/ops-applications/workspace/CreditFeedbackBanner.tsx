import { useOpsLabels } from '../../i18n/use-ops-labels';
import { Alert } from '../../ops-ui-v2';
import type { OpsWorkspace } from '../types';

const DECLINED_STATUSES = new Set(['rejected', 'submission_cancelled', 'partner_declined']);

type Props = {
  data: Pick<OpsWorkspace, 'status' | 'resubmission_comment' | 'rejection_reason'>;
};

/** Credit transition reasons (resubmission / reject) — shown to dealers and ops; customers see the same text in the portal. */
export function CreditFeedbackBanner({ data }: Props) {
  const { t } = useOpsLabels();
  const declined = DECLINED_STATUSES.has(data.status);
  const resubmission = data.resubmission_comment?.trim();
  const rejection = data.rejection_reason?.trim();

  if (declined && rejection) {
    return (
      <Alert variant="warning" title={t('ops.workspace.creditMessageRejected')}>
        <p className="blox-m-0">{rejection}</p>
      </Alert>
    );
  }

  if (resubmission && !declined) {
    return (
      <Alert variant="warning" title={t('ops.workspace.creditMessageAction')}>
        <p className="blox-m-0">{resubmission}</p>
      </Alert>
    );
  }

  return null;
}
