import Replicate from 'replicate';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkUserHasCredits, deductUserCredits } from '@/lib/credits';

/** Model slug stored on generations / shown in history. */
const REMOVE_BG_MODEL_ID = 'fottoai/remove-bg-2';
/**
 * Pin a version — `replicate.run("owner/name")` hits `/v1/models/.../predictions`,
 * which 404s for this model. Versioned runs use `/v1/predictions` and work.
 */
const REMOVE_BG_MODEL_VERSION =
  'fottoai/remove-bg-2:d748bcc6882e5567ffe1468356323e6345736494dd9b827ff2871a68fca79be5';
const CREDITS_COST = 1;
const USER_FACING_FAILURE = 'Remove background failed. Please try again.';

function coerceUrl(value: unknown): string | null {
  if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
    return value;
  }
  if (value instanceof URL) {
    return value.href;
  }
  return null;
}

function extractOutputUrl(output: unknown): string | null {
  const asUrl = coerceUrl(output);
  if (asUrl) return asUrl;

  if (output && typeof output === 'object') {
    const obj = output as { url?: unknown };
    if (typeof obj.url === 'function') {
      return coerceUrl(obj.url());
    }
    return coerceUrl(obj.url);
  }
  if (Array.isArray(output) && output.length > 0) {
    return extractOutputUrl(output[0]);
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      console.error('[remove-background] REPLICATE_API_TOKEN is not set');
      return NextResponse.json({ error: USER_FACING_FAILURE }, { status: 500 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Please log in to remove background.' },
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
          { error: 'Please provide an image to remove the background from.' },
          { status: 400 }
        );
      }
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const imageFile = formData.get('image') as File | null;
      if (!imageFile || !(imageFile instanceof File)) {
        return NextResponse.json(
          { error: 'Please provide an image to remove the background from.' },
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
        console.error('[remove-background] Upload failed:', uploadError.message);
        return NextResponse.json({ error: USER_FACING_FAILURE }, { status: 500 });
      }
      const { data: urlData } = supabase.storage.from('public-bucket').getPublicUrl(storagePath);
      imageUrl = urlData.publicUrl;
    } else {
      return NextResponse.json(
        { error: 'Please provide an image to remove the background from.' },
        { status: 400 }
      );
    }

    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
    const output = await replicate.run(
      REMOVE_BG_MODEL_VERSION as `${string}/${string}:${string}`,
      {
        input: {
          image_url: imageUrl,
        },
      },
    );

    const outputUrl = extractOutputUrl(output);
    if (!outputUrl) {
      console.error('[remove-background] Unexpected output shape:', output);
      return NextResponse.json({ error: USER_FACING_FAILURE }, { status: 500 });
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
    return NextResponse.json({ error: USER_FACING_FAILURE }, { status: 500 });
  }
}
