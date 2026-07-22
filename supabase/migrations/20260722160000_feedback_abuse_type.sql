alter table public.feedback
  drop constraint if exists feedback_feedback_type_check;

alter table public.feedback
  add constraint feedback_feedback_type_check
  check (feedback_type in ('general', 'bug', 'feature', 'improvement', 'template_request', 'abuse'));
