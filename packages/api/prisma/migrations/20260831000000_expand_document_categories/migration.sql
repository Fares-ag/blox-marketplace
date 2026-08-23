-- Corporate + individual document categories (blox-vercel parity)
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'id';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'cr';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'computer_card';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'rental_agreement';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'signatory_id';
