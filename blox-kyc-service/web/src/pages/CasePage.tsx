import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type KycCase } from '../api/client';
import { loadSession } from '../store/session';
import { Layout, statusBadge } from './Layout';

export function CasePage() {
  const { id = '' } = useParams();
  const session = loadSession()!;
  const [kase, setKase] = useState<KycCase | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [decisionReason, setDecisionReason] = useState('Manual review completed');
  const [bindingNote, setBindingNote] = useState('Agent verified identity via video call');

  const reload = useCallback(async () => {
    const row = await api.getCase(session, id);
    setKase(row);
  }, [id, session]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load case');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function runAction(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError('');
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label} failed`);
    } finally {
      setBusy('');
    }
  }

  async function seedFlow() {
    await runAction('seed', async () => {
      await api.submitConsent(session, id, {
        purpose: 'identity',
        granted: true,
        textVersion: 'v1',
        textShown: 'I consent to identity verification.',
      });
      await api.registerDocument(session, id, {
        docType: 'qid',
        storageRef: `local://demo/qid-${id}.jpg`,
      });
    });
  }

  async function onApprove(e: FormEvent) {
    e.preventDefault();
    await runAction('approve', async () => {
      await api.decide(session, id, { decision: 'approved', reason: decisionReason });
    });
  }

  async function onReject(e: FormEvent) {
    e.preventDefault();
    await runAction('reject', async () => {
      await api.decide(session, id, { decision: 'rejected', reason: decisionReason });
    });
  }

  if (!kase && !error) {
    return (
      <Layout title="Case">
        <p className="empty">Loading…</p>
      </Layout>
    );
  }

  return (
    <Layout title={`Case ${kase?.applicationId ?? id}`}>
      {error && <p className="error">{error}</p>}
      {kase && (
        <div className="stack">
          <div className="card">
            <div className="row" style={{ alignItems: 'center' }}>
              <strong>Status</strong> {statusBadge(kase.status)}
              {kase.decision && <span className="meta">Decision: {kase.decision}</span>}
            </div>
            <p className="meta">
              Customer {kase.customerUserId} · Company {kase.companyId}
            </p>
            {kase.decisionReason && <p className="meta">Reason: {kase.decisionReason}</p>}
          </div>

          <div className="card">
            <h2 className="section-title">Workflow</h2>
            <div className="actions">
              <button type="button" disabled={!!busy} onClick={() => seedFlow()}>
                {busy === 'seed' ? 'Seeding…' : 'Seed consent + document'}
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() =>
                  runAction('run', async () => {
                    await api.runChecks(session, id);
                  })
                }
              >
                {busy === 'run' ? 'Running…' : 'Run checks'}
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() =>
                  runAction('binding', async () => {
                    await api.recordBinding(session, id, {
                      method: 'agent_attestation',
                      attesterUserId: session.userId,
                      note: bindingNote,
                    });
                  })
                }
              >
                {busy === 'binding' ? 'Saving…' : 'Record identity binding'}
              </button>
            </div>
            <label htmlFor="bindingNote">Binding note</label>
            <input id="bindingNote" value={bindingNote} onChange={(e) => setBindingNote(e.target.value)} />
          </div>

          <div className="card">
            <h2 className="section-title">Checks</h2>
            {(kase.checks?.length ?? 0) === 0 && <p className="empty">No checks yet.</p>}
            {(kase.checks?.length ?? 0) > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Provider</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {kase.checks!.map((c) => (
                    <tr key={c.id}>
                      <td>{c.type}</td>
                      <td>{c.status}</td>
                      <td>{c.provider}</td>
                      <td>{c.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h2 className="section-title">Documents & bindings</h2>
            <p className="meta">Documents: {kase.documents?.length ?? 0} · Bindings: {kase.bindings?.length ?? 0}</p>
            <ul>
              {kase.documents?.map((d) => (
                <li key={d.id}>
                  {d.docType}: {d.storageRef}
                </li>
              ))}
              {kase.bindings?.map((b) => (
                <li key={b.id}>
                  {b.method} by {b.attesterUserId}
                  {b.note ? ` — ${b.note}` : ''}
                </li>
              ))}
            </ul>
          </div>

          {['needs_review', 'reviewing', 'step_up_required'].includes(kase.status) && (
            <div className="card">
              <h2 className="section-title">Decision</h2>
              <label htmlFor="decisionReason">Reason</label>
              <textarea
                id="decisionReason"
                rows={3}
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
              />
              <div className="actions">
                <button type="button" disabled={!!busy} onClick={onApprove}>
                  {busy === 'approve' ? 'Approving…' : 'Approve'}
                </button>
                <button type="button" className="danger" disabled={!!busy} onClick={onReject}>
                  {busy === 'reject' ? 'Rejecting…' : 'Reject'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
