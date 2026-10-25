import { useState } from 'react';
import { toast } from 'react-toastify';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { downloadApiFile, openApiFileInNewTab } from '../lib/api';

type Props = {
  /** Path passed to `apiFileUrl` (e.g. `/applications/:id/documents/:docId/file`). */
  filePath: string;
  downloadLabel: string;
  viewLabel?: string;
  fallbackFilename?: string;
  className?: string;
};

export function ApplicationDocumentActions({
  filePath,
  downloadLabel,
  viewLabel,
  fallbackFilename,
  className = 'blox-inline-actions blox-inline-actions--wrap',
}: Props) {
  const { t } = useOpsLabels();
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await task();
    } catch {
      toast.error(t('ops.common.downloadFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={className}>
      {viewLabel ? (
        <button
          type="button"
          className="blox-btn blox-btn--ghost blox-btn--sm"
          disabled={busy}
          onClick={() => void run(() => openApiFileInNewTab(filePath))}
        >
          {viewLabel}
        </button>
      ) : null}
      <button
        type="button"
        className="blox-btn blox-btn--secondary blox-btn--sm"
        disabled={busy}
        onClick={() => void run(() => downloadApiFile(filePath, fallbackFilename))}
      >
        {downloadLabel}
      </button>
    </span>
  );
}
