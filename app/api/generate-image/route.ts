import { generateImage } from 'ai';
import { replicate } from '@ai-sdk/replicate';
import { xai } from '@ai-sdk/xai';
import Replicate from 'replicate';
import { NextRequest, NextResponse } from 'next/server';
import { assertAcceptedCurrentTerms } from '@/lib/legal/terms-acceptance';
import { enhancePrompt, enhancePromptForJSONModels } from '@/lib/prompt-enhancement';
import { createClient } from '@/lib/supabase/server';
import { checkUserHasCredits, deductUserCredits } from '@/lib/credits';
import { modelUsesDimensions, aspectRatioToDimensions } from '@/lib/utils/model-parameters';
import { DEFAULT_IMAGE_MODEL_IDENTIFIER } from '@/lib/constants/models';
import { runReplicatePollingImageGeneration } from '@/lib/server/replicate-image-generation';
import {
  buildFalImageRequest,
  isSupportedFalImageModel,
  submitFalImageQueue,
} from '@/lib/server/fal-image';
import {
  buildReplicateGptImage2Input,
  isReplicateGptImage2Model,
} from '@/lib/server/replicate-gpt-image';

const STALE_PENDING_MINUTES = 30;
const FREE_CONCURRENCY_LIMIT = 1;
const PAID_CONCURRENCY_LIMIT = 3;

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  console.log('[generate-image] ===== Request started =====');
  
  try {
    // Provider-specific API keys are validated after the model is selected (Replicate, Fal, xAI).

    // Get authenticated user
    console.log('[generate-image] Authenticating user...');
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('[generate-image] Authentication failed:', authError?.message || 'No user');
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to generate images.' },
        { status: 401 }
      );
    }
    console.log('[generate-image] ✓ User authenticated:', { userId: user.id, email: user.email });

    const termsResponse = await assertAcceptedCurrentTerms(supabase, user.id);
    if (termsResponse) {
      return termsResponse;
    }

    // Clean stale pending requests so users are not blocked forever by abandoned runs.
    const staleCutoff = new Date(Date.now() - STALE_PENDING_MINUTES * 60 * 1000).toISOString();
    const { error: staleCleanupError } = await supabase
      .from('generations')
      .update({
        status: 'failed',
        error_message: 'Timed out/stale pending cleanup',
      })
      .eq('user_id', user.id)
      .eq('type', 'image')
      .eq('status', 'pending')
      .lt('created_at', staleCutoff);

    if (staleCleanupError) {
      console.error('[generate-image] Failed to clean stale pending generations:', staleCleanupError);
      return NextResponse.json(
        { error: 'Failed to validate active generations', message: staleCleanupError.message },
        { status: 500 }
      );
    }

    const { count: activeGenerationsCount, error: pendingCountError } = await supabase
      .from('generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('type', 'image')
      .eq('status', 'pending')
      .gte('created_at', staleCutoff);

    if (pendingCountError) {
      console.error('[generate-image] Failed to count pending generations:', pendingCountError);
      return NextResponse.json(
        { error: 'Failed to validate active generations', message: pendingCountError.message },
        { status: 500 }
      );
    }

    const { data: activeSubscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) {
      console.error('[generate-image] Failed to read active subscription, falling back to profiles.is_pro:', subscriptionError);
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_pro')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[generate-image] Failed to read profiles.is_pro, defaulting to free tier:', profileError);
    }

    const isPaidTier = Boolean(activeSubscription) || Boolean(profile?.is_pro);
    const tier = isPaidTier ? 'paid' : 'free';
    const limit = isPaidTier ? PAID_CONCURRENCY_LIMIT : FREE_CONCURRENCY_LIMIT;
    const activeGenerations = activeGenerationsCount ?? 0;

    if (activeGenerations >= limit) {
      return NextResponse.json(
        {
          error: 'Concurrency limit reached',
          message: `You have ${activeGenerations} active image generation request${activeGenerations === 1 ? '' : 's'} (limit: ${limit} for ${tier} tier).`,
          activeGenerations,
          limit,
          tier,
        },
        {
          status: 429,
          headers: {
            'Retry-After': '30',
          },
        }
      );
    }

    // Parse FormData
    console.log('[generate-image] Parsing FormData...');
    const formData = await request.formData();
    const prompt = formData.get('prompt') as string;
    const referenceImageFiles = formData.getAll('referenceImages') as File[];
    const enhancePromptValue = formData.get('enhancePrompt');
    const shouldEnhance = enhancePromptValue === 'true';
    const modelIdentifier = (formData.get('model') as string) || DEFAULT_IMAGE_MODEL_IDENTIFIER;
    
    // Get optional parameters from form data
    const aspectRatio = formData.get('aspectRatio') as string | null;
    const size = formData.get('size') as string | null;
    const n = formData.get('n') ? parseInt(formData.get('n') as string) : null;
    const seed = formData.get('seed') ? parseInt(formData.get('seed') as string) : null;
    let aspect_ratio = formData.get('aspect_ratio') as string | null;
    const resolution = formData.get('resolution') as string | null;
    const output_format = formData.get('output_format') as string | null;
    const quality = (formData.get('quality') as string | null)?.toLowerCase() ?? null;
    const moderation = (formData.get('moderation') as string | null)?.toLowerCase() ?? null;
    const background = (formData.get('background') as string | null)?.toLowerCase() ?? null;
    const widthForm = formData.get('width');
    const heightForm = formData.get('height');
    const width = widthForm ? parseInt(widthForm as string) : null;
    const height = heightForm ? parseInt(heightForm as string) : null;
    const tool = formData.get('tool') as string | null;

    // Fetch model details from database
    console.log('[generate-image] Fetching model details for:', modelIdentifier);
    const { data: modelData, error: modelError } = await supabase
      .from('models')
      .select('*')
      .eq('identifier', modelIdentifier)
      .eq('type', 'image')
      .eq('is_active', true)
      .single();

    if (modelError || !modelData) {
      console.error('[generate-image] Model not found or error:', modelError?.message || 'Model not found');
      return NextResponse.json(
        { error: `Model "${modelIdentifier}" not found or is inactive` },
        { status: 400 }
      );
    }
    console.log('[generate-image] ✓ Model found:', modelData.name);

    const modelProvider = isReplicateGptImage2Model(modelIdentifier)
      ? 'replicate'
      : String(modelData.provider ?? '').toLowerCase();
    if (modelProvider === 'fal') {
      if (!process.env.FAL_KEY) {
        console.error('[generate-image] FAL_KEY not set for Fal model');
        return NextResponse.json(
          { error: 'FAL_KEY environment variable is not set' },
          { status: 500 },
        );
      }
    } else if (modelProvider !== 'xai') {
      if (!process.env.REPLICATE_API_TOKEN) {
        console.error('[generate-image] REPLICATE_API_TOKEN not set');
        return NextResponse.json(
          { error: 'REPLICATE_API_TOKEN environment variable is not set' },
          { status: 500 },
        );
      }
    }

    // Validate and clamp n against model's max_images
    const maxImages = modelData.max_images != null ? Number(modelData.max_images) : 1;
    const effectiveN = (() => {
      if (!n || n < 1) return 1;
      if (maxImages <= 1) return 1;
      return Math.min(n, maxImages);
    })();
    if (n != null && n > 0 && effectiveN !== n) {
      console.log(`[generate-image] Clamped n from ${n} to ${effectiveN} (model max_images=${maxImages})`);
    }

    // Compute required credits from model cost and image count
    const imageCount = effectiveN;
    const costPerImage = Number(modelData.model_cost) ?? 0;
    const requiredCredits = costPerImage > 0
      ? costPerImage * imageCount
      : Math.max(1, imageCount);

    const hasCredits = await checkUserHasCredits(user.id, requiredCredits);
    if (!hasCredits) {
      return NextResponse.json(
        {
          error: 'Insufficient credits.',
          message: `This generation requires ${requiredCredits} credits (${modelData.name}${imageCount > 1 ? ` × ${imageCount} images` : ''}).`,
        },
        { status: 402 }
      );
    }

    console.log('[generate-image] FormData parsed:', {
      promptLength: prompt?.length || 0,
      referenceImageCount: referenceImageFiles.length,
      referenceImageSizes: referenceImageFiles.map(f => f.size),
      referenceImageTypes: referenceImageFiles.map(f => f.type),
      shouldEnhance,
      aspectRatio,
      size,
      n,
      seed,
      aspect_ratio,
      resolution,
      output_format,
    });

    // Validate required prompt
    if (!prompt || typeof prompt !== 'string') {
      console.error('[generate-image] Invalid prompt:', { prompt, type: typeof prompt });
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 }
      );
    }
    console.log('[generate-image] ✓ Prompt validated:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));

    // Upload reference images to storage if provided
    // Store both the buffers (for AI SDK) and URLs (for logging/persistence)
    const referenceImageUrls: string[] = [];
    const referenceImageStoragePaths: string[] = [];
    const replicateGptImage2ReferenceImages: File[] = [];
    
    if (referenceImageFiles.length > 0) {
      console.log(`[generate-image] Processing ${referenceImageFiles.length} reference image(s)...`);
      
      for (let i = 0; i < referenceImageFiles.length; i++) {
        const referenceImageFile = referenceImageFiles[i];
        
        if (!referenceImageFile || referenceImageFile.size === 0) {
          console.log(`[generate-image] Skipping empty reference image ${i + 1}`);
          continue;
        }
        
        console.log(`[generate-image] Processing reference image ${i + 1}/${referenceImageFiles.length}...`);
      try {
        // Validate file type
        if (!referenceImageFile.type.startsWith('image/')) {
          console.error('[generate-image] Invalid reference image type:', referenceImageFile.type);
          return NextResponse.json(
            { error: 'Reference image must be a valid image file' },
            { status: 400 }
          );
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (referenceImageFile.size > maxSize) {
          console.error('[generate-image] Reference image too large:', referenceImageFile.size, 'bytes');
          return NextResponse.json(
            { error: 'Reference image is too large. Maximum size is 10MB.' },
            { status: 400 }
          );
        }

        // Generate unique filename
        const fileExtension = referenceImageFile.name.split('.').pop() || 'png';
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const filename = `${timestamp}-${randomStr}.${fileExtension}`;
        const storagePath = `${user.id}/reference-images/${filename}`;

          console.log(`[generate-image] Reference image ${i + 1} details:`, {
            originalName: referenceImageFile.name,
            type: referenceImageFile.type,
            size: referenceImageFile.size,
            storagePath,
          });

          // Convert File to ArrayBuffer then to Buffer
          console.log(`[generate-image] Converting reference image ${i + 1} to buffer...`);
          const arrayBuffer = await referenceImageFile.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          if (isReplicateGptImage2Model(modelIdentifier)) {
            replicateGptImage2ReferenceImages.push(
              new File([buffer], referenceImageFile.name || filename, {
                type: referenceImageFile.type || 'image/png',
              })
            );
          }
          console.log(`[generate-image] ✓ Buffer ${i + 1} created, size:`, buffer.length, 'bytes');

          // Upload to Supabase storage (for persistence/logging)
          console.log(`[generate-image] Uploading reference image ${i + 1} to Supabase storage...`);
          const uploadStartTime = Date.now();
          const { error: uploadError } = await supabase.storage
            .from('public-bucket')
            .upload(storagePath, buffer, {
              contentType: referenceImageFile.type,
              upsert: false,
            });

          if (uploadError) {
            console.error(`[generate-image] Error uploading reference image ${i + 1}:`, uploadError);
            return NextResponse.json(
              { error: `Failed to upload reference image ${i + 1}`, message: uploadError.message },
              { status: 500 }
            );
          }

          const uploadTime = Date.now() - uploadStartTime;
          console.log(`[generate-image] ✓ Reference image ${i + 1} uploaded in`, uploadTime, 'ms');

          // Store the storage path for database
          referenceImageStoragePaths.push(storagePath);

          // Get public URL (for logging/reference)
          const { data: urlData } = supabase.storage
            .from('public-bucket')
            .getPublicUrl(storagePath);

          referenceImageUrls.push(urlData.publicUrl);
          console.log(`[generate-image] ✓ Reference image ${i + 1} URL:`, urlData.publicUrl);
        } catch (error) {
          console.error(`[generate-image] Error processing reference image ${i + 1}:`, error);
          return NextResponse.json(
            { error: `Failed to process reference image ${i + 1}`, message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
          );
        }
      }
      
      console.log(`[generate-image] ✓ Processed ${referenceImageUrls.length} reference image(s)`);
    } else {
      console.log('[generate-image] No reference images provided');
    }

    // Enhance prompt if requested
    let finalPrompt = prompt;
    if (shouldEnhance === true) {
      console.log('[generate-image] Enhancing prompt for model:', modelIdentifier);
      try {
        const enhanceStartTime = Date.now();

        // Use JSON enhancement for models that support structured prompts
        const jsonSupportedModels = [
          'google/nano-banana',
          'google/nano-banana-pro',
          'google/nano-banana-2',
          'bytedance/seedream-4.5'
        ];

        if (jsonSupportedModels.includes(modelIdentifier)) {
          console.log('[generate-image] Using JSON prompt enhancement for:', modelIdentifier, {
            referenceImagesForEnhance: referenceImageUrls.length,
          });
          finalPrompt = await enhancePromptForJSONModels(prompt, modelIdentifier, {
            imageUrls: referenceImageUrls,
          });
          console.log('[generate-image] ✓ JSON prompt enhanced - returned structured data');
        } else {
          console.log('[generate-image] Using standard prompt enhancement');
          finalPrompt = await enhancePrompt(prompt, 'generate');
          console.log('[generate-image] Enhanced prompt:', finalPrompt.substring(0, 100) + (finalPrompt.length > 100 ? '...' : ''));
        }

        const enhanceTime = Date.now() - enhanceStartTime;
        console.log('[generate-image] ✓ Prompt enhanced in', enhanceTime, 'ms');
      } catch (error) {
        console.error('[generate-image] Error enhancing prompt:', error);
        console.log('[generate-image] Continuing with original prompt');
        // Continue with original prompt if enhancement fails
      }
    } else {
      console.log('[generate-image] Prompt enhancement skipped');
    }

    if (modelProvider === 'fal' && isSupportedFalImageModel(modelIdentifier)) {
      const negativePromptField = formData.get('negative_prompt') as string | null;
      const enablePromptExpansion = formData.get('enable_prompt_expansion') !== 'false';
      const enableSafetyChecker = formData.get('enable_safety_checker') === 'true';
      const rawFormat = (output_format || 'png').toLowerCase();
      const outputFormatResolved: 'png' | 'jpeg' | 'webp' =
        rawFormat === 'jpeg' || rawFormat === 'jpg'
          ? 'jpeg'
          : rawFormat === 'webp'
            ? 'webp'
            : 'png';
      const falRequest = buildFalImageRequest({
        aspectRatio: aspectRatio || aspect_ratio || null,
        enablePromptExpansion,
        enableSafetyChecker,
        modelIdentifier,
        negativePrompt: negativePromptField?.trim() ? negativePromptField : null,
        numImages: effectiveN,
        outputFormat: outputFormatResolved,
        prompt: finalPrompt,
        referenceImageUrls,
        seed: seed != null && !Number.isNaN(seed) ? seed : null,
      });
      const { requestId, endpointId: falEndpoint } = await submitFalImageQueue(
        falRequest.endpointId,
        falRequest.input,
      );

      const { data: pendingGeneration, error: insertError } = await supabase
        .from('generations')
        .insert({
          user_id: user.id,
          prompt: finalPrompt,
          supabase_storage_path: null,
          reference_images_supabase_storage_path:
            referenceImageStoragePaths.length > 0 ? referenceImageStoragePaths : null,
          aspect_ratio: falRequest.resolvedAspectRatio,
          model: modelIdentifier,
          type: 'image',
          is_public: true,
          tool: tool || null,
          status: 'pending',
          replicate_prediction_id: requestId,
          fal_endpoint_id: falEndpoint,
        })
        .select('id')
        .single();

      if (insertError || !pendingGeneration) {
        console.error('[generate-image] Failed to insert pending Fal generation:', insertError);
        return NextResponse.json({ error: 'Failed to create pending generation' }, { status: 500 });
      }

      return NextResponse.json(
        {
          status: 'pending',
          predictionId: requestId,
          generationId: pendingGeneration.id,
          message: 'Generation started. Poll GET /api/generate-image/status?predictionId=' + requestId,
        },
        { status: 202 },
      );
    }

    if (modelProvider === 'fal') {
      return NextResponse.json(
        { error: `Unsupported Fal image model: ${modelIdentifier}` },
        { status: 400 },
      );
    }

    // Prepare generateImage options
    console.log('[generate-image] Preparing generation options...');
    const isNanoBananaFamily = ['google/nano-banana', 'google/nano-banana-pro', 'google/nano-banana-2'].includes(modelIdentifier);

    // For image-editor-style edits with references, default nano-banana family to input image ratio
    if (isNanoBananaFamily && referenceImageUrls.length > 0 && !aspect_ratio && !aspectRatio) {
      aspect_ratio = 'match_input_image';
      console.log('[generate-image] Applied default aspect_ratio=match_input_image for nano-banana family edit flow');
    }
    
    // Initialize model based on provider
    let imageModel;
    const provider = modelProvider;
    
    if (provider === 'xai') {
      // xAI Grok model
      const modelIdentifierOnly = modelIdentifier.replace('xai/', '');
      imageModel = xai.image(modelIdentifierOnly);
      console.log('[generate-image] Using xAI provider with model:', modelIdentifierOnly);
    } else {
      // Default to Replicate
      imageModel = replicate.image(modelIdentifier as string);
      console.log('[generate-image] Using Replicate provider');
    }
    
    // Check if we're using JSON prompt for supported models
    const jsonSupportedModels = [
      'google/nano-banana',
      'google/nano-banana-pro',
      'google/nano-banana-2',
      'bytedance/seedream-4.5'
    ];
    const usingJSONPrompt = jsonSupportedModels.includes(modelIdentifier) && shouldEnhance;

    console.log('[generate-image] Prompt type:', usingJSONPrompt ? 'JSON structured' : 'regular text');
    console.log('[generate-image] Final prompt length:', finalPrompt.length, 'characters');

    // Use the selected model identifier
    const generateOptions: Parameters<typeof generateImage>[0] = {
      model: imageModel,
      prompt: finalPrompt,
    };

    // Add optional parameters if provided
    if (aspectRatio && /^\d+:\d+$/.test(aspectRatio)) {
      generateOptions.aspectRatio = aspectRatio as `${number}:${number}`;
      console.log('[generate-image] Aspect ratio set:', aspectRatio);
    }

    if (size && /^\d+x\d+$/.test(size)) {
      generateOptions.size = size as `${number}x${number}`;
      console.log('[generate-image] Size set:', size);
    }

    if (effectiveN > 1) {
      generateOptions.n = effectiveN;
      console.log('[generate-image] Number of images set:', effectiveN);
    }

    if (seed && typeof seed === 'number') {
      generateOptions.seed = seed;
      console.log('[generate-image] Seed set:', seed);
    }

    // Add provider-specific options
    generateOptions.providerOptions = {};
    
    if (provider === 'xai') {
      // xAI/Grok provider options
      console.log('[generate-image] Setting up xAI provider options');
      generateOptions.providerOptions.xai = {
        // Add xAI-specific parameters
        ...(seed && { seed }),
      };
    } else {
      // Replicate provider options
      console.log('[generate-image] Setting up Replicate provider options');
      if (isReplicateGptImage2Model(modelIdentifier)) {
        const gptImage2Request = buildReplicateGptImage2Input({
          aspectRatio: aspect_ratio || aspectRatio,
          background,
          moderation,
          numberOfImages: effectiveN,
          outputFormat: output_format,
          prompt: finalPrompt,
          quality,
          referenceImages: replicateGptImage2ReferenceImages,
        });
        const { prompt: _ignoredPrompt, ...replicateProviderOptions } = gptImage2Request.input;
        generateOptions.providerOptions.replicate = replicateProviderOptions as never;
      } else if (modelUsesDimensions(modelData.parameters)) {
        // Model expects width/height (e.g. prunaai/z-image-turbo)
        const aspectValue = aspect_ratio || aspectRatio;
        const dims =
          width != null && height != null && width > 0 && height > 0
            ? { width, height }
            : aspectRatioToDimensions(aspectValue || '1:1');
        console.log('[generate-image] Model uses dimensions, mapped:', dims);
        generateOptions.providerOptions.replicate = {
          width: dims.width,
          height: dims.height,
          ...(resolution && { resolution }),
          ...(output_format && { output_format }),
          ...(referenceImageUrls.length > 0 && { image_input: referenceImageUrls }),
        };
      } else {
        // Model expects aspect_ratio (e.g. nano-banana)
        generateOptions.providerOptions.replicate = {
          ...(aspect_ratio && { aspect_ratio }),
          ...(resolution && { resolution }),
          ...(output_format && { output_format }),
          ...(referenceImageUrls.length > 0 && { image_input: referenceImageUrls }),
          // Flux 2 Dev: disable safety checker to avoid NSFW content detection blocking valid images
          ...(modelIdentifier === 'black-forest-labs/flux-2-dev' && { disable_safety_checker: true }),
        };
      }
    }

    console.log('[generate-image] Generation options:', {
      model: modelIdentifier,
      modelName: modelData.name,
      promptType: 'string',
      promptText: finalPrompt.substring(0, 100) + (finalPrompt.length > 100 ? '...' : ''),
      promptLength: finalPrompt.length,
      referenceImageCount: referenceImageUrls.length,
      referenceImageUrls: referenceImageUrls.length > 0 ? referenceImageUrls : 'none',
      imageInputInProviderOptions: referenceImageUrls.length > 0
        ? `[${referenceImageUrls.map(url => url.substring(0, 50)).join(', ')}...]` 
        : 'none',
      aspectRatio: generateOptions.aspectRatio || 'default',
      size: generateOptions.size || 'default',
      n: generateOptions.n || 1,
      seed: generateOptions.seed || 'none',
      providerOptions: generateOptions.providerOptions,
    });

    // Generate the image(s)
    console.log('[generate-image] Starting image generation...');
    const generationStartTime = Date.now();
    let result;
    try {
      if (provider === 'xai' && referenceImageUrls.length > 0) {
        // xAI edits API requires JSON (not multipart). Call directly since AI SDK uses multipart for edits.
        const xaiApiKey = process.env.XAI_API_KEY;
        if (!xaiApiKey) {
          throw new Error('XAI_API_KEY environment variable is not set (required for Grok Imagine with reference images)');
        }
        const modelId = modelIdentifier.replace('xai/', '');
        const imagePayload =
          referenceImageUrls.length === 1
            ? {
                image: {
                  url: referenceImageUrls[0],
                  type: 'image_url' as const,
                },
              }
            : {
                images: referenceImageUrls.map((url) => ({
                  url,
                  type: 'image_url' as const,
                })),
              };
        const editsBody = {
          model: modelId,
          prompt: finalPrompt,
          ...imagePayload,
          response_format: 'b64_json' as const,
          n: effectiveN,
          ...(aspectRatio && /^\d+:\d+$/.test(aspectRatio) && { aspect_ratio: aspectRatio }),
          ...(seed && typeof seed === 'number' && { seed }),
        };
        console.log('[generate-image] Calling xAI edits API directly:', {
          model: modelId,
          imageCount: referenceImageUrls.length,
          n: effectiveN,
        });
        const xaiRes = await fetch('https://api.x.ai/v1/images/edits', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${xaiApiKey}`,
          },
          body: JSON.stringify(editsBody),
        });
        if (!xaiRes.ok) {
          const errText = await xaiRes.text();
          console.error('[generate-image] xAI edits API error:', xaiRes.status, errText);
          throw new Error(`xAI API error: ${xaiRes.status} - ${errText}`);
        }
        const xaiData = (await xaiRes.json()) as { data: Array<{ b64_json?: string; url?: string }> };
        const outputData = xaiData?.data ?? [];
        if (outputData.length === 0) {
          throw new Error('xAI edits API returned no images');
        }
        const outputBase64Images = outputData.map((item) => {
          if (item.b64_json) return item.b64_json;
          if (item.url) throw new Error('xAI returned URL; expected b64_json. Set response_format to b64_json.');
          throw new Error('xAI response missing b64_json');
        });
        result =
          outputBase64Images.length > 1
            ? { images: outputBase64Images.map((base64) => ({ base64 })), warnings: [] }
            : { image: { base64: outputBase64Images[0] }, warnings: [] };
      } else if (provider === 'xai') {
        result = await generateImage(generateOptions);
      } else {
        const replicateClient = new Replicate({
          auth: process.env.REPLICATE_API_TOKEN,
        });

        const replicateProviderOptions = (generateOptions.providerOptions?.replicate ?? {}) as Record<string, unknown>;
        const replicateInputDefaults = (modelData.parameters as Record<string, unknown> | null)?.replicate_input_defaults as Record<string, unknown> | undefined;
        let replicateResolvedAspectRatio: string | null = aspectRatio || aspect_ratio || null;
        const replicateInput: Record<string, unknown> = isReplicateGptImage2Model(modelIdentifier)
          ? (() => {
              const gptImage2Request = buildReplicateGptImage2Input({
                aspectRatio: aspect_ratio || aspectRatio,
                background,
                moderation,
                numberOfImages: effectiveN,
                outputFormat: output_format,
                prompt: finalPrompt,
                quality,
                referenceImages: replicateGptImage2ReferenceImages,
              });
              replicateResolvedAspectRatio = gptImage2Request.resolvedAspectRatio;
              return gptImage2Request.input;
            })()
          : {
              prompt: finalPrompt,
              ...(generateOptions.n && { num_outputs: generateOptions.n }),
              ...(generateOptions.seed && { seed: generateOptions.seed }),
              ...(generateOptions.size && { size: generateOptions.size }),
              ...(replicateInputDefaults && Object.keys(replicateInputDefaults).length > 0 ? replicateInputDefaults : {}),
              ...replicateProviderOptions,
            };

        // Enable Google grounding features for nano-banana 2
        if (modelIdentifier === 'google/nano-banana-2') {
          replicateInput.google_search = true;
          replicateInput.image_search = true;
        }

        // Fallback mapping if only generic aspectRatio was set.
        if (!('aspect_ratio' in replicateInput) && generateOptions.aspectRatio) {
          replicateInput.aspect_ratio = generateOptions.aspectRatio;
        }

        const webhookBase = process.env.REPLICATE_WEBHOOK_BASE_URL?.replace(/\/$/, '');

        if (webhookBase) {
          const webhookUrl = `${webhookBase}/api/webhooks/replicate`;
          console.log('[generate-image] Using Replicate async + webhook:', { model: modelIdentifier, webhookUrl });

          // Replicate predictions.create: use "version" (POST /predictions) when identifier has version,
          // otherwise use "model" (POST /models/owner/name/predictions). The model-in-URL path 404s for versioned refs.
          const replicateModelMatch = (modelIdentifier as string).match(/^([^/]+\/[^:]+):(.+)$/);
          const prediction = await replicateClient.predictions.create(
            replicateModelMatch
              ? { version: replicateModelMatch[2], input: replicateInput, webhook: webhookUrl, webhook_events_filter: ['completed'] }
              : { model: modelIdentifier as `${string}/${string}`, input: replicateInput, webhook: webhookUrl, webhook_events_filter: ['completed'] }
          );

          const { data: pendingGeneration, error: insertError } = await supabase
            .from('generations')
            .insert({
              user_id: user.id,
              prompt: finalPrompt,
              supabase_storage_path: null,
              reference_images_supabase_storage_path: referenceImageStoragePaths.length > 0 ? referenceImageStoragePaths : null,
              aspect_ratio: replicateResolvedAspectRatio,
              model: modelIdentifier,
              type: 'image',
              is_public: true,
              tool: tool || null,
              status: 'pending',
              replicate_prediction_id: prediction.id,
            })
            .select('id')
            .single();

          if (insertError || !pendingGeneration) {
            console.error('[generate-image] Failed to insert pending generation:', insertError);
            throw new Error('Failed to create pending generation');
          }

          return NextResponse.json(
            {
              status: 'pending',
              predictionId: prediction.id,
              generationId: pendingGeneration.id,
              message: 'Generation started. Poll GET /api/generate-image/status?predictionId=' + prediction.id,
            },
            { status: 202 }
          );
        }

        console.log('[generate-image] Using Replicate polling mode:', {
          model: modelIdentifier,
          inputKeys: Object.keys(replicateInput),
        });

        const syncResult = await runReplicatePollingImageGeneration({
          aspectRatio: replicateResolvedAspectRatio,
          modelIdentifier,
          prompt: finalPrompt,
          referenceImageStoragePaths,
          replicateInput,
          requiredCredits,
          skipCreditCheck: true,
          supabase,
          tool: tool || null,
          userId: user.id,
        });

        const generationTime = Date.now() - generationStartTime;
        const totalTime = Date.now() - requestStartTime;
        console.log('[generate-image] ✓ Image generation completed in', generationTime, 'ms');
        console.log('[generate-image] ✓ Persisted', syncResult.images.length, 'image(s) from polling mode');
        console.log('[generate-image] ===== Request completed successfully in', totalTime, 'ms =====');

        if (syncResult.images.length > 1) {
          return NextResponse.json({
            images: syncResult.images.map((image) => ({
              url: image.url,
              mimeType: image.mimeType,
            })),
            warnings: [],
            creditsUsed: syncResult.creditsUsed,
          });
        }

        return NextResponse.json({
          image: {
            url: syncResult.images[0].url,
            mimeType: syncResult.images[0].mimeType,
          },
          warnings: [],
          creditsUsed: syncResult.creditsUsed,
        });
      }
    } catch (genError: unknown) {
      const generationTime = Date.now() - generationStartTime;
      console.error('[generate-image] Generation failed after', generationTime, 'ms');
      
      // Extract Replicate error if available
      if (genError && typeof genError === 'object' && 'responseBody' in genError && typeof genError.responseBody === 'string') {
        try {
          const replicateResponse = JSON.parse(genError.responseBody);
          if (replicateResponse.error) {
            console.error('[generate-image] Replicate error:', replicateResponse.error);
            return NextResponse.json(
              { 
                error: 'Content moderation',
                message: replicateResponse.error,
                details: 'The AI model flagged this request. Try different inputs or reference images.'
              },
              { status: 400 }
            );
          }
        } catch {
          // Fall through to generic error
        }
      }
      
      // Re-throw for generic error handler
      throw genError;
    }
    const generationTime = Date.now() - generationStartTime;
    console.log('[generate-image] ✓ Image generation completed in', generationTime, 'ms');
    
    if (result.images && result.images.length > 0) {
      console.log('[generate-image] Generated', result.images.length, 'image(s)');
    } else if (result.image) {
      console.log('[generate-image] Generated 1 image');
      console.log('[generate-image] Image base64 length:', result.image.base64.length);
    } else {
      console.error('[generate-image] No image in result');
    }
    
    if (result.warnings && result.warnings.length > 0) {
      console.warn('[generate-image] Warnings:', result.warnings);
    }

    // Helper function to upload image to storage and get URL and path
    const uploadImageToStorage = async (base64Image: string, index?: number): Promise<{ url: string; storagePath: string }> => {
      const uploadStartTime = Date.now();
      console.log(`[generate-image] Uploading generated image ${index !== undefined ? `#${index + 1}` : ''} to storage...`);
      
      const imageBuffer = Buffer.from(base64Image, 'base64');
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(7);
      const filename = index !== undefined 
        ? `${timestamp}-${randomStr}-${index}.png`
        : `${timestamp}-${randomStr}.png`;
      const storagePath = `${user.id}/image-generations/${filename}`;

      console.log(`[generate-image] Generated image details:`, {
        index: index !== undefined ? index + 1 : 1,
        bufferSize: imageBuffer.length,
        storagePath,
      });

      const { error: uploadError } = await supabase.storage
        .from('public-bucket')
        .upload(storagePath, imageBuffer, {
          contentType: 'image/png',
          upsert: false,
        });

      if (uploadError) {
        console.error(`[generate-image] Error uploading generated image ${index !== undefined ? `#${index + 1}` : ''}:`, uploadError);
        throw new Error(`Failed to upload generated image: ${uploadError.message}`);
      }

      const uploadTime = Date.now() - uploadStartTime;
      console.log(`[generate-image] ✓ Generated image ${index !== undefined ? `#${index + 1}` : ''} uploaded in`, uploadTime, 'ms');

      const { data: urlData } = supabase.storage
        .from('public-bucket')
        .getPublicUrl(storagePath);

      console.log(`[generate-image] ✓ Generated image ${index !== undefined ? `#${index + 1}` : ''} URL:`, urlData.publicUrl);
      return { url: urlData.publicUrl, storagePath };
    };

    // Helper function to save generation data to database
    const saveGenerationToDatabase = async (storagePath: string, referenceStoragePaths?: string[]) => {
      try {
        console.log('[generate-image] Saving generation to database...');
        
        const generationData = {
          user_id: user.id,
          prompt: finalPrompt, // Use the final prompt (enhanced if applicable)
          supabase_storage_path: storagePath,
          reference_images_supabase_storage_path: referenceStoragePaths && referenceStoragePaths.length > 0 
            ? referenceStoragePaths 
            : null,
          aspect_ratio: aspectRatio || aspect_ratio || null,
          model: modelIdentifier,
          type: 'image', // You can customize this based on your needs
          is_public: true, // Default from schema, but explicitly set
          tool: tool || null,
        };

        const { data: savedData, error: saveError } = await supabase
          .from('generations')
          .insert(generationData)
          .select()
          .single();

        if (saveError) {
          console.error('[generate-image] Error saving generation to database:', saveError);
          // Don't throw - we don't want to fail the request if database save fails
        } else {
          console.log('[generate-image] ✓ Generation saved to database with ID:', savedData?.id);
        }
      } catch (error) {
        console.error('[generate-image] Exception saving generation to database:', error);
        // Don't throw - we don't want to fail the request if database save fails
      }
    };

    // Upload generated image(s) to storage and return URLs
    console.log('[generate-image] Uploading generated image(s) to storage...');
    const uploadStartTime = Date.now();
    
    if (result.images && result.images.length > 0) {
      // Multiple images
      console.log('[generate-image] Processing', result.images.length, 'images...');
      const imageResults = await Promise.all(
        result.images.map((img, index) => uploadImageToStorage(img.base64, index))
      );

      const imageUrls = imageResults.map(r => r.url);
      const imageStoragePaths = imageResults.map(r => r.storagePath);

      // Save each generation to database
      await Promise.all(
        imageStoragePaths.map((storagePath) => saveGenerationToDatabase(storagePath, referenceImageStoragePaths))
      );

      const totalUploadTime = Date.now() - uploadStartTime;
      const totalTime = Date.now() - requestStartTime;
      console.log('[generate-image] ✓ All images uploaded in', totalUploadTime, 'ms');

      await deductUserCredits(user.id, requiredCredits);
      console.log('[generate-image] ✓ Credits deducted:', requiredCredits);
      console.log('[generate-image] ===== Request completed successfully in', totalTime, 'ms =====');

      return NextResponse.json({
        images: imageUrls.map((url) => ({
          url,
          mimeType: 'image/png',
        })),
        warnings: result.warnings,
        creditsUsed: requiredCredits,
      });
    } else if (result.image) {
      // Single image
      const { url: imageUrl, storagePath: imageStoragePath } = await uploadImageToStorage(result.image.base64);

      // Save generation to database
      await saveGenerationToDatabase(imageStoragePath, referenceImageStoragePaths);

      const totalUploadTime = Date.now() - uploadStartTime;
      const totalTime = Date.now() - requestStartTime;
      console.log('[generate-image] ✓ Image uploaded in', totalUploadTime, 'ms');

      await deductUserCredits(user.id, requiredCredits);
      console.log('[generate-image] ✓ Credits deducted:', requiredCredits);
      console.log('[generate-image] ===== Request completed successfully in', totalTime, 'ms =====');

      return NextResponse.json({
        image: {
          url: imageUrl,
          mimeType: 'image/png',
        },
        warnings: result.warnings,
        providerMetadata: result.providerMetadata,
        creditsUsed: requiredCredits,
      });
    } else {
      console.error('[generate-image] No image in result object');
      return NextResponse.json(
        { error: 'No image generated' },
        { status: 500 }
      );
    }
  } catch (error) {
    const totalTime = Date.now() - requestStartTime;
    console.error('[generate-image] ===== Error occurred after', totalTime, 'ms =====');
    console.error('[generate-image] Error details:', error);
    
    // Handle AI SDK specific errors
    if (error instanceof Error) {
      console.error('[generate-image] Error message:', error.message);
      console.error('[generate-image] Error stack:', error.stack);
      return NextResponse.json(
        { 
          error: 'Failed to generate image',
          message: error.message 
        },
        { status: 500 }
      );
    }

    console.error('[generate-image] Unknown error type:', typeof error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Optional: Add GET method for health check or documentation
export async function GET() {
  return NextResponse.json({
    message: 'Image Generation API',
    defaultModel: DEFAULT_IMAGE_MODEL_IDENTIFIER,
    asyncWebhooks: !!process.env.REPLICATE_WEBHOOK_BASE_URL,
    asyncFalQwen: !!process.env.FAL_KEY,
    note:
      process.env.REPLICATE_WEBHOOK_BASE_URL || process.env.FAL_KEY
        ? 'Async mode: POST may return 202 with predictionId; poll GET /api/generate-image/status?predictionId=... (Replicate webhooks and/or Fal image queues).'
        : undefined,
    usage: {
      method: 'POST',
      contentType: 'multipart/form-data',
      body: {
        prompt: 'string (required) - Text description of the image to generate',
        model: `string (optional) - Model identifier from database (defaults to "${DEFAULT_IMAGE_MODEL_IDENTIFIER}")`,
        enhancePrompt: 'boolean (optional) - If true, enhances the prompt using AI before generation',
        referenceImage: 'File (optional) - Reference image file to upload',
        aspectRatio: 'string (optional) - Aspect ratio (e.g., "16:9", "1:1")',
        size: 'string (optional) - Size in format "widthxheight"',
        n: 'number (optional) - Number of images to generate',
        seed: 'number (optional) - Seed for reproducible results',
        aspect_ratio: 'string (optional) - Replicate-specific aspect ratio',
        resolution: 'string (optional) - Output resolution',
        output_format: 'string (optional) - Output format (jpg, png, webp)',
      },
      response: {
        image: {
          url: 'string - Public URL of the generated image',
          mimeType: 'string - MIME type of the image',
        },
        images: 'array - Array of image objects (if multiple images generated)',
      },
    },
  });
}
