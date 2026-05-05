-- 1. Drop the old check constraint first so we can insert new values
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'assets'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%category%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE assets DROP CONSTRAINT ' || quote_ident(constraint_name);
    END IF;
END $$;

-- 2. Migrate existing rows to the new categories
UPDATE assets
SET category = 'motion'
WHERE category IN ('shorts');

UPDATE assets
SET category = 'element'
WHERE category IN ('texture', 'thumbnails', 'audio', 'product');

-- 3. Add the new check constraint
ALTER TABLE assets
ADD CONSTRAINT assets_category_check CHECK (category IN ('character', 'scene', 'motion', 'element'));
