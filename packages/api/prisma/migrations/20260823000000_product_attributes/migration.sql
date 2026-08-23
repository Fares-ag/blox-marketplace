-- Supabase parity: product.attributes JSON (body_style, model_family_key, etc.)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "attributes" JSONB;
