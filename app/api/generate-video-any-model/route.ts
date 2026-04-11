import Replicate from 'replicate';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkUserHasCredits, deductUserCredits } from '@/lib/credits';
import { inferStoragePathFromUrl } from '@/lib/assets/library';

function collectStoragePaths(values: unknown[]): string[] {
  const paths = values.flatMap((value) => {
    if (typeof value === 'string') {
      const storagePath = inferStoragePathFromUrl(value);
      return storagePath ? [storagePath] : [];
    }

    if (Array.isArray(value)) {
      return collectStoragePaths(value);
    }

    return [];
  });

  return [...new Set(paths)];
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  console.log('[generate-video-test] ===== Request started =====');
  
  try {
    // Check for API token
    if (!process.env.REPLICATE_API_TOKEN) {
      console.error('[generate-video-test] REPLICATE_API_TOKEN not set');
      return NextResponse.json(
        { error: 'REPLICATE_API_TOKEN environment variable is not set' },
        { status: 500 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('[generate-video-test] Authentication failed:', authError?.message || 'No user');
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to generate videos.' },
        { status: 401 }
      );
    }
    console.log('[generate-video-test] ✓ User authenticated:', { userId: user.id });

    // Parse JSON body
    const body = await request.json();
    const {
      model,
      prompt,
      image,
      first_frame_image,
      last_frame,
      negative_prompt,
      ...otherParams
    } = body;

    console.log('[generate-video-test] Request params:', {
      model,
      promptLength: prompt?.length || 0,
      hasImage: !!image,
      hasFirstFrame: !!first_frame_image,
      hasLastFrame: !!last_frame,
      otherParams,
    });

    // Validate required fields
    if (!model || typeof model !== 'string') {
      return NextResponse.json(
        { error: 'Model identifier is required' },
        { status: 400 }
      );
    }

    const isMotionCopy = model === 'kwaivgi/kling-v2.6-motion-control' || model === 'kwaivgi/kling-v3-motion-control';
    const motionCopyImage = image || body.imagePublicUrl;
    const motionCopyVideo = body.video || body.videoPublicUrl;
    const hasMotionCopyInputs = isMotionCopy && motionCopyImage && motionCopyVideo;

    if (isMotionCopy && !hasMotionCopyInputs) {
      return NextResponse.json(
        { error: 'Image and video are required for motion copy' },
        { status: 400 }
      );
    }
    if (!hasMotionCopyInputs && (!prompt || typeof prompt !== 'string')) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const { data: modelData, error: modelError } = await supabase
      .from('models')
      .select('model_cost')
      .eq('identifier', model)
      .eq('type', 'video')
      .eq('is_active', true)
      .single();

    if (modelError || !modelData) {
      return NextResponse.json(
        { error: `Model "${model}" not found or is inactive` },
        { status: 400 }
      );
    }

    const requiredCredits = Math.max(1, Number(modelData.model_cost ?? 10) || 10);
    const hasCredits = await checkUserHasCredits(user.id, requiredCredits, supabase);
    if (!hasCredits) {
      return NextResponse.json(
        { error: `Insufficient credits. Video generation requires ${requiredCredits} credits.` },
        { status: 402 }
      );
    }

    // Initialize Replicate client
    console.log('[generate-video-test] Initializing Replicate client...');
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Build input based on model (motion copy allows empty prompt)
    const effectivePrompt = hasMotionCopyInputs ? (prompt ?? '') : prompt;
    const replicateInput: Record<string, unknown> = {
      prompt: typeof effectivePrompt === 'string' ? effectivePrompt : '',
    };

    // Add model-specific parameters
    switch (model) {
      case 'minimax/hailuo-2.3-fast':
        if (first_frame_image) replicateInput.first_frame_image = first_frame_image;
        if (otherParams.duration) replicateInput.duration = otherParams.duration;
        if (otherParams.resolution) replicateInput.resolution = otherParams.resolution;
        if (otherParams.prompt_optimizer !== undefined) replicateInput.prompt_optimizer = otherParams.prompt_optimizer;
        break;

      case 'google/veo-3.1-fast':
        if (image) replicateInput.image = image;
        if (last_frame) replicateInput.last_frame = last_frame;
        if (negative_prompt) replicateInput.negative_prompt = negative_prompt;
        if (otherParams.seed !== null && otherParams.seed !== undefined) replicateInput.seed = otherParams.seed;
        if (otherParams.duration) replicateInput.duration = otherParams.duration;
        if (otherParams.resolution) replicateInput.resolution = otherParams.resolution;
        if (otherParams.aspect_ratio) replicateInput.aspect_ratio = otherParams.aspect_ratio;
        if (otherParams.generate_audio !== undefined) replicateInput.generate_audio = otherParams.generate_audio;
        break;

      case 'kwaivgi/kling-v2.6':
        if (otherParams.start_image) replicateInput.start_image = otherParams.start_image;
        if (otherParams.aspect_ratio) replicateInput.aspect_ratio = otherParams.aspect_ratio;
        if (otherParams.duration) replicateInput.duration = otherParams.duration;
        if (otherParams.generate_audio !== undefined) replicateInput.generate_audio = otherParams.generate_audio;
        if (otherParams.negative_prompt) replicateInput.negative_prompt = otherParams.negative_prompt;
        break;

      case 'kwaivgi/kling-v2.5-turbo-pro': {
        const startImage = otherParams.start_image ?? first_frame_image ?? image;
        const endImage = otherParams.end_image ?? last_frame;
        if (startImage) replicateInput.start_image = startImage;
        if (endImage) replicateInput.end_image = endImage;
        if (otherParams.aspect_ratio) replicateInput.aspect_ratio = otherParams.aspect_ratio;
        if (otherParams.duration != null && otherParams.duration !== undefined) {
          replicateInput.duration = Number(otherParams.duration);
        }
        if (negative_prompt) replicateInput.negative_prompt = negative_prompt;
        if (otherParams.negative_prompt) replicateInput.negative_prompt = otherParams.negative_prompt;
        if (otherParams.guidance_scale != null && otherParams.guidance_scale !== undefined) {
          replicateInput.guidance_scale = Number(otherParams.guidance_scale);
        }
        break;
      }

      case 'kwaivgi/kling-v2.6-motion-control':
      case 'kwaivgi/kling-v3-motion-control':
        if (motionCopyImage) replicateInput.image = motionCopyImage;
        if (motionCopyVideo) replicateInput.video = motionCopyVideo;
        if (otherParams.mode) replicateInput.mode = otherParams.mode;
        if (otherParams.keep_original_sound !== undefined) replicateInput.keep_original_sound = otherParams.keep_original_sound;
        if (otherParams.character_orientation) replicateInput.character_orientation = otherParams.character_orientation;
        break;

      case 'veed/fabric-1.0':
        if (otherParams.resolution) replicateInput.resolution = otherParams.resolution;
        break;

      case 'xai/grok-imagine-video':
        if (image) replicateInput.image = image;
        if (otherParams.video) replicateInput.video = otherParams.video;
        if (otherParams.duration) replicateInput.duration = otherParams.duration;
        if (otherParams.aspect_ratio) replicateInput.aspect_ratio = otherParams.aspect_ratio;
        if (otherParams.resolution) replicateInput.resolution = otherParams.resolution;
        break;

      case 'kwaivgi/kling-v3-video': {
        const startImage = otherParams.start_image ?? first_frame_image;
        const endImage = otherParams.end_image ?? last_frame;
        if (startImage) replicateInput.start_image = startImage;
        if (endImage) replicateInput.end_image = endImage;
        if (otherParams.mode) replicateInput.mode = otherParams.mode;
        if (otherParams.duration != null && otherParams.duration !== undefined) replicateInput.duration = Number(otherParams.duration);
        if (otherParams.aspect_ratio) replicateInput.aspect_ratio = otherParams.aspect_ratio;
        if (otherParams.generate_audio !== undefined) replicateInput.generate_audio = otherParams.generate_audio;
        if (negative_prompt) replicateInput.negative_prompt = negative_prompt;
        if (otherParams.negative_prompt) replicateInput.negative_prompt = otherParams.negative_prompt;
        if (otherParams.multi_prompt) {
          const multiPrompt = typeof otherParams.multi_prompt === 'string'
            ? otherParams.multi_prompt
            : JSON.stringify(otherParams.multi_prompt);
          replicateInput.multi_prompt = multiPrompt;
        }
        break;
      }

      case 'kwaivgi/kling-v3-omni-video': {
        const startImage = otherParams.start_image ?? first_frame_image;
        const endImage = otherParams.end_image ?? last_frame;
        if (startImage) replicateInput.start_image = startImage;
        if (endImage) replicateInput.end_image = endImage;
        if (Array.isArray(body.reference_images) && body.reference_images.length > 0) {
          replicateInput.reference_images = body.reference_images;
        }
        if (otherParams.reference_video) replicateInput.reference_video = otherParams.reference_video;
        if (body.reference_video) replicateInput.reference_video = body.reference_video;
        if (otherParams.video_reference_type) replicateInput.video_reference_type = otherParams.video_reference_type;
        if (otherParams.mode) replicateInput.mode = otherParams.mode;
        if (otherParams.duration != null && otherParams.duration !== undefined) replicateInput.duration = Number(otherParams.duration);
        if (otherParams.aspect_ratio) replicateInput.aspect_ratio = otherParams.aspect_ratio;
        if (otherParams.generate_audio !== undefined) replicateInput.generate_audio = otherParams.generate_audio;
        if (otherParams.keep_original_sound !== undefined) replicateInput.keep_original_sound = otherParams.keep_original_sound;
        if (negative_prompt) replicateInput.negative_prompt = negative_prompt;
        if (otherParams.negative_prompt) replicateInput.negative_prompt = otherParams.negative_prompt;
        if (otherParams.multi_prompt) {
          const multiPrompt = typeof otherParams.multi_prompt === 'string'
            ? otherParams.multi_prompt
            : JSON.stringify(otherParams.multi_prompt);
          replicateInput.multi_prompt = multiPrompt;
        }
        break;
      }

      case 'bytedance/seedance-2.0': {
        const refVideosRaw = [
          ...(Array.isArray(body.reference_videos) ? body.reference_videos : []),
          body.video,
          otherParams.video,
          otherParams.reference_video,
        ].filter((v): v is string => typeof v === 'string' && v.length > 0);
        const refVideos = [...new Set(refVideosRaw)];

        let refImages = [...(Array.isArray(body.reference_images) ? body.reference_images : [])].filter(
          (v): v is string => typeof v === 'string' && v.length > 0,
        );

        const startImg =
          image ||
          first_frame_image ||
          otherParams.image ||
          otherParams.start_image;
        const endImg =
          body.last_frame_image ||
          last_frame ||
          otherParams.last_frame_image ||
          otherParams.end_image;

        const refMode = refVideos.length > 0 || refImages.length > 0;
        if (refMode) {
          if (typeof startImg === 'string' && startImg && !refImages.includes(startImg)) {
            refImages = [startImg, ...refImages];
          }
          if (refImages.length > 0) replicateInput.reference_images = refImages;
          if (refVideos.length > 0) replicateInput.reference_videos = refVideos;
        } else {
          if (typeof startImg === 'string' && startImg) replicateInput.image = startImg;
          if (typeof endImg === 'string' && endImg) replicateInput.last_frame_image = endImg;
        }

        if (otherParams.duration != null && otherParams.duration !== undefined) {
          replicateInput.duration = Number(otherParams.duration);
        }
        if (otherParams.resolution) replicateInput.resolution = otherParams.resolution;
        if (otherParams.aspect_ratio) replicateInput.aspect_ratio = otherParams.aspect_ratio;
        if (otherParams.generate_audio !== undefined) replicateInput.generate_audio = otherParams.generate_audio;
        if (otherParams.seed !== null && otherParams.seed !== undefined) replicateInput.seed = otherParams.seed;
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unsupported model: ${model}` },
          { status: 400 }
        );
    }

    console.log('[generate-video-test] Replicate input:', {
      model,
      inputKeys: Object.keys(replicateInput),
    });

    const referenceImageStoragePaths = collectStoragePaths([
      replicateInput.image,
      replicateInput.first_frame_image,
      replicateInput.start_image,
      replicateInput.last_frame,
      replicateInput.last_frame_image,
      replicateInput.end_image,
      replicateInput.reference_images,
    ]);
    const referenceVideoStoragePaths = collectStoragePaths([
      replicateInput.video,
      replicateInput.reference_video,
      replicateInput.reference_videos,
    ]);

    const webhookBase = process.env.REPLICATE_WEBHOOK_BASE_URL?.replace(/\/$/, '');
    if (webhookBase) {
      const webhookUrl = `${webhookBase}/api/webhooks/replicate`;
      const replicateModelMatch = model.match(/^([^/]+\/[^:]+):(.+)$/);
      const prediction = await replicate.predictions.create(
        replicateModelMatch
          ? {
              version: replicateModelMatch[2],
              input: replicateInput,
              webhook: webhookUrl,
              webhook_events_filter: ['completed'],
            }
          : {
              model: model as `${string}/${string}`,
              input: replicateInput,
              webhook: webhookUrl,
              webhook_events_filter: ['completed'],
            }
      );

      const { data: pendingGeneration, error: insertError } = await supabase
        .from('generations')
        .insert({
          user_id: user.id,
          prompt: typeof effectivePrompt === 'string' ? effectivePrompt : null,
          supabase_storage_path: null,
          reference_images_supabase_storage_path:
            referenceImageStoragePaths.length > 0 ? referenceImageStoragePaths : null,
          reference_videos_supabase_storage_path:
            referenceVideoStoragePaths.length > 0 ? referenceVideoStoragePaths : null,
          model,
          type: 'video',
          is_public: true,
          tool: typeof body.tool === 'string' ? body.tool : null,
          status: 'pending',
          replicate_prediction_id: prediction.id,
        })
        .select('id')
        .single();

      if (insertError || !pendingGeneration) {
        console.error('[generate-video-test] Failed to insert pending generation:', insertError);
        throw new Error('Failed to create pending generation');
      }

      return NextResponse.json(
        {
          status: 'pending',
          predictionId: prediction.id,
          generationId: pendingGeneration.id,
          message: `Video generation started. Poll GET /api/generate-video/status?predictionId=${prediction.id}`,
        },
        { status: 202 }
      );
    }

    // Call Replicate API
    const generationStartTime = Date.now();
    const output = await replicate.run(model as `${string}/${string}`, {
      input: replicateInput,
    });
    const generationTime = Date.now() - generationStartTime;
    console.log('[generate-video-test] ✓ Video generation completed in', generationTime, 'ms');

    // Extract video URL from output
    let generatedVideoUrl: string;
    if (typeof output === 'string') {
      generatedVideoUrl = output;
    } else if (output && typeof output === 'object') {
      const outputObj = output as { url?: string | (() => string) };
      if ('url' in outputObj && typeof outputObj.url === 'function') {
        generatedVideoUrl = outputObj.url();
      } else if ('url' in outputObj && typeof outputObj.url === 'string') {
        generatedVideoUrl = outputObj.url;
      } else if (Array.isArray(output) && output.length > 0) {
        generatedVideoUrl = typeof output[0] === 'string' ? output[0] : String(output[0]);
      } else {
        console.error('[generate-video-test] Unexpected output format:', output);
        return NextResponse.json(
          { error: 'Unexpected output format from Replicate' },
          { status: 500 }
        );
      }
    } else {
      console.error('[generate-video-test] Unexpected output format:', output);
      return NextResponse.json(
        { error: 'Unexpected output format from Replicate' },
        { status: 500 }
      );
    }

    console.log('[generate-video-test] Generated video URL (Replicate):', generatedVideoUrl);

    // Persist to Supabase — Replicate delivery URLs expire; canvas save/load needs a stable URL (same as generate-image / generate-video).
    console.log('[generate-video-test] Downloading generated video from Replicate...');
    const downloadStartTime = Date.now();
    const videoResponse = await fetch(generatedVideoUrl);

    if (!videoResponse.ok) {
      console.error(
        '[generate-video-test] Failed to download video:',
        videoResponse.status,
        videoResponse.statusText
      );
      return NextResponse.json(
        { error: 'Failed to download generated video from Replicate' },
        { status: 500 }
      );
    }

    const videoBlob = await videoResponse.blob();
    const videoArrayBuffer = await videoBlob.arrayBuffer();
    const videoBuffer = Buffer.from(videoArrayBuffer);
    const downloadTime = Date.now() - downloadStartTime;
    console.log(
      '[generate-video-test] ✓ Video downloaded in',
      downloadTime,
      'ms, size:',
      videoBuffer.length,
      'bytes'
    );

    const contentType =
      videoBlob.type && videoBlob.type.startsWith('video/')
        ? videoBlob.type
        : videoResponse.headers.get('content-type')?.split(';')[0]?.trim() || 'video/mp4';
    const ext =
      contentType.includes('webm') ? 'webm' : contentType.includes('quicktime') ? 'mov' : 'mp4';

    console.log('[generate-video-test] Uploading generated video to Supabase...');
    const uploadStartTime = Date.now();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const generatedVideoFilename = `${timestamp}-${randomStr}.${ext}`;
    const generatedVideoStoragePath = `${user.id}/video-generations/${generatedVideoFilename}`;

    const { error: generatedVideoUploadError } = await supabase.storage
      .from('public-bucket')
      .upload(generatedVideoStoragePath, videoBuffer, {
        contentType,
        upsert: false,
      });

    if (generatedVideoUploadError) {
      console.error('[generate-video-test] Error uploading generated video:', generatedVideoUploadError);
      return NextResponse.json(
        {
          error: 'Failed to upload generated video',
          message: generatedVideoUploadError.message,
        },
        { status: 500 }
      );
    }

    const { data: generatedVideoUrlData } = supabase.storage
      .from('public-bucket')
      .getPublicUrl(generatedVideoStoragePath);

    const finalVideoUrl = generatedVideoUrlData.publicUrl;
    const uploadTime = Date.now() - uploadStartTime;
    console.log('[generate-video-test] ✓ Generated video uploaded in', uploadTime, 'ms');
    console.log('[generate-video-test] Final video URL:', finalVideoUrl);

    const saveGenerationToDatabase = async () => {
      try {
        const tool = typeof body.tool === 'string' ? body.tool : null;
        const generationData = {
          user_id: user.id,
          prompt: typeof prompt === 'string' ? prompt : null,
          supabase_storage_path: generatedVideoStoragePath,
          reference_images_supabase_storage_path: null,
          reference_videos_supabase_storage_path: null,
          model,
          type: 'video' as const,
          is_public: true,
          tool,
        };

        const { error: saveError } = await supabase.from('generations').insert(generationData);

        if (saveError) {
          console.error('[generate-video-test] Error saving generation to database:', saveError);
        }
      } catch (e) {
        console.error('[generate-video-test] Exception saving generation to database:', e);
      }
    };

    await saveGenerationToDatabase();

    // Deduct credits after successful upload (aligned with image route: charge only when we have a durable asset).
    await deductUserCredits(user.id, requiredCredits);
    console.log('[generate-video-test] ✓ Credits deducted:', requiredCredits);

    const totalTime = Date.now() - requestStartTime;
    console.log('[generate-video-test] ✓ Request completed in', totalTime, 'ms');

    return NextResponse.json({
      video: {
        url: finalVideoUrl,
        mimeType: contentType,
      },
      videoUrl: finalVideoUrl,
      model,
      creditsUsed: requiredCredits,
    });

  } catch (err) {
    console.error('[generate-video-test] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate video' },
      { status: 500 }
    );
  }
}
