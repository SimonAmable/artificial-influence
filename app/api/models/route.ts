import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Model } from '@/lib/types/models';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get type query parameter (optional - if not provided, return all)
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as 'image' | 'video' | 'audio' | null;

    // Build query
    let query = supabase
      .from('models')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    // Filter by type if provided
    if (type) {
      query = query.eq('type', type);
    }

    const { data: models, error } = await query;

    if (error) {
      console.error('[models] Error fetching models:', error);
      return NextResponse.json(
        { error: 'Failed to fetch models', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      models: models as Model[],
    });
  } catch (error) {
    console.error('[models] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
