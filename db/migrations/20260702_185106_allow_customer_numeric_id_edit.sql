-- migrate:up

-- Relax the UPDATE-side immutability check so customer_numeric_id can be
-- edited (with app-level duplicate validation backed by the existing UNIQUE
-- constraint). INSERT-time auto-generation and rejection of manually
-- supplied values on creation are unchanged.
DROP TRIGGER IF EXISTS trigger_set_customer_numeric_id ON customers;

CREATE OR REPLACE FUNCTION trg_set_customer_numeric_id ()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF NEW.customer_numeric_id IS NOT NULL THEN
    RAISE EXCEPTION 'Manual customer_numeric_id not allowed';
  END IF;
  NEW.customer_numeric_id := generate_customer_numeric_id ();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_customer_numeric_id
  BEFORE INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_customer_numeric_id ();

-- migrate:down

-- Restores the combined INSERT+UPDATE immutable-trigger behavior.
DROP TRIGGER IF EXISTS trigger_set_customer_numeric_id ON customers;

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
