import { generateImage } from 'ai';
import { replicate } from '@ai-sdk/replicate';
import { xai } from '@ai-sdk/xai';
import { NextRequest, NextResponse } from 'next/server';
import { enhancePrompt } from '@/lib/prompt-enhancement';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  console.log('[generate-image] ===== Request started =====');
  
  try {
    // Check for API token
    if (!process.env.REPLICATE_API_TOKEN) {
      console.error('[generate-image] REPLICATE_API_TOKEN not set');
      return NextResponse.json(
        { error: 'REPLICATE_API_TOKEN environment variable is not set' },
        { status: 500 }
      );
    }
    console.log('[generate-image] ✓ REPLICATE_API_TOKEN found');

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

    // Parse FormData
    console.log('[generate-image] Parsing FormData...');
    const formData = await request.formData();
    const prompt = formData.get('prompt') as string;
    const referenceImageFiles = formData.getAll('referenceImages') as File[];
    const enhancePromptValue = formData.get('enhancePrompt');
    const shouldEnhance = enhancePromptValue === 'true';
    const modelIdentifier = (formData.get('model') as string) || 'google/nano-banana'; // Default to nano-banana if not provided
    
    // Get optional parameters from form data
    const aspectRatio = formData.get('aspectRatio') as string | null;
    const size = formData.get('size') as string | null;
    const n = formData.get('n') ? parseInt(formData.get('n') as string) : null;
    const seed = formData.get('seed') ? parseInt(formData.get('seed') as string) : null;
    let aspect_ratio = formData.get('aspect_ratio') as string | null;
    const resolution = formData.get('resolution') as string | null;
    const output_format = formData.get('output_format') as string | null;

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
      console.log('[generate-image] Enhancing prompt...');
      try {
        const enhanceStartTime = Date.now();
        finalPrompt = await enhancePrompt(prompt, 'generate');
        const enhanceTime = Date.now() - enhanceStartTime;
        console.log('[generate-image] ✓ Prompt enhanced in', enhanceTime, 'ms');
        console.log('[generate-image] Enhanced prompt:', finalPrompt.substring(0, 100) + (finalPrompt.length > 100 ? '...' : ''));
      } catch (error) {
        console.error('[generate-image] Error enhancing prompt:', error);
        console.log('[generate-image] Continuing with original prompt');
        // Continue with original prompt if enhancement fails
      }
    } else {
      console.log('[generate-image] Prompt enhancement skipped');
    }

    // Prepare generateImage options
    console.log('[generate-image] Preparing generation options...');
    const isNanoBanana = modelIdentifier === 'google/nano-banana';

    // For image-editor-style edits with references, default nano-banana to input image ratio
    if (isNanoBanana && referenceImageUrls.length > 0 && !aspect_ratio && !aspectRatio) {
      aspect_ratio = 'match_input_image';
      console.log('[generate-image] Applied default aspect_ratio=match_input_image for nano-banana edit flow');
    }
    
    // Initialize model based on provider
    let imageModel;
    const provider = modelData.provider?.toLowerCase();
    
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
    
    // Use the selected model identifier
    const generateOptions: Parameters<typeof generateImage>[0] = {
      model: imageModel,
      prompt: finalPrompt, // Keep prompt as simple string
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

    if (n && typeof n === 'number' && n > 0) {
      generateOptions.n = n;
      console.log('[generate-image] Number of images set:', n);
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
      generateOptions.providerOptions.replicate = {
        // Optional: aspect_ratio, resolution, output_format, etc.
        ...(aspect_ratio && { aspect_ratio }),
        ...(resolution && { resolution }),
        ...(output_format && { output_format }),
        // Pass reference image URL(s) via image_input (as per Replicate API docs)
        ...(referenceImageUrls.length > 0 && { 
          image_input: referenceImageUrls // Array of URLs as expected by nano-banana
        }),
      };
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
      result = await generateImage(generateOptions);
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
      console.log('[generate-image] ===== Request completed successfully in', totalTime, 'ms =====');

      return NextResponse.json({
        images: imageUrls.map((url) => ({
          url,
          mimeType: 'image/png',
        })),
        warnings: result.warnings,
      });
    } else if (result.image) {
      // Single image
      const { url: imageUrl, storagePath: imageStoragePath } = await uploadImageToStorage(result.image.base64);

      // Save generation to database
      await saveGenerationToDatabase(imageStoragePath, referenceImageStoragePaths);

      const totalUploadTime = Date.now() - uploadStartTime;
      const totalTime = Date.now() - requestStartTime;
      console.log('[generate-image] ✓ Image uploaded in', totalUploadTime, 'ms');
      console.log('[generate-image] ===== Request completed successfully in', totalTime, 'ms =====');

      return NextResponse.json({
        image: {
          url: imageUrl,
          mimeType: 'image/png',
        },
        warnings: result.warnings,
        providerMetadata: result.providerMetadata,
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
    defaultModel: 'google/nano-banana',
    usage: {
      method: 'POST',
      contentType: 'multipart/form-data',
      body: {
        prompt: 'string (required) - Text description of the image to generate',
        model: 'string (optional) - Model identifier from database (defaults to "google/nano-banana")',
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
