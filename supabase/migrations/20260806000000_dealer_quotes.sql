-- Dealer private finance quote links (email-bound, one-time, expiry-controlled)

CREATE TABLE dealer_quotes (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  product_id TEXT NOT NULL REFERENCES products(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  customer_email TEXT NOT NULL,
  list_price_snapshot NUMERIC(12, 2) NOT NULL,
  negotiated_price NUMERIC(12, 2) NOT NULL,
  offer_id TEXT NOT NULL REFERENCES offers(id),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by_application_id TEXT UNIQUE REFERENCES applications(id),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX dealer_quotes_company_created_idx ON dealer_quotes (company_id, created_at DESC);
CREATE INDEX dealer_quotes_product_idx ON dealer_quotes (product_id);
