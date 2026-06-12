-- migrate:up

-- 1. Add offer_discount_amount and manual_discount_amount columns to orders.
--    discount_amount remains the authoritative total used by recalculate_order_financials.
--    App code keeps all three in sync on every write.

ALTER TABLE orders
  ADD COLUMN offer_discount_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (offer_discount_amount >= 0),
  ADD COLUMN manual_discount_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (manual_discount_amount >= 0);

-- Backfill: all existing discount was offer-driven; manual stays at 0.
UPDATE orders
SET
  offer_discount_amount = discount_amount;

-- 2. Patch trg_recalculate_order_after_items to support "item-replace mode".
--
--    When updateOrder replaces all items (DELETE + re-INSERT), this AFTER-ROW
--    trigger fires after every DELETE. After the last row is gone total_amount = 0
--    while paid_amount > 0, which violates CHECK (paid_amount <= payable_amount)
--    even though the final state will be perfectly valid.
--
--    Fix: the application sets the transaction-local variable
--      app.order_item_replace = 'true'
--    before deleting items and clears it after re-inserting them. When the flag is
--    set, this trigger skips intermediate recalculations. The application then calls
--    recalculate_order_financials() explicitly once all items are in place.

CREATE OR REPLACE FUNCTION trg_recalculate_order_after_items ()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF current_setting('app.order_item_replace', TRUE) = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  PERFORM
    recalculate_order_financials (COALESCE(NEW.order_id, OLD.order_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- migrate:down

ALTER TABLE orders
  DROP COLUMN IF EXISTS offer_discount_amount,
  DROP COLUMN IF EXISTS manual_discount_amount;

-- Restore the original trigger function without replace-mode awareness.
CREATE OR REPLACE FUNCTION trg_recalculate_order_after_items ()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  PERFORM
    recalculate_order_financials (COALESCE(NEW.order_id, OLD.order_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;
