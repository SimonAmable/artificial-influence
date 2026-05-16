-- Create feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('general', 'bug', 'feature', 'improvement')),
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'in_progress', 'resolved', 'closed')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to insert their own feedback
CREATE POLICY "Users can insert feedback"
  ON public.feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create policy to allow users to view their own feedback
CREATE POLICY "Users can view own feedback"
  ON public.feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policy for admins to view all feedback (you can customize this based on your admin system)
-- For now, this is commented out - uncomment and modify when you have an admin role system
-- CREATE POLICY "Admins can view all feedback"
--   ON public.feedback
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE profiles.id = auth.uid()
--       AND profiles.role = 'admin'
--     )
--   );

-- Create policy for admins to update feedback (you can customize this based on your admin system)
-- CREATE POLICY "Admins can update feedback"
--   ON public.feedback
--   FOR UPDATE
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE profiles.id = auth.uid()
--       AND profiles.role = 'admin'
--     )
--   );

-- Create updated_at trigger
CREATE TRIGGER on_feedback_updated
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);

-- Grant necessary permissions
GRANT SELECT, INSERT ON public.feedback TO authenticated;
GRANT SELECT, INSERT ON public.feedback TO anon;

COMMENT ON TABLE public.feedback IS 'Stores user feedback, bug reports, and feature requests';
COMMENT ON COLUMN public.feedback.feedback_type IS 'Type of feedback: general, bug, feature, or improvement';
COMMENT ON COLUMN public.feedback.status IS 'Current status: pending, reviewed, in_progress, resolved, or closed';
COMMENT ON COLUMN public.feedback.admin_notes IS 'Internal notes from administrators';
