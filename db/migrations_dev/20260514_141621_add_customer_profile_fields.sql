-- migrate:up

-- Add three new optional profile columns to customers.
-- aadhaar_number: 12-digit national ID (normalised, no spaces/dashes).
--   A CHECK constraint enforces the digit pattern; a partial UNIQUE index
--   prevents two rows sharing the same non-null Aadhaar number.
-- studio_association_name / studio_association_id_number: studio
--   membership / affiliation details, free-text.

ALTER TABLE customers
  ADD COLUMN aadhaar_number text,
  ADD COLUMN studio_association_name text,
  ADD COLUMN studio_association_id_number text;

ALTER TABLE customers
  ADD CONSTRAINT customers_aadhaar_number_format CHECK (
    aadhaar_number ~ '^\d{12}$'
  );

CREATE UNIQUE INDEX customers_aadhaar_number_unique
  ON customers (aadhaar_number)
  WHERE aadhaar_number IS NOT NULL;

-- migrate:down

DROP INDEX IF EXISTS customers_aadhaar_number_unique;

ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_aadhaar_number_format;

ALTER TABLE customers
  DROP COLUMN IF EXISTS aadhaar_number,
  DROP COLUMN IF EXISTS studio_association_name,
  DROP COLUMN IF EXISTS studio_association_id_number;
