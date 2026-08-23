import { createContext, useContext, type ReactNode } from 'react';

const PortalBasePathContext = createContext('');

export function PortalBasePathProvider({
  basePath,
  children,
}: {
  basePath: string;
  children: ReactNode;
}) {
  return <PortalBasePathContext.Provider value={basePath}>{children}</PortalBasePathContext.Provider>;
}

export function usePortalBasePath() {
  return useContext(PortalBasePathContext);
}

export function withPortalBase(path: string, basePath?: string) {
  const base = basePath ?? '';
  if (!base) return path;
  if (path.startsWith(base)) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
