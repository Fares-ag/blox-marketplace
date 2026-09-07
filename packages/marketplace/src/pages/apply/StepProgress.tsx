import { useTranslation } from 'react-i18next';
import { APPLY_STEPS, APPLY_STEP_COUNT, stepIndex, type ApplyStep } from './apply-model';

type Props = {
  current: ApplyStep;
  /** Highest step index the customer has reached; earlier steps are navigable. */
  maxReached: number;
  isComplete: (step: ApplyStep) => boolean;
  onSelect: (step: ApplyStep) => void;
};

/** "Step n of 7" header with labelled, keyboard-navigable step markers. */
export function StepProgress({ current, maxReached, isComplete, onSelect }: Props) {
  const { t } = useTranslation();
  const currentIndex = stepIndex(current);
  const pct = Math.round(((currentIndex + 1) / APPLY_STEP_COUNT) * 100);

  return (
    <nav className="dm-steps" aria-label={t('applyFlow.progressLabel')}>
      <div className="dm-steps__meta">
        <span className="dm-steps__count">{t('applyFlow.progress', { current: currentIndex + 1, total: APPLY_STEP_COUNT })}</span>
        <span className="dm-steps__current">{t(`applyFlow.steps.${current}`)}</span>
      </div>
      <div
        className="dm-steps__bar"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={APPLY_STEP_COUNT}
        aria-valuenow={currentIndex + 1}
        aria-valuetext={t('applyFlow.progress', { current: currentIndex + 1, total: APPLY_STEP_COUNT })}
      >
        <span className="dm-steps__bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <ol className="dm-steps__list">
        {APPLY_STEPS.map((step, index) => {
          const isCurrent = step === current;
          const done = !isCurrent && index < currentIndex && isComplete(step);
          const reachable = index <= maxReached && !isCurrent;
          const state = isCurrent ? 'current' : done ? 'done' : index <= maxReached ? 'reached' : 'todo';
          return (
            <li key={step} className={`dm-steps__item is-${state}`} aria-current={isCurrent ? 'step' : undefined}>
              <button type="button" className="dm-steps__btn" disabled={!reachable} onClick={() => onSelect(step)}>
                <span className="dm-steps__num" aria-hidden>
                  {done ? '✓' : index + 1}
                </span>
                <span className="dm-steps__label">{t(`applyFlow.steps.${step}`)}</span>
                <span className="dm-sr-only">
                  {isCurrent ? t('applyFlow.stepState.current') : done ? t('applyFlow.stepState.done') : t('applyFlow.stepState.todo')}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
