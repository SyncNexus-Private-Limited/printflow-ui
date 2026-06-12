-- migrate:up

-- Track how customer avatar values should be resolved.
-- external: avatar stores a full external URL (e.g. https://...jpg).
-- uploaded: avatar stores a relative path/key that must be resolved
--           against a storage base URL at runtime (future upload support).
--
-- Existing rows have their avatar column treated as external URLs, so
-- DEFAULT 'external' is safe for all existing data.

ALTER TABLE customers
  ADD COLUMN avatar_source text NOT NULL DEFAULT 'external';

ALTER TABLE customers
  ADD CONSTRAINT customers_avatar_source_check CHECK (
    avatar_source IN ('external', 'uploaded')
  );

-- migrate:down

ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_avatar_source_check;

ALTER TABLE customers
  DROP COLUMN IF EXISTS avatar_source;
