import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;

function parseLimit(rawLimit: string | null) {
  const parsed = Number.parseInt(rawLimit ?? String(DEFAULT_LIMIT), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function parseOffset(rawOffset: string | null) {
  const parsed = Number.parseInt(rawOffset ?? '0', 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

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
    const limit = parseLimit(searchParams.get('limit'));
    const offset = parseOffset(searchParams.get('offset'));
    const includePending = searchParams.get('includePending') === 'true';
    const excludeFailed = searchParams.get('excludeFailed') !== 'false';

    let query = supabase
      .from('generations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq('type', type);
    }

    if (tool) {
      query = query.eq('tool', tool);
    }

    if (!includePending) {
      query = query.neq('status', 'pending');
    }

    if (excludeFailed) {
      query = query.neq('status', 'failed');
    }

    const { data: generations, error } = await query;

    if (error) {
      console.error('[generations] Error fetching generations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch generations', message: error.message },
        { status: 500 }
      );
    }

    let countQuery = supabase
      .from('generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (type) {
      countQuery = countQuery.eq('type', type);
    }

    if (tool) {
      countQuery = countQuery.eq('tool', tool);
    }

    if (!includePending) {
      countQuery = countQuery.neq('status', 'pending');
    }

    if (excludeFailed) {
      countQuery = countQuery.neq('status', 'failed');
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('[generations] Error counting generations:', countError);
      return NextResponse.json(
        { error: 'Failed to fetch generations', message: countError.message },
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

    const returned = generationsWithUrls.length;
    const total = count ?? 0;

    return NextResponse.json({
      generations: generationsWithUrls,
      pagination: {
        limit,
        offset,
        returned,
        total,
        hasMore: offset + returned < total,
      },
    });
  } catch (error) {
    console.error('[generations] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
