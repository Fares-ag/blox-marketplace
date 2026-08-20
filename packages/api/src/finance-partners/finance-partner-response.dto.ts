import type { FinancePartner } from '@prisma/client';

export function toFinancePartnerDto(partner: Pick<FinancePartner, 'id' | 'code' | 'name' | 'crmAdapter'>) {
  return {
    id: partner.id,
    code: partner.code,
    name: partner.name,
    crm_adapter: partner.crmAdapter,
  };
}
