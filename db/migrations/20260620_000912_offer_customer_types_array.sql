-- migrate:up
-- Replace the single customer_type column on offers with an array column
-- customer_types so one offer can target multiple customer types.
-- NULL customer_types means the offer applies to all customer types (existing behaviour).

ALTER TABLE offers
  ADD COLUMN customer_types customer_type[];

-- Backfill: wrap existing single value into a one-element array.
-- Rows where customer_type was NULL stay NULL (= all customer types).
UPDATE offers
SET customer_types = ARRAY[customer_type]
WHERE customer_type IS NOT NULL;

-- Drop the old scalar column and its B-tree index.
DROP INDEX IF EXISTS idx_offers_customer_type;

ALTER TABLE offers
  DROP COLUMN customer_type;

-- GIN index for efficient containment queries (e.g. customer_types @> ARRAY['studio'::customer_type]).
CREATE INDEX IF NOT EXISTS idx_offers_customer_types ON offers USING GIN (customer_types);

-- migrate:down
ALTER TABLE offers
  ADD COLUMN customer_type customer_type;

-- Restore from first element of the array (best-effort rollback).
UPDATE offers
SET customer_type = customer_types[1]
WHERE customer_types IS NOT NULL
  AND array_length(customer_types, 1) >= 1;

DROP INDEX IF EXISTS idx_offers_customer_types;

ALTER TABLE offers
  DROP COLUMN customer_types;

CREATE INDEX IF NOT EXISTS idx_offers_customer_type ON offers (customer_type);
