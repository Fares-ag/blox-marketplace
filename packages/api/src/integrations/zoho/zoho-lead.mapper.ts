import type { Application, Company, Offer, Product } from '@prisma/client';

export type ApplicationForZoho = Application & {
  product: Product;
  company: Pick<Company, 'id' | 'name'>;
  offer: Offer;
  financePartner?: { code: string; crmAdapter: string } | null;
};

function str(value: unknown): string {
  return value == null ? '' : String(value);
}

function pricingField(pricing: Record<string, unknown>, key: string): string {
  const v = pricing[key];
  if (v == null) return '';
  return String(v);
}

/**
 * Maps a DriveMarket application to a Zoho CRM Lead payload.
 * Field API names follow the Al Jazeera Finance sandbox layout; adjust via env
 * if the partner renames custom fields.
 */
export function mapApplicationToZohoLead(
  app: ApplicationForZoho,
  requestSubmittedTo: string,
): Record<string, unknown> {
  const customer = app.customerSnapshot as Record<string, unknown>;
  const pricing = app.pricingSnapshot as Record<string, unknown>;

  const vehicleLabel = `${app.product.make} ${app.product.model} ${app.product.modelYear ?? ''}`.trim();

  return {
    Last_Name: str(customer.full_name) || app.customerEmail.split('@')[0],
    Email: app.customerEmail,
    Phone: str(customer.phone),
    Company: app.company.name,
    Lead_Source: app.leadSource ?? 'Blox Marketplace',
    Description: [
      `Application ${app.id}`,
      `Vehicle: ${vehicleLabel}`,
      `List price: ${pricingField(pricing, 'list_price')} QAR`,
      `Monthly: ${pricingField(pricing, 'monthly')} QAR`,
      `Tenor: ${pricingField(pricing, 'tenor')} months`,
      `Status: ${app.status}`,
    ].join('\n'),
    Request_Submitted_To: requestSubmittedTo,
    QID: str(customer.qid),
    Vehicle_Make: app.product.make,
    Vehicle_Model: app.product.model,
    Vehicle_Year: app.product.modelYear,
    Finance_Amount: pricingField(pricing, 'list_price'),
    Down_Payment: pricingField(pricing, 'down_payment'),
    Monthly_Installment: pricingField(pricing, 'monthly'),
    Application_Status: app.status,
  };
}
