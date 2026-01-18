import Replicate from 'replicate';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  console.log('[generate-lipsync] ===== Request started =====');
  
  try {
    // Check for API token
    if (!process.env.REPLICATE_API_TOKEN) {
      console.error('[generate-lipsync] REPLICATE_API_TOKEN not set');
      return NextResponse.json(
        { error: 'REPLICATE_API_TOKEN environment variable is not set' },
        { status: 500 }
      );
    }
    console.log('[generate-lipsync] ✓ REPLICATE_API_TOKEN found');

    // Get authenticated user
    console.log('[generate-lipsync] Authenticating user...');
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('[generate-lipsync] Authentication failed:', authError?.message || 'No user');
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to generate lipsync videos.' },
        { status: 401 }
      );
    }
    console.log('[generate-lipsync] ✓ User authenticated:', { userId: user.id, email: user.email });

    // Parse JSON body (files are already uploaded to Supabase by client)
    console.log('[generate-lipsync] Parsing request body...');
    const body = await request.json();
    const imagePublicUrl = body.imageUrl as string;
    const audioPublicUrl = body.audioUrl as string;
    const imageStoragePath = body.imageStoragePath as string;
    const audioStoragePath = body.audioStoragePath as string;
    const resolution = (body.resolution as string) || '720p';

    console.log('[generate-lipsync] Request body parsed:', {
      hasImageUrl: !!imagePublicUrl,
      hasAudioUrl: !!audioPublicUrl,
      imageStoragePath: imageStoragePath || 'none',
      audioStoragePath: audioStoragePath || 'none',
      resolution,
    });

    // Validate required URLs
    if (!imagePublicUrl || typeof imagePublicUrl !== 'string') {
      console.error('[generate-lipsync] Missing or invalid image URL');
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    if (!audioPublicUrl || typeof audioPublicUrl !== 'string') {
      console.error('[generate-lipsync] Missing or invalid audio URL');
      return NextResponse.json(
        { error: 'Audio URL is required' },
        { status: 400 }
      );
    }

    // Validate resolution
    if (resolution !== '720p' && resolution !== '480p') {
      console.error('[generate-lipsync] Invalid resolution:', resolution);
      return NextResponse.json(
        { error: 'Resolution must be "720p" or "480p"' },
        { status: 400 }
      );
    }

    console.log('[generate-lipsync] ✓ URLs validated');

    // Initialize Replicate client
    console.log('[generate-lipsync] Initializing Replicate client...');
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Call Replicate API
    console.log('[generate-lipsync] Calling Replicate API...');
    const replicateInput = {
      audio: audioPublicUrl,
      image: imagePublicUrl,
      resolution: resolution as '720p' | '480p',
    };

    console.log('[generate-lipsync] Replicate input:', {
      imageUrl: replicateInput.image.substring(0, 50) + '...',
      audioUrl: replicateInput.audio.substring(0, 50) + '...',
      resolution: replicateInput.resolution,
    });

    const generationStartTime = Date.now();
    const output = await replicate.run('veed/fabric-1.0', {
      input: replicateInput,
    });
    const generationTime = Date.now() - generationStartTime;
    console.log('[generate-lipsync] ✓ Video generation completed in', generationTime, 'ms');

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
          console.error('[generate-lipsync] Unexpected output format:', output);
          return NextResponse.json(
            { error: 'Unexpected output format from Replicate' },
            { status: 500 }
          );
        }
      }
    } else {
      console.error('[generate-lipsync] Unexpected output format:', output);
      return NextResponse.json(
        { error: 'Unexpected output format from Replicate' },
        { status: 500 }
      );
    }

    console.log('[generate-lipsync] Generated video URL from Replicate:', generatedVideoUrl);

    // Download video from Replicate
    console.log('[generate-lipsync] Downloading generated video from Replicate...');
    const downloadStartTime = Date.now();
    const videoResponse = await fetch(generatedVideoUrl);
    
    if (!videoResponse.ok) {
      console.error('[generate-lipsync] Failed to download video:', videoResponse.status, videoResponse.statusText);
      return NextResponse.json(
        { error: 'Failed to download generated video from Replicate' },
        { status: 500 }
      );
    }

    const videoBlob = await videoResponse.blob();
    const videoArrayBuffer = await videoBlob.arrayBuffer();
    const videoBuffer = Buffer.from(videoArrayBuffer);
    const downloadTime = Date.now() - downloadStartTime;
    console.log('[generate-lipsync] ✓ Video downloaded in', downloadTime, 'ms, size:', videoBuffer.length, 'bytes');

    // Upload generated video to Supabase
    console.log('[generate-lipsync] Uploading generated video to Supabase...');
    const uploadStartTime = Date.now();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const generatedVideoFilename = `${timestamp}-${randomStr}.mp4`;
    const generatedVideoStoragePath = `${user.id}/lipsync-generations/${generatedVideoFilename}`;

    const { error: generatedVideoUploadError } = await supabase.storage
      .from('public-bucket')
      .upload(generatedVideoStoragePath, videoBuffer, {
        contentType: 'video/mp4',
        upsert: false,
      });

    if (generatedVideoUploadError) {
      console.error('[generate-lipsync] Error uploading generated video:', generatedVideoUploadError);
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
    console.log('[generate-lipsync] ✓ Generated video uploaded in', uploadTime, 'ms');
    console.log('[generate-lipsync] Final video URL:', finalVideoUrl);

    // Save generation to database
    const saveGenerationToDatabase = async () => {
      try {
        console.log('[generate-lipsync] Saving generation to database...');
        
        const generationData = {
          user_id: user.id,
          prompt: null, // Lipsync doesn't use a text prompt
          supabase_storage_path: generatedVideoStoragePath,
          reference_images_supabase_storage_path: imageStoragePath ? [imageStoragePath] : null,
          reference_videos_supabase_storage_path: null, // Audio is not a video reference
          model: 'veed/fabric-1.0',
          type: 'video',
          is_public: true,
        };

        const { data: savedData, error: saveError } = await supabase
          .from('generations')
          .insert(generationData)
          .select()
          .single();

        if (saveError) {
          console.error('[generate-lipsync] Error saving generation to database:', saveError);
          // Don't throw - we don't want to fail the request if database save fails
        } else {
          console.log('[generate-lipsync] ✓ Generation saved to database with ID:', savedData?.id);
        }
      } catch (error) {
        console.error('[generate-lipsync] Exception saving generation to database:', error);
        // Don't throw - we don't want to fail the request if database save fails
      }
    };

    await saveGenerationToDatabase();

    const totalTime = Date.now() - requestStartTime;
    console.log('[generate-lipsync] ===== Request completed successfully in', totalTime, 'ms =====');

    return NextResponse.json({
      video: {
        url: finalVideoUrl,
        mimeType: 'video/mp4',
      },
    });
  } catch (error) {
    const totalTime = Date.now() - requestStartTime;
    console.error('[generate-lipsync] ===== Error occurred after', totalTime, 'ms =====');
    console.error('[generate-lipsync] Error details:', error);
    
    if (error instanceof Error) {
      console.error('[generate-lipsync] Error message:', error.message);
      console.error('[generate-lipsync] Error stack:', error.stack);
      return NextResponse.json(
        { 
          error: 'Failed to generate lipsync video',
          message: error.message 
        },
        { status: 500 }
      );
    }

    console.error('[generate-lipsync] Unknown error type:', typeof error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET method for API documentation
export async function GET() {
  return NextResponse.json({
    message: 'Lip Sync Generation API - VEED Fabric 1.0',
    model: 'veed/fabric-1.0',
    usage: {
      method: 'POST',
      contentType: 'application/json',
      body: {
        imageUrl: 'string (required) - Public URL of reference image (uploaded to Supabase)',
        audioUrl: 'string (required) - Public URL of audio file (uploaded to Supabase)',
        imageStoragePath: 'string (required) - Supabase storage path for image',
        audioStoragePath: 'string (required) - Supabase storage path for audio',
        resolution: 'string (optional) - Output resolution: "720p" or "480p" (default: "720p")',
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
