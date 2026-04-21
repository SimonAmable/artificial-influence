-- Allow users to update their own upload rows so chat can attach chat_thread_id after
-- finalize-created rows (same user_id + storage_path unique key).

CREATE POLICY "Users update own uploads"
  ON public.uploads
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
