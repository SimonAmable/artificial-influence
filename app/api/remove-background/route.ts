import Replicate from 'replicate';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkUserHasCredits, deductUserCredits } from '@/lib/credits';

const REMOVE_BG_MODEL_ID =
  '851-labs/background-remover:a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc';
const CREDITS_COST = 1;

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
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { error: 'REPLICATE_API_TOKEN environment variable is not set' },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to remove background.' },
        { status: 401 }
      );
    }

    const hasCredits = await checkUserHasCredits(user.id, CREDITS_COST);
    if (!hasCredits) {
      return NextResponse.json(
        {
          error: 'Insufficient credits.',
          message: `Remove background requires ${CREDITS_COST} credit.`,
        },
        { status: 402 }
      );
    }

    let imageUrl: string;
    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      imageUrl = (body.imageUrl ?? body.image ?? body.media ?? '')?.trim() ?? '';
      if (!imageUrl) {
        return NextResponse.json(
          { error: 'Missing "imageUrl", "image", or "media" in JSON body.' },
          { status: 400 }
        );
      }
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const imageFile = formData.get('image') as File | null;
      if (!imageFile || !(imageFile instanceof File)) {
        return NextResponse.json(
          { error: 'Missing or invalid "image" file in FormData.' },
          { status: 400 }
        );
      }
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const timestamp = Date.now();
      const ext = imageFile.name?.split('.').pop() || 'png';
      const safeName = (imageFile.name || 'image').replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${user.id}/remove-bg-inputs/${timestamp}-${safeName}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('public-bucket')
        .upload(storagePath, buffer, {
          contentType: imageFile.type || `image/${ext}`,
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: 'Failed to upload image.', message: uploadError.message },
          { status: 500 }
        );
      }
      const { data: urlData } = supabase.storage.from('public-bucket').getPublicUrl(storagePath);
      imageUrl = urlData.publicUrl;
    } else {
      return NextResponse.json(
        { error: 'Content-Type must be application/json or multipart/form-data.' },
        { status: 400 }
      );
    }

    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
    const output = await replicate.run(REMOVE_BG_MODEL_ID as `${string}/${string}`, {
      input: {
        image: imageUrl,
        format: 'png',
        reverse: false,
        threshold: 0,
        background_type: 'rgba',
      },
    });

    const outputUrl = extractOutputUrl(output);
    if (!outputUrl) {
      return NextResponse.json(
        { error: 'Unexpected output from background remover.' },
        { status: 500 }
      );
    }

    // Save result to storage so URL is permanent (Replicate URLs can expire)
    let savedUrl = outputUrl;
    let savedStoragePath: string | null = null;
    try {
      const imageRes = await fetch(outputUrl);
      if (imageRes.ok) {
        const buffer = Buffer.from(await imageRes.arrayBuffer());
        const timestamp = Date.now();
        const storagePath = `${user.id}/remove-bg-outputs/${timestamp}.png`;
        const { error: saveError } = await supabase.storage
          .from('public-bucket')
          .upload(storagePath, buffer, {
            contentType: 'image/png',
            upsert: false,
          });
        if (!saveError) {
          savedStoragePath = storagePath;
          const { data: savedData } = supabase.storage.from('public-bucket').getPublicUrl(storagePath);
          savedUrl = savedData.publicUrl;
        }
      }
    } catch (saveErr) {
      console.warn('[remove-background] Save to storage failed, returning Replicate URL:', saveErr);
    }

    // Save to generations table
    if (savedStoragePath) {
      try {
        const { error: genError } = await supabase.from('generations').insert({
          user_id: user.id,
          prompt: 'Background removed',
          supabase_storage_path: savedStoragePath,
          reference_images_supabase_storage_path: null,
          model: REMOVE_BG_MODEL_ID,
          type: 'image',
          is_public: true,
          tool: 'remove-background',
        });
        if (genError) {
          console.warn('[remove-background] Failed to save to generations table:', genError);
        }
      } catch (genErr) {
        console.warn('[remove-background] Exception saving to generations table:', genErr);
      }
    }

    await deductUserCredits(user.id, CREDITS_COST);

    return NextResponse.json({
      imageUrl: savedUrl,
      creditsUsed: CREDITS_COST,
    });
  } catch (err) {
    console.error('[remove-background] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Remove background failed' },
      { status: 500 }
    );
  }
}
