import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { inferStoragePathFromUrl } from '@/lib/uploads/storage-ref';
import {
  DEFAULT_UPSCALE_CREDITS_COST,
  normalizeUpscaleModelIdentifier,
  runImageUpscale,
  type UpscaleRunParameters,
} from '@/lib/server/upscale-image';

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  console.log('[upscale] ===== Request started =====');

  try {
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
    let parameters: UpscaleRunParameters = {};
    let modelIdentifier: string | undefined;
    let referenceImageStoragePaths: string[] | null = null;

    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      mediaUrl = (body.media ?? body.imageUrl) ?? '';
      if (typeof body.modelIdentifier === 'string' && body.modelIdentifier.trim()) {
        modelIdentifier = normalizeUpscaleModelIdentifier(body.modelIdentifier);
      }
      if (body.parameters && typeof body.parameters === 'object' && !Array.isArray(body.parameters)) {
        parameters = body.parameters as UpscaleRunParameters;
      }
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const imageFile = formData.get('image') as File | null;
      const paramsRaw = formData.get('parameters');
      const modelRaw = formData.get('modelIdentifier');

      if (!imageFile || !(imageFile instanceof File)) {
        return NextResponse.json(
          { error: 'Missing or invalid "image" file in FormData.' },
          { status: 400 }
        );
      }

      if (typeof modelRaw === 'string' && modelRaw.trim()) {
        modelIdentifier = normalizeUpscaleModelIdentifier(modelRaw);
      }

      if (paramsRaw && typeof paramsRaw === 'string') {
        try {
          const parsed = JSON.parse(paramsRaw) as UpscaleRunParameters;
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
      referenceImageStoragePaths = [storagePath];
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

    if (!referenceImageStoragePaths) {
      const inferredPath = inferStoragePathFromUrl(mediaUrl);
      if (inferredPath) {
        referenceImageStoragePaths = [inferredPath];
      } else {
        try {
          const sourceRes = await fetch(mediaUrl);
          if (sourceRes.ok) {
            const buffer = Buffer.from(await sourceRes.arrayBuffer());
            const timestamp = Date.now();
            const storagePath = `${user.id}/upscale-inputs/${timestamp}-reference.png`;
            const { error: refUploadError } = await supabase.storage
              .from('public-bucket')
              .upload(storagePath, buffer, {
                contentType: sourceRes.headers.get('content-type') || 'image/png',
                upsert: false,
              });
            if (!refUploadError) {
              referenceImageStoragePaths = [storagePath];
            }
          }
        } catch (refErr) {
          console.warn('[upscale] Could not persist reference image path:', refErr);
        }
      }
    }

    const result = await runImageUpscale({
      supabase,
      userId: user.id,
      imageUrl: mediaUrl,
      modelIdentifier,
      parameters,
      tool: 'upscale',
      referenceImageStoragePaths,
    });

    const totalTime = Date.now() - requestStartTime;
    console.log('[upscale] ✓ Request completed in', totalTime, 'ms');

    return NextResponse.json({
      imageUrl: result.imageUrl,
      generationId: result.generationId,
      creditsUsed: result.creditsUsed ?? DEFAULT_UPSCALE_CREDITS_COST,
      sourceImageUrl: mediaUrl,
    });
  } catch (err) {
    console.error('[upscale] Error:', err);
    const message = err instanceof Error ? err.message : 'Upscale failed';
    const status =
      message.includes('Insufficient credits') ? 402 : message.includes('REPLICATE_API_TOKEN') ? 500 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
