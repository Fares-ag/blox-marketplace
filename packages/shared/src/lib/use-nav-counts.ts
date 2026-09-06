import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';
import { useAuthStore } from '../auth/auth-store';

/**
 * Polls a metrics endpoint for the sidebar count capsules. Only runs once a user is
 * signed in, refreshes every minute, and never throws into the shell — a failed poll
 * simply leaves the counts off.
 */
export function useNavCounts<T extends Record<string, unknown>>(path: string): T | undefined {
  const user = useAuthStore((s) => s.user);
  const { data } = useQuery({
    queryKey: ['nav-counts', path],
    queryFn: () => apiFetch<T>(path),
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });
  return data;
}
