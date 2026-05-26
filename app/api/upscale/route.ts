import Replicate from 'replicate';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkUserHasCredits, deductUserCredits } from '@/lib/credits';

// Pin to a version hash to avoid 404s (Replicate v1 can 404 for owner/name on some community models)
// https://replicate.com/prunaai/p-image-upscale
const UPSCALE_MODEL_ID =
  'prunaai/p-image-upscale:ea74e255330ec5a0a6aa394e7e1451a8cea94fe1edb8266cc4848eab047a74c4';
const UPSCALE_MODEL_IDENTIFIER_FALLBACK = 'prunaai/p-image-upscale';
const UPSCALE_CREDITS_COST = 1;

const DEFAULT_UPSCALE_INPUT: Record<string, unknown> = {
  upscale_mode: 'target',
  target: 4,
  enhance_realism: true,
  output_format: 'png',
  disable_safety_checker: true,
};

async function findActiveUpscaleModel(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: pinned, error: pinnedError } = await supabase
    .from('models')
    .select('id, name, model_cost')
    .eq('identifier', UPSCALE_MODEL_ID)
    .eq('is_active', true)
    .maybeSingle();

  if (!pinnedError && pinned) return pinned;

  const { data: fallback, error: fallbackError } = await supabase
    .from('models')
    .select('id, name, model_cost')
    .eq('identifier', UPSCALE_MODEL_IDENTIFIER_FALLBACK)
    .eq('is_active', true)
    .maybeSingle();

  if (!fallbackError && fallback) return fallback;

  return null;
}

function extractOutputUrl(output: unknown): string | null {
  if (typeof output === 'string' && (output.startsWith('http://') || output.startsWith('https://'))) {
    return output;
  }
  if (output && typeof output === 'object') {
    const obj = output as { url?: string | (() => string) };
    if (typeof obj.url === 'function') return obj.url();
    if (typeof obj.url === 'string') return obj.url;
  }
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    return typeof first === 'string' ? first : extractOutputUrl(first);
  }
  return null;
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  console.log('[upscale] ===== Request started =====');

  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      console.error('[upscale] REPLICATE_API_TOKEN not set');
      return NextResponse.json(
        { error: 'REPLICATE_API_TOKEN environment variable is not set' },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[upscale] Authentication failed:', authError?.message || 'No user');
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to use upscale.' },
        { status: 401 }
      );
    }
    console.log('[upscale] ✓ User authenticated:', { userId: user.id });

    let mediaUrl: string;
    let parameters: Record<string, unknown> = {};

    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      mediaUrl = (body.media ?? body.imageUrl) ?? '';
      if (body.parameters && typeof body.parameters === 'object' && !Array.isArray(body.parameters)) {
        parameters = body.parameters as Record<string, unknown>;
      }
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const imageFile = formData.get('image') as File | null;
      const paramsRaw = formData.get('parameters');

      if (!imageFile || !(imageFile instanceof File)) {
        return NextResponse.json(
          { error: 'Missing or invalid "image" file in FormData.' },
          { status: 400 }
        );
      }

      if (paramsRaw && typeof paramsRaw === 'string') {
        try {
          const parsed = JSON.parse(paramsRaw) as Record<string, unknown>;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            parameters = parsed;
          }
        } catch {
          // ignore invalid JSON
        }
      }

      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const timestamp = Date.now();
      const ext = imageFile.name?.split('.').pop() || 'png';
      const safeName = (imageFile.name || 'image').replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${user.id}/upscale-inputs/${timestamp}-${safeName}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('public-bucket')
        .upload(storagePath, buffer, {
          contentType: imageFile.type || `image/${ext}`,
          upsert: false,
        });

      if (uploadError) {
        console.error('[upscale] Upload error:', uploadError);
        return NextResponse.json(
          { error: 'Failed to upload image.', message: uploadError.message },
          { status: 500 }
        );
      }

      const { data: urlData } = supabase.storage.from('public-bucket').getPublicUrl(storagePath);
      mediaUrl = urlData.publicUrl;
      console.log('[upscale] ✓ Image uploaded, media URL ready');
    } else {
      return NextResponse.json(
        { error: 'Content-Type must be application/json or multipart/form-data.' },
        { status: 400 }
      );
    }

    mediaUrl = (mediaUrl ?? '').trim();
    if (!mediaUrl) {
      return NextResponse.json(
        { error: 'Missing "media" or "imageUrl" (JSON), or "image" file (FormData).' },
        { status: 400 }
      );
    }

    const modelData = await findActiveUpscaleModel(supabase);

    if (!modelData) {
      console.warn(
        '[upscale] Model row not found for',
        UPSCALE_MODEL_ID,
        'or',
        UPSCALE_MODEL_IDENTIFIER_FALLBACK,
        '— continuing with pinned Replicate model. Apply migration 20260526120000_switch_upscale_to_p_image_upscale.sql.',
      );
    }

    const hasCredits = await checkUserHasCredits(user.id, UPSCALE_CREDITS_COST);
    if (!hasCredits) {
      return NextResponse.json(
        {
          error: 'Insufficient credits.',
          message: `Upscale requires ${UPSCALE_CREDITS_COST} credit.`,
        },
        { status: 402 }
      );
    }

    const replicateInput: Record<string, unknown> = {
      ...DEFAULT_UPSCALE_INPUT,
      image: mediaUrl,
      ...parameters,
      disable_safety_checker: true,
    };

    console.log('[upscale] Replicate input keys:', Object.keys(replicateInput));

    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
    const generationStartTime = Date.now();
    const output = await replicate.run(UPSCALE_MODEL_ID as `${string}/${string}`, {
      input: replicateInput,
    });
    const generationTime = Date.now() - generationStartTime;
    console.log('[upscale] ✓ Replicate run completed in', generationTime, 'ms');

    const outputUrl = extractOutputUrl(output);
    if (!outputUrl) {
      console.error('[upscale] No output URL from Replicate:', output);
      return NextResponse.json(
        { error: 'Unexpected output from upscale model.' },
        { status: 500 }
      );
    }

    // Persist to storage (Replicate URLs expire) and save to generations for history.
    let savedUrl = outputUrl;
    let savedStoragePath: string | null = null;
    let generationId: string | null = null;

    try {
      const imageRes = await fetch(outputUrl);
      if (imageRes.ok) {
        const buffer = Buffer.from(await imageRes.arrayBuffer());
        const timestamp = Date.now();
        const storagePath = `${user.id}/upscale-outputs/${timestamp}.png`;
        const { error: saveError } = await supabase.storage
          .from('public-bucket')
          .upload(storagePath, buffer, {
            contentType: 'image/png',
            upsert: false,
          });

        if (!saveError) {
          savedStoragePath = storagePath;
          const { data: savedData } = supabase.storage
            .from('public-bucket')
            .getPublicUrl(storagePath);
          savedUrl = savedData.publicUrl;
        }
      }
    } catch (saveErr) {
      console.warn('[upscale] Save to storage failed, returning Replicate URL:', saveErr);
    }

    if (savedStoragePath) {
      try {
        const { data: generationRow, error: genError } = await supabase
          .from('generations')
          .insert({
            user_id: user.id,
            prompt: null,
            supabase_storage_path: savedStoragePath,
            reference_images_supabase_storage_path: null,
            model: UPSCALE_MODEL_IDENTIFIER_FALLBACK,
            type: 'image',
            is_public: true,
            tool: 'upscale',
            status: 'completed',
            error_message: null,
          })
          .select('id')
          .single();

        if (genError) {
          console.warn('[upscale] Failed to save to generations table:', genError);
        } else if (generationRow?.id) {
          generationId = generationRow.id;
        }
      } catch (genErr) {
        console.warn('[upscale] Exception saving to generations table:', genErr);
      }
    }

    await deductUserCredits(user.id, UPSCALE_CREDITS_COST);
    console.log('[upscale] ✓ Credits deducted:', UPSCALE_CREDITS_COST);

    const totalTime = Date.now() - requestStartTime;
    console.log('[upscale] ✓ Request completed in', totalTime, 'ms');

    return NextResponse.json({
      imageUrl: savedUrl,
      generationId,
      creditsUsed: UPSCALE_CREDITS_COST,
    });
  } catch (err) {
    console.error('[upscale] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upscale failed' },
      { status: 500 }
    );
  }
}
