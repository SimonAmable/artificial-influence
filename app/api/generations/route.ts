import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as 'image' | 'video' | 'audio' | null;
    const tool = searchParams.get('tool');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    let query = supabase
      .from('generations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by type if provided
    if (type) {
      query = query.eq('type', type);
    }

    // Filter by tool if provided
    if (tool) {
      query = query.eq('tool', tool);
    }

    // Exclude pending (async Replicate) so list only shows completed/failed with results
    query = query.neq('status', 'pending');

    const { data: generations, error } = await query;

    if (error) {
      console.error('[generations] Error fetching generations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch generations', message: error.message },
        { status: 500 }
      );
    }

    // Get public URLs for each generation (skip pending or missing path)
    const generationsWithUrls = (generations || []).map((generation) => {
      const path = generation.supabase_storage_path;
      const url =
        path != null && path !== ''
          ? supabase.storage.from('public-bucket').getPublicUrl(path).data.publicUrl
          : null;

      const referencePaths = (generation.reference_images_supabase_storage_path as string[] | null) ?? [];
      const reference_image_urls = referencePaths
        .filter((p): p is string => typeof p === 'string' && p.length > 0)
        .map((p) => supabase.storage.from('public-bucket').getPublicUrl(p).data.publicUrl);

      return {
        ...generation,
        tool: generation.tool ?? null,
        url,
        reference_image_urls,
      };
    });

    return NextResponse.json({
      generations: generationsWithUrls,
    });
  } catch (error) {
    console.error('[generations] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
