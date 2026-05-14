-- migrate:up

-- Step 1: Normalise well-formed existing phone numbers so most rows already
-- satisfy the new 10-digit Indian format constraint.
--
-- Normalisation order matters: strip non-digits first, then strip
-- country/trunk prefix for 12-digit (91XXXXXXXXXX) and 11-digit
-- (0XXXXXXXXXX) variants.

-- Primary phone
UPDATE users
SET phone = regexp_replace(phone, '[^0-9]', '', 'g')
WHERE phone ~ '[^0-9]';

UPDATE users
SET phone = substr(phone, 3)
WHERE length(phone) = 12 AND phone LIKE '91%';

UPDATE users
SET phone = substr(phone, 2)
WHERE length(phone) = 11 AND phone LIKE '0%';

-- Alternate phone (nullable)
UPDATE users
SET alternate_phone = regexp_replace(alternate_phone, '[^0-9]', '', 'g')
WHERE alternate_phone IS NOT NULL AND alternate_phone ~ '[^0-9]';

UPDATE users
SET alternate_phone = substr(alternate_phone, 3)
WHERE alternate_phone IS NOT NULL AND length(alternate_phone) = 12 AND alternate_phone LIKE '91%';

UPDATE users
SET alternate_phone = substr(alternate_phone, 2)
WHERE alternate_phone IS NOT NULL AND length(alternate_phone) = 11 AND alternate_phone LIKE '0%';

-- Step 2: Add CHECK constraints with NOT VALID so that:
--   * All future INSERT / UPDATE rows must satisfy the constraint.
--   * Pre-existing rows that could not be normalised are not blocked.
--
-- To validate historical data after cleaning it up, run:
--   ALTER TABLE users VALIDATE CONSTRAINT users_phone_format;
--   ALTER TABLE users VALIDATE CONSTRAINT users_alternate_phone_format;
--   ALTER TABLE users VALIDATE CONSTRAINT users_email_format;
--   ALTER TABLE users VALIDATE CONSTRAINT users_address_length;

-- Phone: 10-digit string that starts with 6, 7, 8, or 9.
ALTER TABLE users
  ADD CONSTRAINT users_phone_format
    CHECK (phone ~ '^[6-9][0-9]{9}$') NOT VALID;

-- Alternate phone: same rule, but nullable.
ALTER TABLE users
  ADD CONSTRAINT users_alternate_phone_format
    CHECK (alternate_phone IS NULL OR alternate_phone ~ '^[6-9][0-9]{9}$') NOT VALID;

-- Email: present -> must contain '@' and be at most 254 characters.
ALTER TABLE users
  ADD CONSTRAINT users_email_format
    CHECK (email IS NULL OR (char_length(email) <= 254 AND email ~ '@')) NOT VALID;

-- Address: max 250 characters.
ALTER TABLE users
  ADD CONSTRAINT users_address_length
    CHECK (address IS NULL OR char_length(address) <= 250) NOT VALID;

-- migrate:down

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_format;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_alternate_phone_format;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_format;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_address_length;
