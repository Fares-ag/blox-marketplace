type PortalErrorFallbackProps = {
  error: unknown;
  onReset: () => void;
};

export function PortalErrorFallback({ error, onReset }: PortalErrorFallbackProps) {
  const message = error instanceof Error ? error.message : 'Unexpected error';

  return (
    <div
      role="alert"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: 'var(--dm-canvas, #eef2f4)',
        fontFamily: 'var(--dm-font-ui, Manrope, sans-serif)',
        color: 'var(--dm-ink, #142027)',
      }}
    >
      <div
        style={{
          maxWidth: '28rem',
          width: '100%',
          padding: '2rem',
          borderRadius: 'var(--dm-radius-lg, 16px)',
          background: 'var(--dm-surface, #ffffff)',
          boxShadow: 'var(--dm-shadow-2, 0 8px 24px rgba(11, 18, 21, 0.12))',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            margin: '0 0 0.75rem',
            fontFamily: 'var(--dm-font-display, Fraunces, serif)',
            fontSize: '1.5rem',
            fontWeight: 600,
          }}
        >
          Something went wrong
        </h1>
        <p style={{ margin: '0 0 1.5rem', color: 'var(--dm-slate-600, #5a6b73)', lineHeight: 1.5 }}>
          We hit an unexpected problem. You can try again or reload the page to continue.
        </p>
        <p
          style={{
            margin: '0 0 1.5rem',
            fontSize: '0.875rem',
            color: 'var(--dm-slate-500, #6b7c85)',
            wordBreak: 'break-word',
          }}
        >
          {message}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onReset}
            style={{
              padding: '0.625rem 1.25rem',
              border: 'none',
              borderRadius: 'var(--dm-radius-sm, 8px)',
              background: 'var(--dm-steel, #2f6f8f)',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '0.625rem 1.25rem',
              border: '1px solid var(--dm-slate-200, #d5dee3)',
              borderRadius: 'var(--dm-radius-sm, 8px)',
              background: 'var(--dm-surface, #ffffff)',
              color: 'var(--dm-ink, #142027)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}
