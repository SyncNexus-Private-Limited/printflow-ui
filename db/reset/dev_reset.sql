DO $$
BEGIN
  IF to_regclass('public.branches') IS NOT NULL THEN
    TRUNCATE TABLE
      expense_attachments,
      employee_expenses,
      branch_expenses,
      expense_categories,
      app_sessions,
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
      customer_sequences,
      branches
    RESTART IDENTITY CASCADE;
  END IF;
END;
$$;
