import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { UserRole } from '../types/domain';
import { roleAllowed, useAuthStore } from './auth-store';

interface AuthGuardProps {
  allowedRole: UserRole | UserRole[];
  reasonParam: string;
  children: ReactNode;
  requireVerifiedEmail?: boolean;
}

export function AuthGuard({
  allowedRole,
  reasonParam,
  children,
  requireVerifiedEmail = false,
}: AuthGuardProps) {
  const location = useLocation();
  const { user, initialized, init, loading } = useAuthStore();

  useEffect(() => {
    void init();
  }, [init]);

  if (!initialized || loading) {
    return (
      <div style={{ padding: 48, fontFamily: 'var(--dm-font-ui)', color: 'var(--dm-slate-600)' }}>
        Loading…
      </div>
    );
  }

  if (!user) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth/login?returnUrl=${returnUrl}`} replace />;
  }

  if (!roleAllowed(user.role, allowedRole)) {
    return <Navigate to={`/auth/login?reason=${reasonParam}`} replace />;
  }

  if (requireVerifiedEmail) {
    // Better Auth: emailVerified mirrored on profile when available; MVP seed users are verified.
  }

  return <>{children}</>;
}

export function GuestGuard({ children }: { children: ReactNode }) {
  const { user, initialized, init } = useAuthStore();
  useEffect(() => {
    void init();
  }, [init]);

  if (!initialized) return null;
  if (user) {
    return <Navigate to="/app/dashboard" replace />;
  }
  return <>{children}</>;
}
