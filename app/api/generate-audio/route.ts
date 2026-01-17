import {
  experimental_generateSpeech as generateSpeech,
  NoSpeechGeneratedError,
} from 'ai';
import { elevenlabs } from '@ai-sdk/elevenlabs';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ELEVENLABS_MODELS = [
  'eleven_v3',
  'eleven_multilingual_v2',
  'eleven_flash_v2_5',
  'eleven_flash_v2',
  'eleven_turbo_v2_5',
  'eleven_turbo_v2',
] as const;

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  console.log('[generate-audio] ===== Request started =====');

  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      console.error('[generate-audio] ELEVENLABS_API_KEY not set');
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY environment variable is not set' },
        { status: 500 }
      );
    }
    console.log('[generate-audio] ✓ ELEVENLABS_API_KEY found');

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[generate-audio] Authentication failed:', authError?.message || 'No user');
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to generate audio.' },
        { status: 401 }
      );
    }
    console.log('[generate-audio] ✓ User authenticated:', { userId: user.id, email: user.email });

    const body = await request.json();
    const text = (body.text as string) ?? '';
    const voice = (body.voice as string) ?? '';
    const model = (body.model as string) || 'eleven_multilingual_v2';
    const outputFormat = (body.outputFormat as string) || 'mp3';
    const language = body.language as string | undefined;
    const speed = typeof body.speed === 'number' ? body.speed : 1.0;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'text and voice are required' },
        { status: 400 }
      );
    }
    if (!voice || typeof voice !== 'string') {
      return NextResponse.json(
        { error: 'text and voice are required' },
        { status: 400 }
      );
    }

    const ext = outputFormat === 'wav' ? 'wav' : 'mp3';
    const modelId = ELEVENLABS_MODELS.includes(model as (typeof ELEVENLABS_MODELS)[number])
      ? (model as (typeof ELEVENLABS_MODELS)[number])
      : 'eleven_multilingual_v2';

    console.log('[generate-audio] Generating speech...', {
      textLength: text.length,
      voice: voice.substring(0, 8) + '...',
      model: modelId,
      outputFormat,
    });

    const result = await generateSpeech({
      model: elevenlabs.speech(modelId),
      text,
      voice,
      outputFormat: (outputFormat === 'wav' ? 'wav' : 'mp3') as 'mp3' | 'wav',
      language,
      speed,
    });

    const audioBuffer = Buffer.from(result.audio.base64, 'base64');
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const storagePath = `${user.id}/audio-generations/${timestamp}-${randomStr}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('public-bucket')
      .upload(storagePath, audioBuffer, {
        contentType: result.audio.mediaType,
        upsert: false,
      });

    if (uploadError) {
      console.error('[generate-audio] Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload generated audio', message: uploadError.message },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from('public-bucket')
      .getPublicUrl(storagePath);
    const url = urlData.publicUrl;

    const saveGenerationToDatabase = async () => {
      try {
        const generationData = {
          user_id: user.id,
          prompt: text,
          supabase_storage_path: storagePath,
          reference_images_supabase_storage_path: null as string[] | null,
          reference_videos_supabase_storage_path: null as string[] | null,
          model: modelId,
          type: 'audio' as const,
          is_public: true,
        };
        const { data: savedData, error: saveError } = await supabase
          .from('generations')
          .insert(generationData)
          .select()
          .single();
        if (saveError) {
          console.error('[generate-audio] Error saving generation to database:', saveError);
        } else {
          console.log('[generate-audio] ✓ Generation saved to database with ID:', savedData?.id);
        }
      } catch (e) {
        console.error('[generate-audio] Exception saving generation to database:', e);
      }
    };
    await saveGenerationToDatabase();

    const totalTime = Date.now() - requestStartTime;
    console.log('[generate-audio] ===== Request completed successfully in', totalTime, 'ms =====');

    return NextResponse.json({
      audio: { url, mimeType: result.audio.mediaType },
      warnings: result.warnings ?? [],
    });
  } catch (error) {
    const totalTime = Date.now() - requestStartTime;
    console.error('[generate-audio] ===== Error after', totalTime, 'ms =====');
    console.error('[generate-audio] Error details:', error);

    if (NoSpeechGeneratedError.isInstance(error)) {
      console.error('[generate-audio] Cause:', (error as InstanceType<typeof NoSpeechGeneratedError>).cause);
      console.error('[generate-audio] Responses:', (error as InstanceType<typeof NoSpeechGeneratedError>).responses);
      return NextResponse.json(
        { error: 'Failed to generate speech', message: (error as Error).message },
        { status: 500 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Failed to generate audio', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Audio Generation API - ElevenLabs (AI SDK Speech)',
    usage: {
      method: 'POST',
      contentType: 'application/json',
      body: {
        text: 'string (required) - Text to convert to speech',
        voice: 'string (required) - ElevenLabs voice ID from Voice Library',
        model: 'string (optional) - eleven_multilingual_v2 | eleven_v3 | eleven_flash_v2_5 | eleven_flash_v2 | eleven_turbo_v2_5 | eleven_turbo_v2 (default: eleven_multilingual_v2)',
        outputFormat: 'string (optional) - "mp3" | "wav" (default: "mp3")',
        language: 'string (optional) - ISO 639-1 (e.g. "en", "es") or "auto"',
        speed: 'number (optional) - Speech speed (default: 1.0)',
      },
      response: {
        audio: { url: 'string - Public URL of the generated audio', mimeType: 'string - e.g. audio/mpeg' },
        warnings: 'array',
      },
    },
  });
}
