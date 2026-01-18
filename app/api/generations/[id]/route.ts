import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    // Handle params as Promise (Next.js 15+) or object (Next.js 14)
    const resolvedParams = await Promise.resolve(params);
    const generationId = resolvedParams.id;

    // First, verify the generation exists and belongs to the user
    const { data: generation, error: fetchError } = await supabase
      .from('generations')
      .select('*')
      .eq('id', generationId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !generation) {
      console.error('[generations] Error fetching generation:', fetchError);
      return NextResponse.json(
        { error: 'Generation not found or unauthorized' },
        { status: 404 }
      );
    }

    // Delete the file from Supabase storage if it exists
    if (generation.supabase_storage_path) {
      try {
        const { error: storageError } = await supabase.storage
          .from('public-bucket')
          .remove([generation.supabase_storage_path]);

        if (storageError) {
          console.error('[generations] Error deleting file from storage:', storageError);
          // Continue with database deletion even if storage deletion fails
        } else {
          console.log('[generations] ✓ File deleted from storage:', generation.supabase_storage_path);
        }
      } catch (storageErr) {
        console.error('[generations] Exception deleting file from storage:', storageErr);
        // Continue with database deletion
      }
    }

    // Delete reference images/videos from storage if they exist
    if (generation.reference_images_supabase_storage_path) {
      try {
        const pathsToDelete = generation.reference_images_supabase_storage_path.filter(Boolean);
        if (pathsToDelete.length > 0) {
          const { error: refStorageError } = await supabase.storage
            .from('public-bucket')
            .remove(pathsToDelete);

          if (refStorageError) {
            console.error('[generations] Error deleting reference images from storage:', refStorageError);
          } else {
            console.log('[generations] ✓ Reference images deleted from storage');
          }
        }
      } catch (refErr) {
        console.error('[generations] Exception deleting reference images:', refErr);
      }
    }

    if (generation.reference_videos_supabase_storage_path) {
      try {
        const pathsToDelete = generation.reference_videos_supabase_storage_path.filter(Boolean);
        if (pathsToDelete.length > 0) {
          const { error: refStorageError } = await supabase.storage
            .from('public-bucket')
            .remove(pathsToDelete);

          if (refStorageError) {
            console.error('[generations] Error deleting reference videos from storage:', refStorageError);
          } else {
            console.log('[generations] ✓ Reference videos deleted from storage');
          }
        }
      } catch (refErr) {
        console.error('[generations] Exception deleting reference videos:', refErr);
      }
    }

    // Delete the generation record from the database
    const { error: deleteError } = await supabase
      .from('generations')
      .delete()
      .eq('id', generationId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('[generations] Error deleting generation from database:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete generation', message: deleteError.message },
        { status: 500 }
      );
    }

    console.log('[generations] ✓ Generation deleted successfully:', generationId);

    return NextResponse.json({
      success: true,
      message: 'Generation deleted successfully',
    });
  } catch (error) {
    console.error('[generations] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
