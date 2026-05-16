-- Rename library category motion → shorts (slug + DB constraint).

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

UPDATE assets
SET category = 'shorts'
WHERE category = 'motion';

ALTER TABLE assets
ADD CONSTRAINT assets_category_check CHECK (category IN ('character', 'scene', 'shorts', 'element'));
