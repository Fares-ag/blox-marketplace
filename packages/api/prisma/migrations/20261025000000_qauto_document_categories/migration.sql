-- QAuto dealer pack: National Address Certificate and Bank Liability Letter.
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'national_address';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'bank_liability';
