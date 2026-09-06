import { createContext, useContext, type ReactNode } from 'react';
import type { CompanyBrandingDto } from '@drivemarket/shared';

/**
 * White-label context for dealer-branded customer entry (`/dealers/:code/apply`).
 * Placeholder wiring: the branded entry page replaces this with a provider that
 * loads `Company.branding` and applies logo, colours and display name.
 */
export type BrandContextValue = {
  branding: CompanyBrandingDto | null;
  companyCode: string | null;
  companyName: string | null;
};

const BrandContext = createContext<BrandContextValue>({ branding: null, companyCode: null, companyName: null });

export function BrandProvider({ children, value }: { children: ReactNode; value?: BrandContextValue }) {
  return (
    <BrandContext.Provider value={value ?? { branding: null, companyCode: null, companyName: null }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand(): BrandContextValue {
  return useContext(BrandContext);
}
