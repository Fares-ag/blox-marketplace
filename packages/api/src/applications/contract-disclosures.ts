/**
 * Qatar financing disclosure copy for the Diminishing Musharakah contract PDF
 * (section 4). Shariah terminology applies throughout: the customer pays
 * *rent* on the lender's share and buys that share down; there is no
 * interest-style vocabulary, no APR, no late-payment charge (see the shared
 * `terminology` guard — `contract-terminology.spec.ts` keeps this file clean).
 *
 * Replace the paragraphs below with counsel-certified text before production
 * use. Keep each entry as one printable line; contract-pdf.ts renders them in
 * order.
 */

/** The single late-payment statement every contract carries (Shariah policy: Blox never earns from delay). */
export const NO_LATE_CHARGES_LINE =
  'No charges are levied for late payment. Blox does not earn from delay; amounts received late are handled under the Shariah policy.';

export const QATAR_FINANCING_DISCLOSURES: readonly string[] = [
  'DRAFT — PENDING COUNSEL CERTIFICATION. Do not use in production until Blox legal counsel approves this wording for Qatar financing regulations and the Shariah supervisory board has reviewed it.',
  'This agreement is a Diminishing Musharakah (declining co-ownership) arrangement governed by its terms and applicable Qatar law. The summary above states the cash price, the down payment, the amount financed (the co-owner share you buy over the term), the annual profit rate, the tenure, the monthly installment, the total installments payable, the total amount payable and the total rent payable.',
  'Each installment combines principal (the share of the vehicle transferred to you) and rent (profit on the share still held by the lender of record). As your share grows the rent falls; nothing compounds.',
  NO_LATE_CHARGES_LINE,
  'You may request a full payment schedule and account statement at any time. Early settlement is available: you pay the principal outstanding plus the rent accrued to the settlement date, and rent for periods that have not elapsed is forgiven. The quote is shown to you before you confirm.',
  'If you believe an error exists in these terms, contact the lender of record before signing. The payment schedule on the following page(s) is binding once signed — do not alter amounts or dates; add your signature only.',
];

/** @deprecated Kept for older imports; the disclosures are financing disclosures, not consumer-credit ones. */
export const QATAR_CONSUMER_CREDIT_DISCLOSURES = QATAR_FINANCING_DISCLOSURES;
