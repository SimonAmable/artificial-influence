-- Wan 3.0 and Wan 3.0 Prime accept reference video on Fal's reference-to-video endpoint.

UPDATE public.models
SET
  description = CASE identifier
    WHEN 'alibaba/wan-3.0' THEN 'Alibaba Wan 3.0 on Fal. Text, start and end frames, or up to 5 reference videos, up to 30 seconds with audio.'
    ELSE 'Faster Wan 3.0 Prime on Fal for text, frames, or reference video, up to 30 seconds.'
  END,
  supports_reference_video = true,
  agent_usage = CASE identifier
    WHEN 'alibaba/wan-3.0' THEN '{"agentSummary":"Wan 3.0 video on Fal. Text-to-video, image-to-video with optional end frame, or reference-to-video when a reference video is attached.","bestFor":["30 second clips","audio","reference video"],"avoidFor":["motion copy"]}'::jsonb
    ELSE '{"agentSummary":"Wan 3.0 Prime, the faster Wan 3.0 video route. Accepts a reference video.","bestFor":["faster wan video","reference video"],"avoidFor":["motion copy"]}'::jsonb
  END,
  updated_at = timezone('utc'::text, now())
WHERE identifier IN ('alibaba/wan-3.0', 'alibaba/wan-3.0-prime');
