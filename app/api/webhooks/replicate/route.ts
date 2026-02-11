import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkUserHasCredits, deductUserCredits } from '@/lib/credits';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type ReplicatePrediction = {
  id: string;
  status: string;
  output?: unknown;
  error?: string | null;
};

function extractOutputUrls(output: unknown): string[] {
  const urls: string[] = [];
  const extract = (value: unknown) => {
    if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
      urls.push(value);
      return;
    }
    if (value && typeof value === 'object') {
      const obj = value as { url?: string | (() => string) };
      if (typeof obj.url === 'function') {
        const u = obj.url();
        if (u && (u.startsWith('http://') || u.startsWith('https://'))) urls.push(u);
      } else if (typeof obj.url === 'string') urls.push(obj.url);
      return;
    }
  };
  if (Array.isArray(output)) {
    output.forEach(extract);
  } else {
    extract(output);
  }
  return urls;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReplicatePrediction;
    const { id: predictionId, status, output, error } = body;

    if (!predictionId || !status) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const terminal = ['succeeded', 'failed', 'canceled'].includes(status);
    if (!terminal) {
      return NextResponse.json({ received: true });
    }

    const { data: generation, error: fetchError } = await supabaseAdmin
      .from('generations')
      .select('id, user_id, prompt, model, reference_images_supabase_storage_path, aspect_ratio, tool, type')
      .eq('replicate_prediction_id', predictionId)
      .eq('status', 'pending')
      .maybeSingle();

    if (fetchError || !generation) {
      console.warn('[webhooks/replicate] No pending generation for prediction:', predictionId, fetchError?.message);
      return NextResponse.json({ received: true });
    }

    if (status === 'succeeded' && output != null) {
      const outputUrls = extractOutputUrls(output);
      if (outputUrls.length === 0) {
        await supabaseAdmin
          .from('generations')
          .update({ status: 'failed', error_message: 'Replicate returned no output URLs' })
          .eq('id', generation.id);
        return NextResponse.json({ received: true });
      }

      const referencePaths = (generation.reference_images_supabase_storage_path as string[] | null) ?? [];
      const uploadOne = async (url: string, index?: number): Promise<{ url: string; storagePath: string }> => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to download Replicate output (${res.status})`);
        const buf = Buffer.from(await res.arrayBuffer());
        const filename = index !== undefined
          ? `${Date.now()}-${Math.random().toString(36).slice(7)}-${index}.png`
          : `${Date.now()}-${Math.random().toString(36).slice(7)}.png`;
        const storagePath = `${generation.user_id}/image-generations/${filename}`;
        const { error: uploadErr } = await supabaseAdmin.storage
          .from('public-bucket')
          .upload(storagePath, buf, { contentType: 'image/png', upsert: false });
        if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);
        const { data: urlData } = supabaseAdmin.storage.from('public-bucket').getPublicUrl(storagePath);
        return { url: urlData.publicUrl, storagePath };
      };

      const results = await Promise.all(outputUrls.map((url, i) => uploadOne(url, outputUrls.length > 1 ? i : undefined)));

      const modelRow = await supabaseAdmin
        .from('models')
        .select('model_cost')
        .eq('identifier', generation.model)
        .eq('type', 'image')
        .single();
      const costPerImage = Number((modelRow.data as { model_cost?: number } | null)?.model_cost ?? 0) || 2;
      const requiredCredits = Math.max(1, costPerImage * results.length);

      const hasCredits = await checkUserHasCredits(generation.user_id, requiredCredits, supabaseAdmin);
      if (!hasCredits) {
        await supabaseAdmin
          .from('generations')
          .update({ status: 'failed', error_message: 'Insufficient credits when processing result' })
          .eq('id', generation.id);
        return NextResponse.json({ received: true });
      }

      if (results.length === 1) {
        await supabaseAdmin
          .from('generations')
          .update({
            supabase_storage_path: results[0].storagePath,
            status: 'completed',
            error_message: null,
          })
          .eq('id', generation.id);
      } else {
        await supabaseAdmin
          .from('generations')
          .update({
            supabase_storage_path: results[0].storagePath,
            status: 'completed',
            error_message: null,
          })
          .eq('id', generation.id);
        const extraRows = results.slice(1).map((r) => ({
          user_id: generation.user_id,
          prompt: generation.prompt,
          supabase_storage_path: r.storagePath,
          reference_images_supabase_storage_path: referencePaths.length ? referencePaths : null,
          aspect_ratio: generation.aspect_ratio,
          model: generation.model,
          type: generation.type || 'image',
          is_public: true,
          tool: generation.tool,
          status: 'completed',
        }));
        if (extraRows.length > 0) {
          await supabaseAdmin.from('generations').insert(extraRows);
        }
      }

      await deductUserCredits(generation.user_id, requiredCredits, supabaseAdmin);
      console.log('[webhooks/replicate] Completed prediction', predictionId, 'generation', generation.id);
    } else {
      await supabaseAdmin
        .from('generations')
        .update({ status: 'failed', error_message: error || `Prediction ${status}` })
        .eq('id', generation.id);
      console.log('[webhooks/replicate] Marked prediction as failed', predictionId, error);
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('[webhooks/replicate] Error:', e);
    return NextResponse.json({ received: true });
  }
}
