"use client"

import * as React from "react"
import { GeneratorLayout } from "@/components/shared/layout/generator-layout"
import { MotionCopyInputBox } from "@/components/tools/motion-copy/motion-copy-input-box"
import { MotionCopyShowcaseCard } from "@/components/tools/motion-copy/motion-copy-showcase-card"
import { VideoDisplay } from "@/components/shared/display/video-display"
import { useLayoutMode } from "@/components/shared/layout/layout-mode-context"
import { ImageUpload } from "@/components/shared/upload/photo-upload"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

export default function MotionCopyPage() {
  const layoutModeContext = useLayoutMode()
  
  if (!layoutModeContext) {
    throw new Error("MotionCopyPage must be used within LayoutModeProvider")
  }
  
  const { layoutMode } = layoutModeContext

  // State management
  const [inputImage, setInputImage] = React.useState<ImageUpload | null>(null)
  const [inputVideo, setInputVideo] = React.useState<ImageUpload | null>(null)
  const [characterOrientation, setCharacterOrientation] = React.useState<string>("image")
  const [generatedVideos, setGeneratedVideos] = React.useState<string[]>([])
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Helper function to get video duration
  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src)
        resolve(video.duration)
      }
      
      video.onerror = () => {
        window.URL.revokeObjectURL(video.src)
        reject(new Error('Failed to load video metadata'))
      }
      
      video.src = URL.createObjectURL(file)
    })
  }

  // Handle generation
  const handleGenerate = async () => {
    if (!inputImage?.file) {
      setError("Please upload an image")
      return
    }

    if (!inputVideo?.file) {
      setError("Please upload a video")
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
      
      // Validate video file
      if (!inputVideo.file.type.startsWith('video/')) {
        setError('Video must be a valid video file')
        setIsGenerating(false)
        return
      }
      
      // Validate file sizes (max 10MB for image, 50MB for video)
      const maxImageSize = 10 * 1024 * 1024 // 10MB
      const maxVideoSize = 50 * 1024 * 1024 // 50MB
      
      if (inputImage.file.size > maxImageSize) {
        setError('Image is too large. Maximum size is 10MB.')
        setIsGenerating(false)
        return
      }
      
      if (inputVideo.file.size > maxVideoSize) {
        setError('Video is too large. Maximum size is 50MB.')
        setIsGenerating(false)
        return
      }

      // Validate video duration (max 10 seconds)
      try {
        const videoDuration = await getVideoDuration(inputVideo.file)
        const maxDuration = 10 // 10 seconds
        
        if (videoDuration > maxDuration) {
          setError(`Video duration must be 10 seconds or less. Your video is ${videoDuration.toFixed(1)} seconds.`)
          setIsGenerating(false)
          return
        }
      } catch (err) {
        console.error('Error validating video duration:', err)
        setError('Failed to validate video duration. Please try again.')
        setIsGenerating(false)
        return
      }

      // Get authenticated user for Supabase upload
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        throw new Error('Please log in to generate videos')
      }

      // Upload image to Supabase Storage
      console.log('Uploading image to Supabase...')
      const imageExtension = inputImage.file.name.split('.').pop() || 'png'
      const imageTimestamp = Date.now()
      const imageRandomStr = Math.random().toString(36).substring(7)
      const imageFilename = `${imageTimestamp}-${imageRandomStr}.${imageExtension}`
      const imageStoragePath = `${user.id}/reference-images/${imageFilename}`

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

      // Upload video to Supabase Storage
      console.log('Uploading video to Supabase...')
      const videoExtension = inputVideo.file.name.split('.').pop() || 'mp4'
      const videoTimestamp = Date.now()
      const videoRandomStr = Math.random().toString(36).substring(7)
      const videoFilename = `${videoTimestamp}-${videoRandomStr}.${videoExtension}`
      const videoStoragePath = `${user.id}/reference-videos/${videoFilename}`

      const { error: videoUploadError } = await supabase.storage
        .from('public-bucket')
        .upload(videoStoragePath, inputVideo.file, {
          contentType: inputVideo.file.type,
          upsert: false,
        })

      if (videoUploadError) {
        throw new Error(`Failed to upload video: ${videoUploadError.message}`)
      }

      const { data: videoUrlData } = supabase.storage
        .from('public-bucket')
        .getPublicUrl(videoStoragePath)
      const videoPublicUrl = videoUrlData.publicUrl
      console.log('✓ Video uploaded:', videoPublicUrl)

      // Send URLs to API route
      console.log('Sending motion copy request with image and video URLs')
      
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: imagePublicUrl,
          videoUrl: videoPublicUrl,
          imageStoragePath,
          videoStoragePath,
          prompt: '',
          mode: 'pro',
          keep_original_sound: true,
          character_orientation: characterOrientation,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.message || 'Failed to generate motion copy')
      }

      const data = await response.json()
      
      // Handle response - extract video URL and PREPEND to existing videos
      if (data.video?.url) {
        setGeneratedVideos(prev => [data.video.url, ...prev])
      } else {
        throw new Error('No video URL received from API')
      }
    } catch (err) {
      console.error('Error generating motion copy:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate motion copy')
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

    // Show empty state (MotionCopyShowcaseCard) when no images and not generating
    return (
      <MotionCopyShowcaseCard
        tool_title="MOTION COPY"
        title="CREATE YOUR"
        highlightedTitle="MOTION COPY"
        description="Generate dynamic motion copy by combining your image and video inputs."
        steps={[
          {
            mediaPath: "/motion_copy/step1_image.png",
            mediaType: "image",
            title: "UPLOAD IMAGE",
            description: "Upload an image to use as the base for your motion copy.",
          },
          {
            mediaPath: "/motion_copy/step2_video.mp4",
            mediaType: "video",
            title: "UPLOAD VIDEO",
            description: "Upload a video to combine with your image.",
          },
          {
            mediaPath: "/motion_copy/step_3_copy.mp4",
            mediaType: "video",
            title: "GENERATE",
            description: "Generate your motion copy with AI-powered processing.",
          },
        ]}
      />
    )
  }

  const isRowLayout = layoutMode === "row"
  const inputImageValue = inputImage ?? undefined
  const inputVideoValue = inputVideo ?? undefined
  const characterOrientationControl = (
    <div className="flex items-center gap-2 px-1">
      <Label htmlFor="character-orientation" className="text-xs text-muted-foreground">
        Character Orientation
      </Label>
      <Select
        value={characterOrientation}
        onValueChange={setCharacterOrientation}
      >
        <SelectTrigger id="character-orientation" className="h-7 text-xs w-fit min-w-[120px]">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="image" className="text-xs">image</SelectItem>
          <SelectItem value="video" className="text-xs">video</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <div className={cn(
      "min-h-screen bg-background flex flex-col",
      isRowLayout ? "p-0" : "px-4 pt-4 pb-0 sm:px-6 sm:pt-6 md:px-12 md:pt-[60px]"
    )}>
      <div className={cn(
        "mx-auto flex-1 flex flex-col",
        isRowLayout ? "w-full pt-20" : "max-w-7xl"
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
                  <MotionCopyInputBox
                    forceRowLayout={true}
                    defaultImage={inputImageValue}
                    defaultVideo={inputVideoValue}
                    onImageChange={setInputImage}
                    onVideoChange={setInputVideo}
                    photoUploadProps={{
                      title: "Upload Image",
                      description: "Click to upload image"
                    }}
                    videoUploadProps={{
                      title: "Upload Video",
                      description: "Click to upload video"
                    }}
                    isGenerating={isGenerating}
                    onGenerate={handleGenerate}
                    extraControls={characterOrientationControl}
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
                      <MotionCopyInputBox
                        forceRowLayout={false}
                        defaultImage={inputImageValue}
                        defaultVideo={inputVideoValue}
                        onImageChange={setInputImage}
                        onVideoChange={setInputVideo}
                        photoUploadProps={{
                          title: "Upload Image",
                          description: "Click to upload image"
                        }}
                        videoUploadProps={{
                          title: "Upload Video",
                          description: "Click to upload video"
                        }}
                        isGenerating={isGenerating}
                        onGenerate={handleGenerate}
                        extraControls={characterOrientationControl}
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
                  <MotionCopyInputBox
                    forceRowLayout={false}
                    defaultImage={inputImageValue}
                    defaultVideo={inputVideoValue}
                    onImageChange={setInputImage}
                    onVideoChange={setInputVideo}
                    photoUploadProps={{
                      title: "Upload Image",
                      description: "Click to upload image"
                    }}
                    videoUploadProps={{
                      title: "Upload Video",
                      description: "Click to upload video"
                    }}
                    isGenerating={isGenerating}
                    onGenerate={handleGenerate}
                    extraControls={characterOrientationControl}
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
