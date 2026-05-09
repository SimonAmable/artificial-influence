import Replicate from 'replicate';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkUserHasCredits, deductUserCreditsUpTo } from '@/lib/credits';
import {
  DEFAULT_MOTION_COPY_MODEL_IDENTIFIER,
  normalizeMotionCopyModelIdentifier,
} from '@/lib/constants/models';
import { resolveVideoPricingQuote } from '@/lib/video-pricing';

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  console.log('[generate-video] ===== Request started =====');
  
  try {
    // Check for API token
    if (!process.env.REPLICATE_API_TOKEN) {
      console.error('[generate-video] REPLICATE_API_TOKEN not set');
      return NextResponse.json(
        { error: 'REPLICATE_API_TOKEN environment variable is not set' },
        { status: 500 }
      );
    }
    console.log('[generate-video] ✓ REPLICATE_API_TOKEN found');

    // Get authenticated user
    console.log('[generate-video] Authenticating user...');
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('[generate-video] Authentication failed:', authError?.message || 'No user');
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to generate videos.' },
        { status: 401 }
      );
    }
    console.log('[generate-video] ✓ User authenticated:', { userId: user.id, email: user.email });

    // Parse JSON body (both canvas and motion copy upload client-side now)
    console.log('[generate-video] Parsing JSON body...');
    const body = await request.json();
    const imagePublicUrl = body.imageUrl as string;
    const videoPublicUrl = body.videoUrl as string;
    const imageStoragePath = body.imageStoragePath as string;
    const videoStoragePath = body.videoStoragePath as string;
    const prompt = (body.prompt as string) || '';
    const mode = (body.mode as string) || 'pro';
    const keepOriginalSound = body.keep_original_sound !== false;
    const rawCharacterOrientation = (body.character_orientation as string) || 'video';
    const characterOrientation = (rawCharacterOrientation === 'video' ? 'video' : 'image') as 'image' | 'video';
    const tool = body.tool as string | null;
    const sourceDurationSecondsRaw = body.sourceDurationSeconds as number | string | undefined;
    const sourceDurationSeconds =
      typeof sourceDurationSecondsRaw === 'number' && Number.isFinite(sourceDurationSecondsRaw)
        ? sourceDurationSecondsRaw
        : typeof sourceDurationSecondsRaw === 'string' && sourceDurationSecondsRaw.trim().length > 0
          ? Number(sourceDurationSecondsRaw)
          : null;

    console.log('[generate-video] JSON body parsed:', {
      hasImageUrl: !!imagePublicUrl,
      hasVideoUrl: !!videoPublicUrl,
      imageStoragePath: imageStoragePath || 'none',
      videoStoragePath: videoStoragePath || 'none',
      promptLength: prompt.length,
      mode,
      keepOriginalSound,
      characterOrientation,
    });

    // Validate required URLs
    if (!imagePublicUrl || typeof imagePublicUrl !== 'string') {
      console.error('[generate-video] Missing or invalid image URL');
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    if (!videoPublicUrl || typeof videoPublicUrl !== 'string') {
      console.error('[generate-video] Missing or invalid video URL');
      return NextResponse.json(
        { error: 'Video URL is required' },
        { status: 400 }
      );
    }

    console.log('[generate-video] ✓ URLs validated');
    console.log('[generate-video] ✓ Request processed successfully');

    const requestedModel = (body.model as string) || DEFAULT_MOTION_COPY_MODEL_IDENTIFIER;
    const model =
      normalizeMotionCopyModelIdentifier(requestedModel) || DEFAULT_MOTION_COPY_MODEL_IDENTIFIER;
    const { data: modelData, error: modelError } = await supabase
      .from('models')
      .select('model_cost, model_cost_per_second')
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

    const pricingQuote = resolveVideoPricingQuote({
      modelIdentifier: model,
      modelCost: modelData.model_cost,
      modelCostPerSecond: modelData.model_cost_per_second,
      mode,
      characterOrientation,
      hasInputVideo: true,
      hasReferenceVideo: true,
      sourceDurationSeconds,
    });
    const quotedCredits = pricingQuote.quotedCredits;
    const hasCredits = await checkUserHasCredits(user.id, quotedCredits, supabase);
    if (!hasCredits) {
      return NextResponse.json(
        { error: `Insufficient credits. Video generation requires ${quotedCredits} credits.` },
        { status: 402 }
      );
    }

    // Initialize Replicate client
    console.log('[generate-video] Initializing Replicate client...');
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Call Replicate API
    console.log('[generate-video] Calling Replicate API...');
    const replicateInput = {
      mode: mode as 'pro' | 'std',
      image: imagePublicUrl,
      video: videoPublicUrl,
      prompt: prompt,
      keep_original_sound: keepOriginalSound,
      character_orientation: characterOrientation,
    };

    console.log('[generate-video] Replicate input:', {
      mode: replicateInput.mode,
      imageUrl: replicateInput.image.substring(0, 50) + '...',
      videoUrl: replicateInput.video.substring(0, 50) + '...',
      promptLength: replicateInput.prompt.length,
      keepOriginalSound: replicateInput.keep_original_sound,
      characterOrientation: replicateInput.character_orientation,
    });

    const webhookBase = process.env.REPLICATE_WEBHOOK_BASE_URL?.replace(/\/$/, '');
    if (webhookBase) {
      const webhookUrl = `${webhookBase}/api/webhooks/replicate`;
      const prediction = await replicate.predictions.create({
        model: DEFAULT_MOTION_COPY_MODEL_IDENTIFIER as `${string}/${string}`,
        input: replicateInput,
        webhook: webhookUrl,
        webhook_events_filter: ['completed'],
      });

      const { data: pendingGeneration, error: insertError } = await supabase
        .from('generations')
        .insert({
          user_id: user.id,
          prompt: prompt || null,
          supabase_storage_path: null,
          reference_images_supabase_storage_path: imageStoragePath ? [imageStoragePath] : null,
          reference_videos_supabase_storage_path: videoStoragePath ? [videoStoragePath] : null,
          model,
          type: 'video',
          is_public: true,
          tool: tool || null,
          status: 'pending',
          replicate_prediction_id: prediction.id,
          quoted_credits: quotedCredits,
          predicted_duration_seconds: pricingQuote.predictedDurationSeconds,
        })
        .select('id')
        .single();

      if (insertError || !pendingGeneration) {
        console.error('[generate-video] Failed to insert pending generation:', insertError);
        throw new Error('Failed to create pending generation');
      }

      return NextResponse.json(
        {
          status: 'pending',
          predictionId: prediction.id,
          generationId: pendingGeneration.id,
          creditsQuoted: quotedCredits,
          message: `Video generation started. Poll GET /api/generate-video/status?predictionId=${prediction.id}`,
        },
        { status: 202 }
      );
    }

    const generationStartTime = Date.now();
    const output = await replicate.run(DEFAULT_MOTION_COPY_MODEL_IDENTIFIER, {
      input: replicateInput,
    });
    const generationTime = Date.now() - generationStartTime;
    console.log('[generate-video] ✓ Video generation completed in', generationTime, 'ms');

    // Handle output - Replicate returns a URL string or object with url method
    // Based on Replicate API: output.url() returns the file URL
    let generatedVideoUrl: string;
    if (typeof output === 'string') {
      generatedVideoUrl = output;
    } else if (output && typeof output === 'object') {
      // Check if output has a url method (function)
      const outputObj = output as { url?: string | (() => string) };
      if ('url' in outputObj && typeof outputObj.url === 'function') {
        generatedVideoUrl = outputObj.url();
      } else if ('url' in outputObj && typeof outputObj.url === 'string') {
        generatedVideoUrl = outputObj.url;
      } else {
        // Try to get the first value if it's an array
        if (Array.isArray(output) && output.length > 0) {
          generatedVideoUrl = typeof output[0] === 'string' ? output[0] : String(output[0]);
        } else {
          console.error('[generate-video] Unexpected output format:', output);
          return NextResponse.json(
            { error: 'Unexpected output format from Replicate' },
            { status: 500 }
          );
        }
      }
    } else {
      console.error('[generate-video] Unexpected output format:', output);
      return NextResponse.json(
        { error: 'Unexpected output format from Replicate' },
        { status: 500 }
      );
    }

    console.log('[generate-video] Generated video URL from Replicate:', generatedVideoUrl);

    // Download video from Replicate
    console.log('[generate-video] Downloading generated video from Replicate...');
    const downloadStartTime = Date.now();
    const videoResponse = await fetch(generatedVideoUrl);
    
    if (!videoResponse.ok) {
      console.error('[generate-video] Failed to download video:', videoResponse.status, videoResponse.statusText);
      return NextResponse.json(
        { error: 'Failed to download generated video from Replicate' },
        { status: 500 }
      );
    }

    const videoBlob = await videoResponse.blob();
    const videoArrayBuffer = await videoBlob.arrayBuffer();
    const videoBuffer = Buffer.from(videoArrayBuffer);
    const downloadTime = Date.now() - downloadStartTime;
    console.log('[generate-video] ✓ Video downloaded in', downloadTime, 'ms, size:', videoBuffer.length, 'bytes');

    // Upload generated video to Supabase
    console.log('[generate-video] Uploading generated video to Supabase...');
    const uploadStartTime = Date.now();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const generatedVideoFilename = `${timestamp}-${randomStr}.mp4`;
    const generatedVideoStoragePath = `${user.id}/video-generations/${generatedVideoFilename}`;

    const { error: generatedVideoUploadError } = await supabase.storage
      .from('public-bucket')
      .upload(generatedVideoStoragePath, videoBuffer, {
        contentType: 'video/mp4',
        upsert: false,
      });

    if (generatedVideoUploadError) {
      console.error('[generate-video] Error uploading generated video:', generatedVideoUploadError);
      return NextResponse.json(
        { error: 'Failed to upload generated video', message: generatedVideoUploadError.message },
        { status: 500 }
      );
    }

    const { data: generatedVideoUrlData } = supabase.storage
      .from('public-bucket')
      .getPublicUrl(generatedVideoStoragePath);

    const finalVideoUrl = generatedVideoUrlData.publicUrl;
    const uploadTime = Date.now() - uploadStartTime;
    console.log('[generate-video] ✓ Generated video uploaded in', uploadTime, 'ms');
    console.log('[generate-video] Final video URL:', finalVideoUrl);

    // Save generation to database
    const saveGenerationToDatabase = async () => {
      try {
        console.log('[generate-video] Saving generation to database...');
        
        const generationData = {
          user_id: user.id,
          prompt: prompt,
          supabase_storage_path: generatedVideoStoragePath,
          reference_images_supabase_storage_path: imageStoragePath ? [imageStoragePath] : null,
          reference_videos_supabase_storage_path: videoStoragePath ? [videoStoragePath] : null,
          model: model,
          type: 'video',
          is_public: true,
          tool: tool || null,
          quoted_credits: quotedCredits,
          predicted_duration_seconds: pricingQuote.predictedDurationSeconds,
        };

        const { data: savedData, error: saveError } = await supabase
          .from('generations')
          .insert(generationData)
          .select()
          .single();

        if (saveError) {
          console.error('[generate-video] Error saving generation to database:', saveError);
          // Don't throw - we don't want to fail the request if database save fails
        } else {
          console.log('[generate-video] ✓ Generation saved to database with ID:', savedData?.id);
        }
      } catch (error) {
        console.error('[generate-video] Exception saving generation to database:', error);
        // Don't throw - we don't want to fail the request if database save fails
      }
    };

    await saveGenerationToDatabase();
    const chargedCredits = await deductUserCreditsUpTo(user.id, quotedCredits, supabase);

    const totalTime = Date.now() - requestStartTime;
    console.log('[generate-video] ===== Request completed successfully in', totalTime, 'ms =====');

    return NextResponse.json({
      video: {
        url: finalVideoUrl,
        mimeType: 'video/mp4',
      },
      creditsQuoted: quotedCredits,
      creditsUsed: chargedCredits,
    });
  } catch (error) {
    const totalTime = Date.now() - requestStartTime;
    console.error('[generate-video] ===== Error occurred after', totalTime, 'ms =====');
    console.error('[generate-video] Error details:', error);
    
    if (error instanceof Error) {
      console.error('[generate-video] Error message:', error.message);
      console.error('[generate-video] Error stack:', error.stack);
      return NextResponse.json(
        { 
          error: 'Failed to generate video',
          message: error.message 
        },
        { status: 500 }
      );
    }

    console.error('[generate-video] Unknown error type:', typeof error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET method for API documentation
export async function GET() {
  return NextResponse.json({
    message: 'Video Generation API - Kling 3.0 Motion Control',
    models: [DEFAULT_MOTION_COPY_MODEL_IDENTIFIER],
    usage: {
      method: 'POST',
      contentType: 'application/json',
      body: {
        imageUrl: 'string (required) - Public URL of reference image (uploaded to Supabase)',
        videoUrl: 'string (required) - Public URL of reference video (uploaded to Supabase)',
        imageStoragePath: 'string (required) - Supabase storage path for image',
        videoStoragePath: 'string (required) - Supabase storage path for video',
        prompt: 'string (optional) - Text prompt (can be empty)',
        mode: 'string (optional) - Model variant: "pro" or "std" (default: "pro")',
        keep_original_sound: 'boolean (optional) - Keep original audio (default: true)',
        character_orientation: 'string (optional) - Character orientation (default: "video")',
      },
      response: {
        video: {
          url: 'string - Public URL of the generated video',
          mimeType: 'string - MIME type (video/mp4)',
        },
      },
    },
  });
}
