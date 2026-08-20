import { QueryClient, type QueryClientConfig } from '@tanstack/react-query';
import { ApiError } from './api';

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return false;
    if (error.status < 500) return false;
  }
  return failureCount < 3;
}

export function createQueryClient(config?: QueryClientConfig): QueryClient {
  return new QueryClient({
    ...config,
    defaultOptions: {
      ...config?.defaultOptions,
      queries: {
        ...config?.defaultOptions?.queries,
        retry: shouldRetryQuery,
      },
    },
  });
}
