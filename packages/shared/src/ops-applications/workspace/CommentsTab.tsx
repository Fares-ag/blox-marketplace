import { useOpsLabels } from '../../i18n/use-ops-labels';
import { OpsTextarea } from '../../ops-ui-v2';
import { OpsSecondaryButton } from '../../components/ops-ui';
import type { WorkspacePanelProps } from './types';

type Props = Pick<WorkspacePanelProps, 'data' | 'actions' | 'mutations'> & {
  comment: string;
  onCommentChange: (value: string) => void;
};

export function CommentsTab({ data, actions, mutations, comment, onCommentChange }: Props) {
  const { t } = useOpsLabels();
  const comments = data.comments ?? [];
  return (
    <section className="blox-detail-section">
      <h2 className="blox-panel__title">{t('ops.workspace.tab.comments')}</h2>
      {comments.length === 0 ? (
        <p className="blox-decision__none">{t('ops.common.noResults')}</p>
      ) : (
        <ol className="blox-tl">
          {comments.map((c) => (
            <li key={c.id}>
              <span className="blox-tl__what">{c.body}</span>
              <span className="blox-tl__when">
                {new Date(c.created_at).toLocaleString()} · {c.actor_email ?? 'system'}
              </span>
            </li>
          ))}
        </ol>
      )}
      {actions.comment && (
        <div className="blox-comment-form">
          <OpsTextarea
            label={t('ops.workspace.addComment')}
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            rows={3}
            fullWidth
          />
          <OpsSecondaryButton
            type="button"
            disabled={!comment.trim() || mutations.postComment.isPending}
            loading={mutations.postComment.isPending}
            onClick={() => mutations.postComment.mutate()}
          >
            {t('ops.common.save')}
          </OpsSecondaryButton>
        </div>
      )}
    </section>
  );
}
