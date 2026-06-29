-- migrate:up

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: trg_zero_outstanding_on_cancel
-- When an order's status transitions to 'cancelled', the remaining unpaid
-- balance is forgiven: payable_amount drops to match paid_amount so
-- (payable_amount - paid_amount) is 0 everywhere outstanding is computed.
-- total_amount/discount_amount/paid_amount are left untouched as the
-- historical record of what was ordered and what was actually collected.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_zero_outstanding_on_cancel ()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM
      set_internal_order_update (TRUE);
    UPDATE
      orders
    SET
      payable_amount = paid_amount,
      payment_status = CASE WHEN paid_amount = 0 THEN
        'pending'::payment_status
      ELSE
        'paid'::payment_status
      END,
      updated_at = now()
    WHERE
      id = NEW.id;
    PERFORM
      set_internal_order_update (FALSE);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_zero_outstanding_on_cancel
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION trg_zero_outstanding_on_cancel ();

-- -----------------------------------------------------------------------------
-- Backfill: correct already-cancelled orders that still carry a stale
-- outstanding balance from before this trigger existed.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  PERFORM
    set_internal_order_update (TRUE);
  UPDATE
    orders
  SET
    payable_amount = paid_amount,
    payment_status = CASE WHEN paid_amount = 0 THEN
      'pending'::payment_status
    ELSE
      'paid'::payment_status
    END,
    updated_at = now()
  WHERE
    status = 'cancelled'
    AND payable_amount <> paid_amount;
  PERFORM
    set_internal_order_update (FALSE);
END;
$$;

-- migrate:down

DROP TRIGGER IF EXISTS trg_zero_outstanding_on_cancel ON orders;

DROP FUNCTION IF EXISTS trg_zero_outstanding_on_cancel ();
