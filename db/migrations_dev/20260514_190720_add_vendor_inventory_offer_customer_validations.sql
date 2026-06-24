-- migrate:up

-- ============================================================
-- VENDORS
-- ============================================================

-- Normalise existing codes to uppercase.
UPDATE vendors
SET vendor_code = upper(vendor_code)
WHERE vendor_code IS NOT NULL
  AND vendor_code <> upper(vendor_code);

-- Case-insensitive unique index on vendor_code (NULL values excluded —
-- multiple vendors may have no code).
CREATE UNIQUE INDEX uq_vendors_code_lower ON vendors (lower(vendor_code))
WHERE vendor_code IS NOT NULL;

-- Code format: 4–25 characters, uppercase letters / digits / hyphens only.
ALTER TABLE vendors
  ADD CONSTRAINT vendors_code_format
    CHECK (vendor_code IS NULL OR vendor_code ~ '^[A-Z0-9-]{4,25}$') NOT VALID;

-- Name length: 2–120 characters.
ALTER TABLE vendors
  ADD CONSTRAINT vendors_name_length
    CHECK (char_length(btrim(name)) >= 2 AND char_length(name) <= 120) NOT VALID;

-- Phone: 10-digit Indian mobile number starting with 6–9.
ALTER TABLE vendors
  ADD CONSTRAINT vendors_phone_format
    CHECK (phone ~ '^[6-9][0-9]{9}$') NOT VALID;

-- Alternate phone: optional, same format as primary phone.
ALTER TABLE vendors
  ADD CONSTRAINT vendors_alternate_phone_format
    CHECK (alternate_phone IS NULL OR alternate_phone ~ '^[6-9][0-9]{9}$') NOT VALID;

-- Avatar URL: optional, must start with http:// or https://, max 500 characters.
ALTER TABLE vendors
  ADD CONSTRAINT vendors_avatar_url
    CHECK (avatar IS NULL OR (char_length(avatar) <= 500 AND avatar ~ '^https?://')) NOT VALID;

-- Address: optional, max 250 characters.
ALTER TABLE vendors
  ADD CONSTRAINT vendors_address_length
    CHECK (address IS NULL OR char_length(address) <= 250) NOT VALID;

-- ============================================================
-- INVENTORY
-- ============================================================

-- Normalise existing SKUs to uppercase.
UPDATE inventory
SET sku = upper(sku)
WHERE sku IS NOT NULL
  AND sku <> upper(sku);

-- Case-insensitive unique index on (branch_id, lower(sku)) for active items only.
-- Archived items (deleted_at IS NOT NULL) are excluded so they don't block reuse.
CREATE UNIQUE INDEX uq_inventory_branch_sku_lower ON inventory (branch_id, lower(sku))
WHERE deleted_at IS NULL;

-- SKU format: 3–25 characters, uppercase letters / digits / hyphens only.
ALTER TABLE inventory
  ADD CONSTRAINT inventory_sku_format
    CHECK (sku ~ '^[A-Z0-9-]{3,25}$') NOT VALID;

-- Item name length: 2–120 characters.
ALTER TABLE inventory
  ADD CONSTRAINT inventory_name_length
    CHECK (char_length(btrim(name)) >= 2 AND char_length(name) <= 120) NOT VALID;

-- Image URL: optional, must start with http:// or https://, max 500 characters.
ALTER TABLE inventory
  ADD CONSTRAINT inventory_image_url
    CHECK (image IS NULL OR (char_length(image) <= 500 AND image ~ '^https?://')) NOT VALID;

-- ============================================================
-- OFFERS
-- ============================================================

-- Normalise existing codes to uppercase.
UPDATE offers
SET code = upper(code)
WHERE code <> upper(code);

-- Case-insensitive unique index on code.
CREATE UNIQUE INDEX uq_offers_code_lower ON offers (lower(code));

-- Code format: 4–25 characters, uppercase letters / digits / hyphens only.
ALTER TABLE offers
  ADD CONSTRAINT offers_code_format
    CHECK (code ~ '^[A-Z0-9-]{4,25}$') NOT VALID;

-- Name length: 2–120 characters.
ALTER TABLE offers
  ADD CONSTRAINT offers_name_length
    CHECK (char_length(btrim(name)) >= 2 AND char_length(name) <= 120) NOT VALID;

-- Description: optional, max 250 characters.
ALTER TABLE offers
  ADD CONSTRAINT offers_description_length
    CHECK (description IS NULL OR char_length(description) <= 250) NOT VALID;

-- ============================================================
-- CUSTOMERS
-- ============================================================

-- Normalise existing customer codes to uppercase.
UPDATE customers
SET customer_code = upper(customer_code)
WHERE customer_code IS NOT NULL
  AND customer_code <> upper(customer_code);

-- Case-insensitive unique index on customer_code (NULL values excluded).
CREATE UNIQUE INDEX uq_customers_code_lower ON customers (lower(customer_code))
WHERE customer_code IS NOT NULL;

-- Code format: 4–25 characters, uppercase letters / digits / hyphens only.
ALTER TABLE customers
  ADD CONSTRAINT customers_code_format
    CHECK (customer_code IS NULL OR customer_code ~ '^[A-Z0-9-]{4,25}$') NOT VALID;

-- Name length: 2–120 characters.
ALTER TABLE customers
  ADD CONSTRAINT customers_name_length
    CHECK (char_length(btrim(name)) >= 2 AND char_length(name) <= 120) NOT VALID;

-- Phone: 10-digit Indian mobile number starting with 6–9.
ALTER TABLE customers
  ADD CONSTRAINT customers_phone_format
    CHECK (phone ~ '^[6-9][0-9]{9}$') NOT VALID;

-- Alternate phone: optional, same format as primary phone.
ALTER TABLE customers
  ADD CONSTRAINT customers_alternate_phone_format
    CHECK (alternate_phone IS NULL OR alternate_phone ~ '^[6-9][0-9]{9}$') NOT VALID;

-- Avatar URL: optional, must start with http:// or https://, max 500 characters.
ALTER TABLE customers
  ADD CONSTRAINT customers_avatar_url
    CHECK (avatar IS NULL OR (char_length(avatar) <= 500 AND avatar ~ '^https?://')) NOT VALID;

-- Address: optional, max 250 characters.
ALTER TABLE customers
  ADD CONSTRAINT customers_address_length
    CHECK (address IS NULL OR char_length(address) <= 250) NOT VALID;

-- Studio name: optional, max 120 characters.
ALTER TABLE customers
  ADD CONSTRAINT customers_studio_name_length
    CHECK (studio_name IS NULL OR char_length(studio_name) <= 120) NOT VALID;

-- Studio association name: optional, max 120 characters.
ALTER TABLE customers
  ADD CONSTRAINT customers_studio_association_name_length
    CHECK (
      studio_association_name IS NULL OR char_length(studio_association_name) <= 120
    ) NOT VALID;

-- Studio association ID number: optional, max 50 characters.
ALTER TABLE customers
  ADD CONSTRAINT customers_studio_association_id_length
    CHECK (
      studio_association_id_number IS NULL OR char_length(studio_association_id_number) <= 50
    ) NOT VALID;

-- migrate:down

-- customers
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_studio_association_id_length;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_studio_association_name_length;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_studio_name_length;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_address_length;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_avatar_url;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_alternate_phone_format;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_phone_format;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_name_length;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_code_format;
DROP INDEX IF EXISTS uq_customers_code_lower;

-- offers
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_description_length;
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_name_length;
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_code_format;
DROP INDEX IF EXISTS uq_offers_code_lower;

-- inventory
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_image_url;
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_name_length;
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_sku_format;
DROP INDEX IF EXISTS uq_inventory_branch_sku_lower;

-- vendors
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_address_length;
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_avatar_url;
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_alternate_phone_format;
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_phone_format;
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_name_length;
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_code_format;
DROP INDEX IF EXISTS uq_vendors_code_lower;
