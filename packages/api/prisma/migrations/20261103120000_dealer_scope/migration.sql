-- Sales managers (`all`) see every application at the dealership.
-- Existing dealer agents stay `assigned` and only see applications they created.
ALTER TABLE "users" ADD COLUMN "dealerScope" "OfficerScope" NOT NULL DEFAULT 'assigned';
