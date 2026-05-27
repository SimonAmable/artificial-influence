alter table public.feedback
  add column if not exists tiktok_links text;

alter table public.feedback
  drop constraint if exists feedback_feedback_type_check;

alter table public.feedback
  add constraint feedback_feedback_type_check
  check (feedback_type in ('general', 'bug', 'feature', 'improvement', 'template_request'));

comment on column public.feedback.tiktok_links is
  'TikTok trend links supplied for template request feedback.';
