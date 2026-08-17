import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isContentModerationMessage } from '@/lib/generate-image-client';

function inferImageMimeType(storagePath: string) {
  const lower = storagePath.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.avif')) return 'image/avif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'image/png';
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const predictionId = request.nextUrl.searchParams.get('predictionId')?.trim() || null;
    const generationId = request.nextUrl.searchParams.get('generationId')?.trim() || null;
    if (!predictionId && !generationId) {
      return NextResponse.json({ error: 'predictionId or generationId is required' }, { status: 400 });
    }

    const statusColumns = 'id, status, supabase_storage_path, error_message, created_at';
    let generations: Array<{
      id: string
      status: string | null
      supabase_storage_path: string | null
      error_message: string | null
      created_at: string
    }> | null = null;
    let error: { message?: string } | null = null;

    if (generationId) {
      const byId = await supabase
        .from('generations')
        .select(statusColumns)
        .eq('id', generationId)
        .eq('user_id', user.id)
        .eq('type', 'image')
        .maybeSingle();
      error = byId.error;
      generations = byId.data ? [byId.data] : [];
    } else if (predictionId) {
      const byReplicate = await supabase
        .from('generations')
        .select(statusColumns)
        .eq('replicate_prediction_id', predictionId)
        .eq('user_id', user.id)
        .eq('type', 'image')
        .order('created_at', { ascending: true });
      error = byReplicate.error;
      generations = byReplicate.data ?? [];

      if (!error && generations.length === 0) {
        const byFal = await supabase
          .from('generations')
          .select(statusColumns)
          .eq('fal_request_id', predictionId)
          .eq('user_id', user.id)
          .eq('type', 'image')
          .order('created_at', { ascending: true });
        error = byFal.error;
        generations = byFal.data ?? [];
      }
    }

    if (error) {
      console.error('[generate-image/status]', error);
      return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
    }

    if (!generations || generations.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (generationId) {
      const matchedGeneration =
        generations.find((generation) => generation.id === generationId) ?? generations[0];

      if (matchedGeneration.status === 'pending') {
        return NextResponse.json({
          status: 'pending',
          generationId: matchedGeneration.id,
        });
      }

      if (matchedGeneration.status === 'failed') {
        const errorMessage = matchedGeneration.error_message || 'Generation failed';
        const isModeration = isContentModerationMessage(errorMessage);
        return NextResponse.json({
          status: 'failed',
          generationId: matchedGeneration.id,
          error: errorMessage,
          ...(isModeration
            ? {
                errorCode: 'Content moderation',
                details:
                  'The AI model flagged this request. Try different inputs or reference images.',
              }
            : {}),
        });
      }

      if (matchedGeneration.status === 'completed' && matchedGeneration.supabase_storage_path) {
        const { data: urlData } = supabase.storage
          .from('public-bucket')
          .getPublicUrl(matchedGeneration.supabase_storage_path);

        return NextResponse.json({
          status: 'completed',
          generationId: matchedGeneration.id,
          generationIds: [matchedGeneration.id],
          image: {
            url: urlData.publicUrl,
            mimeType: inferImageMimeType(matchedGeneration.supabase_storage_path),
          },
          images: [
            {
              url: urlData.publicUrl,
              mimeType: inferImageMimeType(matchedGeneration.supabase_storage_path),
            },
          ],
        });
      }

      return NextResponse.json({
        status: matchedGeneration.status,
        generationId: matchedGeneration.id,
      });
    }

    const pendingGeneration = generations.find((generation) => generation.status === 'pending');
    if (pendingGeneration) {
      return NextResponse.json({
        status: 'pending',
        generationId: pendingGeneration.id,
      });
    }

    const completedGenerations = generations.filter(
      (generation) => generation.status === 'completed' && generation.supabase_storage_path
    );

    if (completedGenerations.length > 0) {
      const images = completedGenerations.map((generation) => {
        const { data: urlData } = supabase.storage
          .from('public-bucket')
          .getPublicUrl(generation.supabase_storage_path!);

        return {
          url: urlData.publicUrl,
          mimeType: inferImageMimeType(generation.supabase_storage_path!),
        };
      });

      return NextResponse.json({
        status: 'completed',
        generationId: completedGenerations[0].id,
        generationIds: completedGenerations.map((generation) => generation.id),
        image: images[0],
        images,
      });
    }

    const failedGeneration = generations.find((generation) => generation.status === 'failed');
    if (failedGeneration) {
      const errorMessage = failedGeneration.error_message || 'Generation failed';
      const isModeration = isContentModerationMessage(errorMessage);
      return NextResponse.json({
        status: 'failed',
        generationId: failedGeneration.id,
        error: errorMessage,
        ...(isModeration
          ? {
              errorCode: 'Content moderation',
              details:
                'The AI model flagged this request. Try different inputs or reference images.',
            }
          : {}),
      });
    }

    return NextResponse.json({
      status: generations[0].status,
      generationId: generations[0].id,
    });
  } catch (e) {
    console.error('[generate-image/status]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
