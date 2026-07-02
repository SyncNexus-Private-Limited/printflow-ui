-- migrate:up

-- Global counter for customer_numeric_id. Unlike order_code (scoped per
-- branch + year via order_sequences), customers has no branch_id, so this is
-- a single fixed-key singleton row.
CREATE TABLE customer_sequences (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_number bigint NOT NULL DEFAULT 0 CHECK (last_number >= 0)
);

-- Same atomic-UPSERT idiom as generate_order_code(): the INSERT ... ON
-- CONFLICT DO UPDATE ... RETURNING is a single atomic statement, so
-- concurrent callers serialize on the row lock with no advisory lock needed.
CREATE OR REPLACE FUNCTION generate_customer_numeric_id ()
  RETURNS bigint
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_next_number bigint;
BEGIN
  INSERT INTO customer_sequences (id, last_number)
    VALUES (1, 1)
  ON CONFLICT (id)
    DO UPDATE SET
      last_number = customer_sequences.last_number + 1
    RETURNING
      last_number INTO v_next_number;
  RETURN v_next_number;
END;
$$;

-- Seed the counter from existing data before backfilling/enforcing NOT NULL,
-- so the first generated value never collides with an already-assigned one.
INSERT INTO customer_sequences (id, last_number)
VALUES (1, GREATEST(COALESCE((SELECT MAX(customer_numeric_id) FROM customers), 0), 0))
ON CONFLICT (id)
  DO UPDATE SET
    last_number = EXCLUDED.last_number;

-- Defensive backfill: no NULLs are expected in the current dataset, but
-- other environments may differ.
UPDATE customers
SET customer_numeric_id = generate_customer_numeric_id ()
WHERE
  customer_numeric_id IS NULL;

ALTER TABLE customers
ALTER COLUMN customer_numeric_id
SET NOT NULL;

-- Combines generation (INSERT) and immutability (UPDATE) enforcement in one
-- function, since customers has no existing multi-field "validate header"
-- trigger (unlike orders' trg_validate_order_header) to piggyback on.
CREATE OR REPLACE FUNCTION trg_set_customer_numeric_id ()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.customer_numeric_id IS NOT NULL THEN
      RAISE EXCEPTION 'Manual customer_numeric_id not allowed';
    END IF;
    NEW.customer_numeric_id := generate_customer_numeric_id ();
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.customer_numeric_id IS DISTINCT FROM NEW.customer_numeric_id THEN
      RAISE EXCEPTION 'customer_numeric_id is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_customer_numeric_id
  BEFORE INSERT OR UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_customer_numeric_id ();

-- migrate:down

-- NOTE: schema-only restore. This cannot un-backfill NULLs that were filled
-- above, nor restore manually-supplied values that were rejected while the
-- trigger was active.
DROP TRIGGER IF EXISTS trigger_set_customer_numeric_id ON customers;

DROP FUNCTION IF EXISTS trg_set_customer_numeric_id ();

ALTER TABLE customers
ALTER COLUMN customer_numeric_id
DROP NOT NULL;

DROP FUNCTION IF EXISTS generate_customer_numeric_id ();

DROP TABLE IF EXISTS customer_sequences;
