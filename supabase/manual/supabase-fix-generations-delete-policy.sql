-- Fix generations table RLS policy to allow DELETE operations
-- The issue: The existing policy doesn't have a WITH CHECK clause, 
-- which is required for DELETE operations to work properly

-- Drop the existing policy
DROP POLICY IF EXISTS "Enable all for users based on user_id" ON generations;

-- Recreate it with proper WITH CHECK clause for DELETE operations
CREATE POLICY "Enable all for users based on user_id"
ON generations
FOR ALL
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Verify the policy was created correctly
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'generations' 
  AND policyname = 'Enable all for users based on user_id';
