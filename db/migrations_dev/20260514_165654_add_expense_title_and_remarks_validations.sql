-- migrate:up

-- Title: 2–120 characters. NOT VALID — existing rows may not conform.
ALTER TABLE branch_expenses
  ADD CONSTRAINT branch_expenses_title_length
    CHECK (char_length(btrim(title)) >= 2 AND char_length(title) <= 120) NOT VALID;

ALTER TABLE employee_expenses
  ADD CONSTRAINT employee_expenses_title_length
    CHECK (char_length(btrim(title)) >= 2 AND char_length(title) <= 120) NOT VALID;

-- Remarks: optional, max 250 characters. NOT VALID — existing rows may have longer values.
ALTER TABLE branch_expenses
  ADD CONSTRAINT branch_expenses_remarks_length
    CHECK (remarks IS NULL OR char_length(remarks) <= 250) NOT VALID;

ALTER TABLE employee_expenses
  ADD CONSTRAINT employee_expenses_remarks_length
    CHECK (remarks IS NULL OR char_length(remarks) <= 250) NOT VALID;

-- migrate:down

ALTER TABLE branch_expenses DROP CONSTRAINT IF EXISTS branch_expenses_title_length;
ALTER TABLE employee_expenses DROP CONSTRAINT IF EXISTS employee_expenses_title_length;
ALTER TABLE branch_expenses DROP CONSTRAINT IF EXISTS branch_expenses_remarks_length;
ALTER TABLE employee_expenses DROP CONSTRAINT IF EXISTS employee_expenses_remarks_length;
