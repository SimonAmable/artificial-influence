CREATE OR REPLACE FUNCTION public._sanitize_output_error_message(message jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN jsonb_typeof(message) <> 'object' THEN message
    ELSE jsonb_set(
      message,
      '{parts}',
      COALESCE((
        SELECT jsonb_agg(
          CASE
            WHEN jsonb_typeof(part.value) = 'object'
             AND part.value->>'state' = 'output-error'
             AND part.value ? 'output'
              THEN part.value - 'output'
            ELSE part.value
          END
          ORDER BY part.ordinality
        )
        FROM jsonb_array_elements(COALESCE(message->'parts', '[]'::jsonb))
          WITH ORDINALITY AS part(value, ordinality)
      ), '[]'::jsonb),
      true
    )
  END
$$;

CREATE OR REPLACE FUNCTION public._sanitize_output_error_messages(messages jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE((
    SELECT jsonb_agg(
      public._sanitize_output_error_message(message.value)
      ORDER BY message.ordinality
    )
    FROM jsonb_array_elements(COALESCE(messages, '[]'::jsonb))
      WITH ORDINALITY AS message(value, ordinality)
  ), '[]'::jsonb)
$$;

UPDATE public.chat_threads
SET messages = public._sanitize_output_error_messages(messages)
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements(COALESCE(messages, '[]'::jsonb)) AS message(value),
       jsonb_array_elements(COALESCE(message.value->'parts', '[]'::jsonb)) AS part(value)
  WHERE part.value->>'state' = 'output-error'
    AND part.value ? 'output'
);

UPDATE public.chat_messages
SET message = public._sanitize_output_error_message(message)
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements(COALESCE(message->'parts', '[]'::jsonb)) AS part(value)
  WHERE part.value->>'state' = 'output-error'
    AND part.value ? 'output'
);

DROP FUNCTION public._sanitize_output_error_messages(jsonb);
DROP FUNCTION public._sanitize_output_error_message(jsonb);
