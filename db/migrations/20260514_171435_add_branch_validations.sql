-- migrate:up

-- Normalise existing codes to uppercase so the new case-insensitive unique
-- index and format constraint are consistent from day one.
UPDATE branches
SET code = upper(code)
WHERE code <> upper(code);

-- Case-insensitive unique index on code.
-- After upper() normalisation, lower(code) gives a canonical unique key that
-- prevents both "MAIN" and "main" from coexisting.
CREATE UNIQUE INDEX uq_branches_code_lower ON branches (lower(code));

-- Code format: 4–25 characters, uppercase letters / digits / hyphens only.
-- NOT VALID — existing rows may not conform to the stricter pattern.
ALTER TABLE branches
  ADD CONSTRAINT branches_code_format
    CHECK (code ~ '^[A-Z0-9-]{4,25}$') NOT VALID;

-- Name length: 2–120 characters.
ALTER TABLE branches
  ADD CONSTRAINT branches_name_length
    CHECK (char_length(btrim(name)) >= 2 AND char_length(name) <= 120) NOT VALID;

-- Phone: 10-digit Indian mobile number starting with 6–9.
ALTER TABLE branches
  ADD CONSTRAINT branches_phone_format
    CHECK (phone ~ '^[6-9][0-9]{9}$') NOT VALID;

-- Alternate phone: optional, same format as primary phone.
ALTER TABLE branches
  ADD CONSTRAINT branches_alternate_phone_format
    CHECK (alternate_phone IS NULL OR alternate_phone ~ '^[6-9][0-9]{9}$') NOT VALID;

-- Email: optional, max 254 characters with a basic @ presence check.
ALTER TABLE branches
  ADD CONSTRAINT branches_email_format
    CHECK (email IS NULL OR (char_length(email) <= 254 AND email LIKE '%@%')) NOT VALID;

-- Logo URL: optional, must start with http:// or https://, max 500 characters.
ALTER TABLE branches
  ADD CONSTRAINT branches_logo_url
    CHECK (logo IS NULL OR (char_length(logo) <= 500 AND logo ~ '^https?://')) NOT VALID;

-- Banner URL: optional, must start with http:// or https://, max 500 characters.
ALTER TABLE branches
  ADD CONSTRAINT branches_banner_url
    CHECK (banner IS NULL OR (char_length(banner) <= 500 AND banner ~ '^https?://')) NOT VALID;

-- Address: optional, max 250 characters.
ALTER TABLE branches
  ADD CONSTRAINT branches_address_length
    CHECK (address IS NULL OR char_length(address) <= 250) NOT VALID;

-- Description: optional, max 250 characters.
ALTER TABLE branches
  ADD CONSTRAINT branches_description_length
    CHECK (description IS NULL OR char_length(description) <= 250) NOT VALID;

-- migrate:down

DROP INDEX IF EXISTS uq_branches_code_lower;
ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_code_format;
ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_name_length;
ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_phone_format;
ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_alternate_phone_format;
ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_email_format;
ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_logo_url;
ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_banner_url;
ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_address_length;
ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_description_length;
