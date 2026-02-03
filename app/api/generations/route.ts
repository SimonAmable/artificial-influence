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

    const { data: generations, error } = await query;

    if (error) {
      console.error('[generations] Error fetching generations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch generations', message: error.message },
        { status: 500 }
      );
    }

    // Get public URLs for each generation
    const generationsWithUrls = await Promise.all(
      (generations || []).map(async (generation) => {
        const { data: urlData } = supabase.storage
          .from('public-bucket')
          .getPublicUrl(generation.supabase_storage_path);
        
        return {
          ...generation,
          url: urlData.publicUrl,
        };
      })
    );

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
