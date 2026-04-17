import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tryCompleteFalPendingImage } from '@/lib/server/fal-image-completion';

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

    const predictionId = request.nextUrl.searchParams.get('predictionId');
    if (!predictionId) {
      return NextResponse.json({ error: 'predictionId is required' }, { status: 400 });
    }

    const { data: generationsInitial, error } = await supabase
      .from('generations')
      .select('id, status, supabase_storage_path, error_message, created_at')
      .eq('replicate_prediction_id', predictionId)
      .eq('user_id', user.id)
      .eq('type', 'image')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[generate-image/status]', error);
      return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
    }

    let generations = generationsInitial;

    if (!generations || generations.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (generations.some((g) => g.status === 'pending')) {
      await tryCompleteFalPendingImage(supabase, user.id, predictionId);
      const { data: refreshed, error: refreshError } = await supabase
        .from('generations')
        .select('id, status, supabase_storage_path, error_message, created_at')
        .eq('replicate_prediction_id', predictionId)
        .eq('user_id', user.id)
        .eq('type', 'image')
        .order('created_at', { ascending: true });
      if (!refreshError && refreshed && refreshed.length > 0) {
        generations = refreshed;
      }
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
        image: images[0],
        images,
      });
    }

    const failedGeneration = generations.find((generation) => generation.status === 'failed');
    if (failedGeneration) {
      return NextResponse.json({
        status: 'failed',
        generationId: failedGeneration.id,
        error: failedGeneration.error_message || 'Generation failed',
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
