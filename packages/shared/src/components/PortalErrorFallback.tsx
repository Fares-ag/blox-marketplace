import { OpsPrimaryButton, OpsGhostButton } from './ops-ui';

type PortalErrorFallbackProps = {
  error: unknown;
  onReset: () => void;
};

export function PortalErrorFallback({ error, onReset }: PortalErrorFallbackProps) {
  const message = error instanceof Error ? error.message : 'Unexpected error';

  return (
    <div className="blox-ops blox-ops-app-wrapper blox-portal-error" role="alert">
      <div className="blox-portal-error__card blox-auth-centered__card">
        <h2>Something went wrong</h2>
        <p className="blox-portal-error__lead">
          We hit an unexpected problem. You can try again or reload the page to continue.
        </p>
        <p className="blox-portal-error__detail">{message}</p>
        <div className="blox-portal-error__actions">
          <OpsPrimaryButton onClick={onReset}>Try again</OpsPrimaryButton>
          <OpsGhostButton onClick={() => window.location.reload()}>Reload page</OpsGhostButton>
        </div>
      </div>
    </div>
  );
}
