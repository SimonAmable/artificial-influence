import Replicate from 'replicate';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkUserHasCredits, deductUserCredits } from '@/lib/credits';

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

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Check credits (10 credits for video generation)
    const requiredCredits = 10;
    const hasCredits = await checkUserHasCredits(user.id, requiredCredits);
    if (!hasCredits) {
      return NextResponse.json(
        { error: 'Insufficient credits. Video generation requires 10 credits.' },
        { status: 402 }
      );
    }

    // Initialize Replicate client
    console.log('[generate-video-test] Initializing Replicate client...');
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Build input based on model
    const replicateInput: Record<string, unknown> = {
      prompt,
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

      case 'kwaivgi/kling-v2.6-motion-control':
        if (image) replicateInput.image = image;
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

    console.log('[generate-video-test] Generated video URL:', generatedVideoUrl);

    // Deduct credits after successful generation
    await deductUserCredits(user.id, requiredCredits);
    console.log('[generate-video-test] ✓ Credits deducted:', requiredCredits);

    const totalTime = Date.now() - requestStartTime;
    console.log('[generate-video-test] ✓ Request completed in', totalTime, 'ms');

    return NextResponse.json({
      videoUrl: generatedVideoUrl,
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
