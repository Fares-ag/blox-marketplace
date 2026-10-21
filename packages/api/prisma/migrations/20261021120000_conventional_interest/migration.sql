-- In-house conventional finance: a different product from diminishing Musharakah.
ALTER TYPE "FinancingType" ADD VALUE IF NOT EXISTS 'conventional_interest';
ALTER TYPE "ContractDocumentType" ADD VALUE IF NOT EXISTS 'conventional_loan_agreement';
ALTER TYPE "ContractDocumentType" ADD VALUE IF NOT EXISTS 'amortization_schedule';
