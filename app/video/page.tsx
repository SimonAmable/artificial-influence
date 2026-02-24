"use client"

import * as React from "react"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { GeneratorLayout } from "@/components/shared/layout/generator-layout"
import { VideoInputBox } from "@/components/tools/video/video-input-box"
import { VideoShowcaseCard } from "@/components/tools/video/video-showcase-card"
import { VideoGrid } from "@/components/shared/display/video-grid"
import { useLayoutMode } from "@/components/shared/layout/layout-mode-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useModels } from "@/hooks/use-models"
import { buildVideoModelParameters } from "@/lib/utils/video-model-parameters"
import type { Model, ParameterDefinition } from "@/lib/types/models"
import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import type { AudioUploadValue } from "@/components/shared/upload/audio-upload"
import type { MultiShotItem } from "@/components/tools/video/multi-shot-editor"

interface GeneratedVideo {
  url: string
  model: string
  timestamp: number
  parameters: Record<string, unknown>
}

function VideoPageContent() {
  const layoutModeContext = useLayoutMode()
  const searchParams = useSearchParams()
  
  if (!layoutModeContext) {
    throw new Error("VideoPage must be used within LayoutModeProvider")
  }
  
  const { layoutMode } = layoutModeContext

  const { models: videoModels, isLoading: modelsLoading } = useModels("video")

  // State management
  const [selectedModel, setSelectedModel] = React.useState<Model | null>(null)

  // Set default model when models load
  React.useEffect(() => {
    if (videoModels.length > 0 && !selectedModel) {
      const first = videoModels[0]
      setSelectedModel({
        ...first,
        parameters: { parameters: buildVideoModelParameters(first) },
      })
    }
  }, [videoModels, selectedModel])
  const [prompt, setPrompt] = React.useState("")
  const [negativePrompt, setNegativePrompt] = React.useState("")
  const [inputImage, setInputImage] = React.useState<ImageUpload | null>(null)
  const [lastFrameImage, setLastFrameImage] = React.useState<ImageUpload | null>(null)
  const [inputVideo, setInputVideo] = React.useState<ImageUpload | null>(null)
  const [inputAudio, setInputAudio] = React.useState<AudioUploadValue | null>(null)
  const [parameters, setParameters] = React.useState<Record<string, unknown>>({})
  const [multiShotMode, setMultiShotMode] = React.useState(false)
  const [multiShotShots, setMultiShotShots] = React.useState<MultiShotItem[]>([])
  const [referenceImages, setReferenceImages] = React.useState<ImageUpload[]>([])
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [generatedVideos, setGeneratedVideos] = React.useState<GeneratedVideo[]>([])

  // Handle pre-loaded start frame from URL parameter (only load once)
  const hasLoadedFromUrl = React.useRef(false)
  React.useEffect(() => {
    if (hasLoadedFromUrl.current) return
    
    const startFrameUrl = searchParams.get('startFrame')
    if (startFrameUrl) {
      try {
        const decodedUrl = decodeURIComponent(startFrameUrl)
        setInputImage({ url: decodedUrl })
        hasLoadedFromUrl.current = true
      } catch (err) {
        console.error('Failed to load start frame from URL:', err)
      }
    }
  }, [searchParams])

  // Initialize parameters when model changes
  React.useEffect(() => {
    if (!selectedModel) return
    const defaultParams: Record<string, unknown> = {}
    selectedModel.parameters.parameters.forEach((param: ParameterDefinition) => {
      defaultParams[param.name] = param.default
    })
    setParameters(defaultParams)
  }, [selectedModel])

  // Omni: when reference video is added, cap reference images at 4
  React.useEffect(() => {
    if (selectedModel?.identifier !== 'kwaivgi/kling-v3-omni-video') return
    if (inputVideo && referenceImages.length > 4) {
      setReferenceImages((prev) => prev.slice(0, 4))
    }
  }, [inputVideo, referenceImages.length, selectedModel?.identifier])

  // When switching to Kling v3 or Omni multi-shot, init one shot if empty
  React.useEffect(() => {
    const isKlingV3OrOmni =
      selectedModel?.identifier === 'kwaivgi/kling-v3-video' ||
      selectedModel?.identifier === 'kwaivgi/kling-v3-omni-video'
    if (isKlingV3OrOmni && multiShotMode && multiShotShots.length === 0) {
      const d = Number(parameters.duration) || 5
      setMultiShotShots([{ prompt: '', duration: d }])
    }
  }, [selectedModel?.identifier, multiShotMode, multiShotShots.length, parameters.duration])

  // Upload image to Supabase
  const uploadImageToSupabase = async (
    file: File,
    userId: string,
    prefix: string
  ): Promise<{ url: string; storagePath: string }> => {
    const supabase = createClient()
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(7)
    const filename = `${timestamp}-${randomStr}.${fileExtension}`
    const storagePath = `${userId}/${prefix}/${filename}`

    const { error: uploadError } = await supabase.storage
      .from('public-bucket')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`Failed to upload image: ${uploadError.message}`)
    }

    const { data: urlData } = supabase.storage
      .from('public-bucket')
      .getPublicUrl(storagePath)

    return { url: urlData.publicUrl, storagePath }
  }

  // Handle generation
  const handleGenerate = async () => {
    if (!selectedModel) {
      setError("Please select a model")
      return
    }

    const isMotionCopy = selectedModel.identifier === 'kwaivgi/kling-v2.6-motion-control'
    const isKlingV3 = selectedModel.identifier === 'kwaivgi/kling-v3-video'
    const isKlingV3Omni = selectedModel.identifier === 'kwaivgi/kling-v3-omni-video'
    const isLipsync =
      selectedModel.identifier.includes('lipsync') ||
      selectedModel.identifier.includes('wav2lip') ||
      selectedModel.identifier === 'veed/fabric-1.0'

    if ((isKlingV3 || isKlingV3Omni) && multiShotMode && multiShotShots.length > 0) {
      const totalDuration = Number(parameters.duration) || 5
      const sum = multiShotShots.reduce((acc, s) => acc + s.duration, 0)
      if (sum !== totalDuration) {
        setError(`Multi-shot total (${sum}s) must equal duration (${totalDuration}s)`)
        return
      }
      const hasEmptyPrompt = multiShotShots.some((s) => !s.prompt.trim())
      if (hasEmptyPrompt) {
        setError("Each multi-shot must have a prompt")
        return
      }
    }
    
    // Validation based on model type
    if (isMotionCopy) {
      if (!inputImage?.file) {
        setError("Please upload an image")
        return
      }
      if (!inputVideo?.file) {
        setError("Please upload a video")
        return
      }
    } else if (isLipsync) {
      if (!inputImage?.file) {
        setError("Please upload an image")
        return
      }
      if (!inputAudio?.file) {
        setError("Please upload an audio file")
        return
      }
    } else if (!prompt.trim()) {
      const allowNoPrompt = (isKlingV3 || isKlingV3Omni) && (
        (multiShotMode && multiShotShots.length > 0) || !!inputImage
      )
      if (!allowNoPrompt) {
        setError("Please enter a prompt")
        return
      }
    }

    setIsGenerating(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        throw new Error("Please log in to generate videos")
      }

      // Build request body based on model
      // Exclude prompt, image, video from parameters since they're managed separately
      const { prompt: _prompt, image: _image, video: _video, ...otherParameters } = parameters
      const requestBody: Record<string, unknown> = {
        model: selectedModel.identifier,
        prompt,
        ...otherParameters,
      }

      // Handle motion copy uploads
      if (isMotionCopy && inputImage?.file && inputVideo?.file) {
        const imageUpload = await uploadImageToSupabase(inputImage.file, user.id, 'motion-copy-images')
        const videoUpload = await uploadImageToSupabase(inputVideo.file, user.id, 'motion-copy-videos')
        requestBody.imagePublicUrl = imageUpload.url
        requestBody.videoPublicUrl = videoUpload.url
      }
      
      // Handle lipsync uploads
      else if (isLipsync && inputImage?.file && inputAudio?.file) {
        const imageUpload = await uploadImageToSupabase(inputImage.file, user.id, 'lipsync-images')
        const audioUpload = await uploadImageToSupabase(inputAudio.file, user.id, 'lipsync-audio')
        requestBody.imageUrl = imageUpload.url
        requestBody.audioUrl = audioUpload.url
        requestBody.imageStoragePath = imageUpload.storagePath
        requestBody.audioStoragePath = audioUpload.storagePath
      }
      
      // Handle other models with image uploads
      else if (inputImage?.file) {
        const imageUpload = await uploadImageToSupabase(inputImage.file, user.id, 'video-gen-input-images')
        if (selectedModel.identifier === 'kwaivgi/kling-v2.6') {
          requestBody.start_image = imageUpload.url
        } else if (isKlingV3 || isKlingV3Omni) {
          requestBody.start_image = imageUpload.url
        } else {
          requestBody.image = imageUpload.url
        }
        // For first_frame_image parameter (Hailuo)
        if (selectedModel.identifier === 'minimax/hailuo-2.3-fast') {
          requestBody.first_frame_image = imageUpload.url
        }
      }
      // Handle pre-loaded images from URL (no file to upload)
      else if (inputImage?.url) {
        if (selectedModel.identifier === 'kwaivgi/kling-v2.6') {
          requestBody.start_image = inputImage.url
        } else if (isKlingV3 || isKlingV3Omni) {
          requestBody.start_image = inputImage.url
        } else {
          requestBody.image = inputImage.url
        }
        // For first_frame_image parameter (Hailuo)
        if (selectedModel.identifier === 'minimax/hailuo-2.3-fast') {
          requestBody.first_frame_image = inputImage.url
        }
      }

      if (lastFrameImage?.file && (selectedModel.identifier === 'google/veo-3.1-fast' || isKlingV3 || isKlingV3Omni)) {
        const lastFrameUpload = await uploadImageToSupabase(lastFrameImage.file, user.id, 'video-gen-last-frames')
        requestBody.last_frame = lastFrameUpload.url
        if (isKlingV3 || isKlingV3Omni) requestBody.end_image = lastFrameUpload.url
      }
      if (lastFrameImage?.url && (isKlingV3 || isKlingV3Omni)) {
        requestBody.end_image = lastFrameImage.url
      }

      if (negativePrompt && (selectedModel.identifier === 'google/veo-3.1-fast' || isKlingV3 || isKlingV3Omni)) {
        requestBody.negative_prompt = negativePrompt
      }

      if ((isKlingV3 || isKlingV3Omni) && multiShotMode && multiShotShots.length > 0) {
        requestBody.multi_prompt = JSON.stringify(multiShotShots)
        requestBody.prompt = multiShotShots[0]?.prompt ?? prompt
      }

      // Kling v3 Omni: reference video (editing or style reference)
      if (isKlingV3Omni && inputVideo?.file) {
        const videoUpload = await uploadImageToSupabase(inputVideo.file, user.id, 'video-gen-reference-videos')
        requestBody.reference_video = videoUpload.url
      }
      if (isKlingV3Omni && inputVideo?.url) {
        requestBody.reference_video = inputVideo.url
      }

      // Kling v3 Omni: reference images (elements, scenes, styles). Max 7 without video, 4 with video.
      if (isKlingV3Omni && referenceImages.length > 0) {
        const refUrls: string[] = []
        for (const ref of referenceImages) {
          if (ref.file) {
            const up = await uploadImageToSupabase(ref.file, user.id, 'video-gen-reference-images')
            refUrls.push(up.url)
          } else if (ref.url) {
            refUrls.push(ref.url)
          }
        }
        if (refUrls.length > 0) requestBody.reference_images = refUrls
      }

      // Grok Imagine Video: reference video for video editing mode
      if (inputVideo?.file && selectedModel.identifier === 'xai/grok-imagine-video') {
        const videoUpload = await uploadImageToSupabase(inputVideo.file, user.id, 'video-gen-reference-videos')
        requestBody.video = videoUpload.url
      }

      requestBody.tool = isLipsync ? 'lipsync' : 'video'

      console.log('Sending video generation request:', requestBody)

      const endpoint = isLipsync ? '/api/generate-lipsync' : '/api/generate-video-any-model'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.message || 'Failed to generate video')
      }

      const data = await response.json()

      if (data.videoUrl) {
        const newVideo: GeneratedVideo = {
          url: data.videoUrl,
          model: selectedModel.name,
          timestamp: Date.now(),
          parameters: { ...parameters, prompt },
        }
        setGeneratedVideos(prev => [newVideo, ...prev])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Generation error:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  // Render showcase
  const renderShowcase = () => {
    // Always show grid if we have videos OR are generating
    if (generatedVideos.length > 0 || isGenerating) {
      return <VideoGrid videos={generatedVideos} isGenerating={isGenerating} />
    }

    // Show error state if there's an error and no videos
    if (error) {
      return (
        <Card className="w-full h-full flex flex-col">
          <CardContent className="flex flex-col items-center justify-center flex-1 p-8">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={handleGenerate} variant="default">
              Try Again
            </Button>
          </CardContent>
        </Card>
      )
    }

    // Show showcase card when no videos and not generating
    return (
      <VideoShowcaseCard
        tool_title=""
        title=""
        highlightedTitle="Video Generation"
        description="Create stunning AI-generated videos with state-of-the-art models."
        steps={[
          {
            mediaPath: "/motion_copy/motion_copy_with_overlay.mp4",
            title: "",
            description: "",
            mediaType: "video",
          },
        ]}
      />
    )
  }

  const isRowLayout = layoutMode === "row"

  if (modelsLoading || !selectedModel) {
    if (!modelsLoading && videoModels.length === 0) {
      return (
        <div className="flex h-screen items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">No video models available.</p>
        </div>
      )
    }
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading models...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "h-screen bg-background overflow-hidden flex flex-col",
      isRowLayout ? "p-0" : "p-4 sm:p-6 md:p-12"
    )}>
      <div className={cn(
        "mx-auto overflow-hidden flex-1 min-h-0 flex flex-col",
        isRowLayout ? "w-full pt-20" : "max-w-7xl pt-12"
      )}>
        <GeneratorLayout layoutMode={layoutMode} className="h-full flex-1 min-h-0">
          {isRowLayout ? (
            // Row layout: Full-screen grid fills entire screen excluding header
            <>
              {/* Main Content - Full-screen grid */}
              <div className="flex-1 w-full h-full overflow-auto pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {renderShowcase()}
              </div>

              {/* Fixed Bottom Panel - Input Box */}
              <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
                <div className="max-w-7xl mx-auto flex justify-center">
                  <VideoInputBox
                    videoModels={videoModels}
                    forceRowLayout={true}
                    promptValue={prompt}
                    onPromptChange={setPrompt}
                    negativePromptValue={negativePrompt}
                    onNegativePromptChange={setNegativePrompt}
                    selectedModel={selectedModel!}
                    onModelChange={setSelectedModel}
                    inputImage={inputImage}
                    onInputImageChange={setInputImage}
                    lastFrameImage={lastFrameImage}
                    onLastFrameChange={setLastFrameImage}
                    inputVideo={inputVideo}
                    onInputVideoChange={setInputVideo}
                    inputAudio={inputAudio}
                    onInputAudioChange={setInputAudio}
                    parameters={parameters}
                    onParametersChange={setParameters}
                    isGenerating={isGenerating}
                    onGenerate={handleGenerate}
                    multiShotMode={multiShotMode}
                    onMultiShotModeChange={setMultiShotMode}
                    multiShotShots={multiShotShots}
                    onMultiShotShotsChange={setMultiShotShots}
                    referenceImages={referenceImages}
                    onReferenceImagesChange={setReferenceImages}
                  />
                </div>
              </div>
            </>
          ) : (
            // Column layout: Side by side on desktop, stacked on mobile
            <>
              {/* Main Content */}
              <div className="w-full flex-1 min-h-0 lg:pb-0">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 sm:gap-6 lg:gap-12 h-full">
                  {/* Left Panel - Input Box (hidden on mobile, shown on desktop) */}
                  <div className="hidden lg:block lg:sticky lg:top-0 h-fit">
                    <div className="flex justify-center">
                      <VideoInputBox
                        videoModels={videoModels}
                        forceRowLayout={false}
                        promptValue={prompt}
                        onPromptChange={setPrompt}
                        negativePromptValue={negativePrompt}
                        onNegativePromptChange={setNegativePrompt}
                        selectedModel={selectedModel!}
                        onModelChange={setSelectedModel}
                        inputImage={inputImage}
                        onInputImageChange={setInputImage}
                        lastFrameImage={lastFrameImage}
                        onLastFrameChange={setLastFrameImage}
                        inputVideo={inputVideo}
                        onInputVideoChange={setInputVideo}
                        inputAudio={inputAudio}
                        onInputAudioChange={setInputAudio}
                        parameters={parameters}
                        onParametersChange={setParameters}
                        isGenerating={isGenerating}
                        onGenerate={handleGenerate}
                        multiShotMode={multiShotMode}
                        onMultiShotModeChange={setMultiShotMode}
                        multiShotShots={multiShotShots}
                        onMultiShotShotsChange={setMultiShotShots}
                        referenceImages={referenceImages}
                        onReferenceImagesChange={setReferenceImages}
                      />
                    </div>
                  </div>

                  {/* Right Panel - Showcase (full-screen grid) */}
                  <div className="w-full h-full overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {renderShowcase()}
                  </div>
                </div>
              </div>

              {/* Fixed Bottom Panel - Input Box (mobile only) */}
              <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 lg:hidden">
                <div className="max-w-7xl mx-auto flex justify-center">
                  <VideoInputBox
                    videoModels={videoModels}
                    forceRowLayout={false}
                    promptValue={prompt}
                    onPromptChange={setPrompt}
                    negativePromptValue={negativePrompt}
                    onNegativePromptChange={setNegativePrompt}
                    selectedModel={selectedModel!}
                    onModelChange={setSelectedModel}
                    inputImage={inputImage}
                    onInputImageChange={setInputImage}
                    lastFrameImage={lastFrameImage}
                    onLastFrameChange={setLastFrameImage}
                    inputVideo={inputVideo}
                    onInputVideoChange={setInputVideo}
                    inputAudio={inputAudio}
                    onInputAudioChange={setInputAudio}
                    parameters={parameters}
                    onParametersChange={setParameters}
                    isGenerating={isGenerating}
                    onGenerate={handleGenerate}
                    multiShotMode={multiShotMode}
                    onMultiShotModeChange={setMultiShotMode}
                    multiShotShots={multiShotShots}
                    onMultiShotShotsChange={setMultiShotShots}
                    referenceImages={referenceImages}
                    onReferenceImagesChange={setReferenceImages}
                  />
                </div>
              </div>
            </>
          )}
        </GeneratorLayout>
      </div>
    </div>
  )
}

export default function VideoPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <VideoPageContent />
    </Suspense>
  )
}
