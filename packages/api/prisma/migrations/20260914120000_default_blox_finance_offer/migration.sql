-- Marketplace default: Blox Finance offer on all listings and draft applications
-- that still inherit the legacy Al Jazeera default.

UPDATE "offers"
SET "isDefault" = false
WHERE "id" = 'seed-al-jazeera-offer';

UPDATE "offers"
SET "isDefault" = true
WHERE "id" = 'seed-blox-finance-offer';

UPDATE "products"
SET "defaultOfferId" = 'seed-blox-finance-offer'
WHERE "defaultOfferId" IN ('seed-al-jazeera-offer', 'seed-default-offer');

-- In-flight draft applications that inherited the old listing default.
UPDATE "applications" AS a
SET
  "offerId" = 'seed-blox-finance-offer',
  "financePartnerId" = fp.id
FROM "finance_partners" AS fp
WHERE a."status" = 'draft'
  AND a."offerId" = 'seed-al-jazeera-offer'
  AND fp.code = 'blox-finance';
