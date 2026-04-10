DO $$
BEGIN
  IF to_regclass('public.branches') IS NOT NULL THEN
    TRUNCATE TABLE
      app_sessions,
      employee_expenses,
      branch_expenses,
      order_offer_items,
      offer_items,
      order_vendors,
      payments,
      order_items,
      orders,
      inventory_pricing,
      inventory,
      vendors,
      customers,
      user_auth,
      users,
      order_sequences,
      branches
    RESTART IDENTITY CASCADE;
  END IF;
END;
$$;
