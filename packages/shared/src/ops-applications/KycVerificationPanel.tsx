import { applicationDocumentLabel, isPreviewableImageDocument } from '../application-document-label';

import type { KycVerificationSummary } from './types';



const STATUS_LABEL: Record<string, string> = {

  approved: 'Approved',

  declined: 'Declined',

  processing: 'In review',

  not_started: 'Not started',

};



const CHECK_LABEL: Record<string, string> = {

  id_document: 'ID verification',

  liveness: 'Liveness',

  face_match: 'Face match',

  authenticity: 'Document authenticity',

  ocr: 'OCR confidence',

};



const STEP_STATUS: Record<string, { label: string; color: string }> = {

  passed: { label: 'Passed', color: '#0d9488' },

  failed: { label: 'Failed', color: '#dc2626' },

  processing: { label: 'Processing', color: '#d97706' },

  not_submitted: { label: 'Not submitted', color: '#64748b' },

};



const IDENTITY_DOC_TYPES = new Set(['qid', 'passport', 'selfie', 'id']);



type DocRow = {

  id: string;

  category: string;

  mime_type?: string | null;

  original_name?: string | null;

  kyc_document_type?: string | null;

};



function formatScore(score: number | null, asPercent = true): string {

  if (score == null || Number.isNaN(score)) return '—';

  const pct = asPercent ? Math.round(score * 100) : Math.round(score);

  return asPercent ? `${pct}%` : `${pct}`;

}



function formatDate(value: string | null): string {

  if (!value) return '—';

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

}



function CheckRow({

  label,

  check,

}: {

  label: string;

  check: KycVerificationSummary['checks'][keyof KycVerificationSummary['checks']];

}) {

  const meta = STEP_STATUS[check.status] ?? STEP_STATUS.not_submitted;

  return (

    <div

      style={{

        display: 'grid',

        gridTemplateColumns: '1fr auto auto',

        gap: 12,

        alignItems: 'center',

        padding: '10px 0',

        borderBottom: '1px solid var(--border-subtle, #e2e8f0)',

      }}

    >

      <div>

        <div style={{ fontWeight: 600 }}>

          {label}

          {check.vendor_status && (

            <span style={{ marginLeft: 8, fontWeight: 500, color: 'var(--secondary-text, #64748b)', fontSize: '0.8125rem' }}>

              ({check.vendor_status})

            </span>

          )}

        </div>

        {check.reasons.length > 0 && (

          <div style={{ fontSize: '0.8125rem', color: 'var(--secondary-text, #64748b)', marginTop: 4 }}>

            {check.reasons.join(' · ')}

          </div>

        )}

      </div>

      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{formatScore(check.score)}</span>

      <span

        style={{

          fontSize: '0.75rem',

          fontWeight: 700,

          textTransform: 'uppercase',

          letterSpacing: '0.04em',

          color: meta.color,

        }}

      >

        {meta.label}

      </span>

    </div>

  );

}



function MetaGrid({ verification }: { verification: KycVerificationSummary }) {

  const items = [

    verification.document_type ? { label: 'Document type', value: verification.document_type } : null,

    verification.image_quality_score != null

      ? { label: 'Image quality', value: `${Math.round(verification.image_quality_score)}%` }

      : null,

    verification.liveness_method ? { label: 'Liveness method', value: verification.liveness_method } : null,

    verification.didit_session_id ? { label: 'Session ID', value: verification.didit_session_id } : null,

    verification.didit_verified_at ? { label: 'Verified at', value: formatDate(verification.didit_verified_at) } : null,

  ].filter(Boolean) as Array<{ label: string; value: string }>;



  if (items.length === 0) return null;



  return (

    <div

      style={{

        display: 'grid',

        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',

        gap: 10,

        marginBottom: 16,

        padding: 12,

        borderRadius: 8,

        background: '#fff',

        border: '1px solid var(--border-subtle, #e2e8f0)',

      }}

    >

      {items.map((item) => (

        <div key={item.label}>

          <div style={{ fontSize: '0.75rem', color: 'var(--secondary-text, #64748b)', marginBottom: 2 }}>{item.label}</div>

          <div style={{ fontSize: '0.875rem', fontWeight: 600, wordBreak: 'break-all' }}>{item.value}</div>

        </div>

      ))}

    </div>

  );

}



function ExtractedIdentityGrid({ verification }: { verification: KycVerificationSummary }) {

  if (verification.extracted_identity.length === 0) return null;



  return (

    <div style={{ marginBottom: 16 }}>

      <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 8 }}>Extracted from ID</div>

      <div

        style={{

          display: 'grid',

          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',

          gap: 10,

          padding: 12,

          borderRadius: 8,

          background: '#fff',

          border: '1px solid var(--border-subtle, #e2e8f0)',

        }}

      >

        {verification.extracted_identity.map((field) => (

          <div key={field.name}>

            <div style={{ fontSize: '0.75rem', color: 'var(--secondary-text, #64748b)', marginBottom: 2 }}>{field.label}</div>

            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{field.value}</div>

            <div style={{ fontSize: '0.6875rem', color: 'var(--secondary-text, #64748b)', marginTop: 2 }}>

              {Math.round(field.confidence * 100)}% confidence · {field.source}

            </div>

          </div>

        ))}

      </div>

    </div>

  );

}



export function KycVerificationPanel({

  verification,

  documents = [],

  applicationId,

  fileUrl,

}: {

  verification: KycVerificationSummary;

  documents?: DocRow[];

  applicationId?: string;

  fileUrl?: (docId: string) => string;

}) {

  const overall = STATUS_LABEL[verification.overall_status] ?? verification.overall_status;

  const overallColor =

    verification.overall_status === 'approved'

      ? '#0d9488'

      : verification.overall_status === 'declined'

        ? '#dc2626'

        : '#d97706';



  const identityDocs = documents.filter(

    (d) => IDENTITY_DOC_TYPES.has(d.category) || Boolean(d.kyc_document_type),

  );

  const previewDocs = identityDocs.filter(isPreviewableImageDocument);



  return (

    <div

      className="blox-kyc-verification"

      style={{

        marginBottom: 20,

        padding: 16,

        borderRadius: 12,

        border: '1px solid var(--border-subtle, #e2e8f0)',

        background: 'var(--surface-raised, #f8fafc)',

      }}

    >

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>

        <div>

          <h3 style={{ margin: 0, fontSize: '1rem' }}>Identity verification</h3>

          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--secondary-text, #64748b)' }}>

            {verification.provider === 'didit' ? 'Didit' : verification.provider === 'native' ? 'Blox KYC' : 'KYC'}

            {verification.didit_session_status ? ` · ${verification.didit_session_status}` : ''}

          </p>

        </div>

        <span

          style={{

            padding: '4px 10px',

            borderRadius: 999,

            background: `${overallColor}18`,

            color: overallColor,

            fontWeight: 700,

            fontSize: '0.75rem',

            textTransform: 'uppercase',

            letterSpacing: '0.05em',

          }}

        >

          {overall}

        </span>

      </div>



      <MetaGrid verification={verification} />

      <ExtractedIdentityGrid verification={verification} />



      {previewDocs.length > 0 && fileUrl && applicationId && (

        <div

          style={{

            display: 'grid',

            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',

            gap: 12,

            marginBottom: 16,

          }}

        >

          {previewDocs.map((doc) => (

            <a

              key={doc.id}

              href={fileUrl(doc.id)}

              target="_blank"

              rel="noreferrer"

              style={{ textDecoration: 'none', color: 'inherit' }}

            >

              <div

                style={{

                  borderRadius: 8,

                  overflow: 'hidden',

                  border: '1px solid var(--border-subtle, #e2e8f0)',

                  background: '#fff',

                }}

              >

                <img

                  src={fileUrl(doc.id)}

                  alt={applicationDocumentLabel(doc)}

                  style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }}

                />

                <div style={{ padding: '6px 8px', fontSize: '0.75rem', fontWeight: 600 }}>

                  {applicationDocumentLabel(doc)}

                </div>

              </div>

            </a>

          ))}

        </div>

      )}



      <CheckRow label={CHECK_LABEL.id_document} check={verification.checks.id_document} />

      <CheckRow label={CHECK_LABEL.liveness} check={verification.checks.liveness} />

      <CheckRow label={CHECK_LABEL.face_match} check={verification.checks.face_match} />

      <CheckRow label={CHECK_LABEL.authenticity} check={verification.checks.authenticity} />

      <CheckRow label={CHECK_LABEL.ocr} check={verification.checks.ocr} />



      {verification.didit_steps?.poa.submitted && (

        <div style={{ padding: '10px 0', fontSize: '0.875rem', borderBottom: '1px solid var(--border-subtle, #e2e8f0)' }}>

          <strong>Proof of address</strong>

          {verification.didit_steps.poa.status && (

            <span style={{ marginLeft: 8, color: 'var(--secondary-text, #64748b)' }}>

              ({verification.didit_steps.poa.status})

            </span>

          )}

        </div>

      )}



      {verification.warnings.length > 0 && (

        <div style={{ marginTop: 12 }}>

          <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 6 }}>Warnings</div>

          <ul style={{ margin: 0, paddingLeft: 18, color: '#b45309', fontSize: '0.8125rem' }}>

            {verification.warnings.map((w) => (

              <li key={w}>{w}</li>

            ))}

          </ul>

        </div>

      )}



      <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--secondary-text, #64748b)' }}>

        Case {verification.case_status.replace(/_/g, ' ').toLowerCase()}

        {verification.kyc_status ? ` · Application KYC ${verification.kyc_status}` : ''}

      </div>

    </div>

  );

}


