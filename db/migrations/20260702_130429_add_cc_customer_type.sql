-- migrate:up

ALTER TYPE customer_type ADD VALUE IF NOT EXISTS 'CC';

-- migrate:down

-- NOTE: PostgreSQL does not support removing values from an enum type.
-- To roll back, the enum would need to be recreated and all data migrated,
-- which is destructive. This migration is intentionally left without a down path.
