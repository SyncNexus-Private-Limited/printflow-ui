-- migrate:up

-- Add business_name as nullable first so existing rows are unaffected.
ALTER TABLE vendors
  ADD COLUMN business_name text;

-- Backfill existing vendors from their name so NOT NULL is safe to add.
UPDATE vendors
SET
  business_name = name
WHERE
  business_name IS NULL;

-- Enforce NOT NULL now that all rows have a value.
ALTER TABLE vendors
  ALTER COLUMN business_name SET NOT NULL;

-- Mirror the existing name constraint pattern.
ALTER TABLE vendors
  ADD CONSTRAINT vendors_business_name_length CHECK (
    char_length(btrim(business_name)) >= 2
    AND char_length(business_name) <= 120
  );

-- migrate:down

ALTER TABLE vendors
  DROP COLUMN IF EXISTS business_name;
