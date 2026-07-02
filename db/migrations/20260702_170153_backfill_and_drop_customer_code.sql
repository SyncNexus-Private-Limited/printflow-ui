-- migrate:up

-- Backfill customer_numeric_id from the numeric portion of customer_code for
-- rows that predate customer_numeric_id and only have a customer_code. Only
-- applied where the extracted digits are non-empty, safely fit a bigint, are
-- unique among all extracted candidates, and don't collide with an existing
-- customer_numeric_id -- ambiguous/colliding rows are left NULL for manual
-- assignment via Add Customer rather than risk merging two customers onto the
-- same numeric id.
WITH candidates AS (
  SELECT
    id,
    NULLIF(regexp_replace(customer_code, '\D', '', 'g'), '')::bigint AS candidate
  FROM customers
  WHERE
    customer_numeric_id IS NULL
    AND customer_code IS NOT NULL
    AND regexp_replace(customer_code, '\D', '', 'g') <> ''
    AND length(regexp_replace(customer_code, '\D', '', 'g')) <= 18
),
candidate_counts AS (
  SELECT candidate, count(*) AS cnt
  FROM candidates
  WHERE candidate IS NOT NULL
  GROUP BY candidate
),
safe_candidates AS (
  SELECT c.id, c.candidate
  FROM candidates c
  JOIN candidate_counts cc ON cc.candidate = c.candidate
  WHERE
    cc.cnt = 1
    AND NOT EXISTS (
      SELECT 1
      FROM customers existing
      WHERE existing.customer_numeric_id = c.candidate
    )
)
UPDATE customers
SET customer_numeric_id = safe_candidates.candidate
FROM safe_candidates
WHERE customers.id = safe_candidates.id;

DROP INDEX IF EXISTS uq_customers_code_lower;

ALTER TABLE customers
DROP CONSTRAINT IF EXISTS customers_code_format;

ALTER TABLE customers
DROP COLUMN IF EXISTS customer_code;

-- migrate:down

-- NOTE: schema-only restore. customer_code values (including ones consumed by
-- the backfill above) are not recoverable on rollback.
ALTER TABLE customers
ADD COLUMN customer_code text UNIQUE;

ALTER TABLE customers
ADD CONSTRAINT customers_code_format CHECK (customer_code IS NULL OR customer_code ~ '^[A-Z0-9-]{4,25}$');

CREATE UNIQUE INDEX uq_customers_code_lower ON customers (lower(customer_code))
WHERE
  customer_code IS NOT NULL;
