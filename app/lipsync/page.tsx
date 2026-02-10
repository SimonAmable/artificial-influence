"use client"

import * as React from "react"
import { GeneratorLayout } from "@/components/shared/layout/generator-layout"
import { LipsyncInputBox } from "@/components/tools/lipsync/lipsync-input-box"
import { LipsyncShowcaseCard } from "@/components/tools/lipsync/lipsync-showcase-card"
import { VideoDisplay } from "@/components/shared/display/video-display"
import { useLayoutMode } from "@/components/shared/layout/layout-mode-context"
import { ImageUpload } from "@/components/shared/upload/photo-upload"
import { AudioUploadValue } from "@/components/shared/upload/audio-upload"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

export default function LipsyncPage() {
  const layoutModeContext = useLayoutMode()
  
  if (!layoutModeContext) {
    throw new Error("LipsyncPage must be used within LayoutModeProvider")
  }
  
  const { layoutMode } = layoutModeContext

  // State management
  const [inputImage, setInputImage] = React.useState<ImageUpload | null>(null)
  const [inputAudio, setInputAudio] = React.useState<AudioUploadValue | null>(null)
  const [generatedVideos, setGeneratedVideos] = React.useState<string[]>([])
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Handle generation
  const handleGenerate = async () => {
    if (!inputImage?.file) {
      setError("Please upload an image")
      return
    }

    if (!inputAudio?.file) {
      setError("Please upload an audio file")
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      // Validate image file
      if (!inputImage.file.type.startsWith('image/')) {
        setError('Image must be a valid image file')
        setIsGenerating(false)
        return
      }
      
      // Validate audio file
      if (!inputAudio.file.type.startsWith('audio/')) {
        setError('Audio must be a valid audio file')
        setIsGenerating(false)
        return
      }
      
      // Validate file sizes (max 10MB for image, 20MB for audio)
      const maxImageSize = 10 * 1024 * 1024 // 10MB
      const maxAudioSize = 20 * 1024 * 1024 // 20MB
      
      if (inputImage.file.size > maxImageSize) {
        setError('Image is too large. Maximum size is 10MB.')
        setIsGenerating(false)
        return
      }
      
      if (inputAudio.file.size > maxAudioSize) {
        setError('Audio is too large. Maximum size is 20MB.')
        setIsGenerating(false)
        return
      }

      // Get authenticated user for Supabase upload
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        throw new Error('Please log in to generate lipsync videos')
      }

      // Upload image to Supabase Storage
      console.log('Uploading image to Supabase...')
      const imageExtension = inputImage.file.name.split('.').pop() || 'png'
      const imageTimestamp = Date.now()
      const imageRandomStr = Math.random().toString(36).substring(7)
      const imageFilename = `${imageTimestamp}-${imageRandomStr}.${imageExtension}`
      const imageStoragePath = `${user.id}/lipsync-images/${imageFilename}`

      const { error: imageUploadError } = await supabase.storage
        .from('public-bucket')
        .upload(imageStoragePath, inputImage.file, {
          contentType: inputImage.file.type,
          upsert: false,
        })

      if (imageUploadError) {
        throw new Error(`Failed to upload image: ${imageUploadError.message}`)
      }

      const { data: imageUrlData } = supabase.storage
        .from('public-bucket')
        .getPublicUrl(imageStoragePath)
      const imagePublicUrl = imageUrlData.publicUrl
      console.log('✓ Image uploaded:', imagePublicUrl)

      // Upload audio to Supabase Storage
      console.log('Uploading audio to Supabase...')
      const audioExtension = inputAudio.file.name.split('.').pop() || 'mp3'
      const audioTimestamp = Date.now()
      const audioRandomStr = Math.random().toString(36).substring(7)
      const audioFilename = `${audioTimestamp}-${audioRandomStr}.${audioExtension}`
      const audioStoragePath = `${user.id}/lipsync-audio/${audioFilename}`

      const { error: audioUploadError } = await supabase.storage
        .from('public-bucket')
        .upload(audioStoragePath, inputAudio.file, {
          contentType: inputAudio.file.type,
          upsert: false,
        })

      if (audioUploadError) {
        throw new Error(`Failed to upload audio: ${audioUploadError.message}`)
      }

      const { data: audioUrlData } = supabase.storage
        .from('public-bucket')
        .getPublicUrl(audioStoragePath)
      const audioPublicUrl = audioUrlData.publicUrl
      console.log('✓ Audio uploaded:', audioPublicUrl)

      // Send URLs to API route for lipsync generation
      console.log('Sending lipsync request with image and audio URLs')
      
      const response = await fetch('/api/generate-lipsync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: imagePublicUrl,
          audioUrl: audioPublicUrl,
          imageStoragePath,
          audioStoragePath,
          resolution: '720p', // Default to 720p, can be made configurable later
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.message || 'Failed to generate lipsync')
      }
      
      const data = await response.json()
      
      // Handle response - extract video URL and PREPEND to existing videos
      if (data.video?.url) {
        setGeneratedVideos(prev => [data.video.url, ...prev])
      } else {
        throw new Error('No video URL received from API')
      }
    } catch (err) {
      console.error('Error generating lipsync:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate lipsync')
    } finally {
      setIsGenerating(false)
    }
  }

  // Render generated video or showcase card
  const renderShowcase = () => {
    // Always show videos if we have videos OR are generating
    if (generatedVideos.length > 0 || isGenerating) {
      return <VideoDisplay videos={generatedVideos} isGenerating={isGenerating} />
    }

    // Show error state if there's an error and no videos
    if (error) {
      return (
        <Card className="w-full h-full flex flex-col">
          <CardContent className="flex flex-col items-center justify-center flex-1 p-8">
            <p className="text-destructive mb-4">{error}</p>
            <Button
              onClick={handleGenerate}
              variant="default"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      )
    }

    // Show empty state (LipsyncShowcaseCard) when no videos and not generating
    return (
      <LipsyncShowcaseCard
        title="CREATE YOUR"
        highlightedTitle="LIPSYNC VIDEO"
        description="Generate realistic lipsync videos by combining your image with audio."
        steps={[
          {
            mediaPath: "/lip_sync/step1_ref-Image.png",
            mediaType: "image",
            title: "UPLOAD IMAGE",
            description: "Upload an image of the person you want to lipsync.",
          },
          {
            mediaPath: "/lip_sync/step-2-best-speak.mp3",
            mediaType: "audio",
            title: "UPLOAD AUDIO",
            description: "Upload the audio file you want to sync with the image.",
          },
          {
            mediaPath: "/lip_sync/final.mp4",
            mediaType: "video",
            title: "GENERATE",
            description: "Generate your lipsync video with AI-powered processing.",
          },
        ]}
      />
    )
  }

  const isRowLayout = layoutMode === "row"
  const inputImageValue = inputImage ?? undefined
  const inputAudioValue = inputAudio ?? undefined

  return (
    <div className={cn(
      "min-h-screen bg-background flex flex-col",
      isRowLayout ? "p-0" : "p-4 sm:p-6 md:p-12"
    )}>
      <div className={cn(
        "mx-auto flex-1 flex flex-col",
        isRowLayout ? "w-full pt-20" : "max-w-7xl pt-12"
      )}>
        <GeneratorLayout layoutMode={layoutMode} className="h-full flex-1 min-h-0">
          {isRowLayout ? (
            // Row layout: Full-screen grid fills entire screen excluding header
            <>
              {/* Main Content - Full-screen grid fills entire screen excluding header */}
              <div className="flex-1 w-full h-full overflow-auto pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {renderShowcase()}
              </div>

              {/* Fixed Bottom Panel - Input Box (always visible) */}
              <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
                <div className="max-w-7xl mx-auto flex justify-center">
                  <LipsyncInputBox
                    forceRowLayout={true}
                    defaultImage={inputImageValue}
                    defaultAudio={inputAudioValue}
                    onImageChange={setInputImage}
                    onAudioChange={setInputAudio}
                    isGenerating={isGenerating}
                    onGenerate={handleGenerate}
                    photoUploadProps={{
                      title: "Upload Image",
                      description: "Click to upload image"
                    }}
                    audioUploadProps={{
                      title: "Upload Audio",
                      description: "Click to upload audio"
                    }}
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
                      <LipsyncInputBox
                        forceRowLayout={false}
                        defaultImage={inputImageValue}
                        defaultAudio={inputAudioValue}
                        onImageChange={setInputImage}
                        onAudioChange={setInputAudio}
                        isGenerating={isGenerating}
                        onGenerate={handleGenerate}
                        photoUploadProps={{
                          title: "Upload Image",
                          description: "Click to upload image"
                        }}
                        audioUploadProps={{
                          title: "Upload Audio",
                          description: "Click to upload audio"
                        }}
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
                  <LipsyncInputBox
                    forceRowLayout={false}
                    defaultImage={inputImageValue}
                    defaultAudio={inputAudioValue}
                    onImageChange={setInputImage}
                    onAudioChange={setInputAudio}
                    isGenerating={isGenerating}
                    onGenerate={handleGenerate}
                    photoUploadProps={{
                      title: "Upload Image",
                      description: "Click to upload image"
                    }}
                    audioUploadProps={{
                      title: "Upload Audio",
                      description: "Click to upload audio"
                    }}
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
