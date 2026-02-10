"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PhotoUpload, ImageUpload } from "@/components/shared/upload/photo-upload"
import { CircleNotch, Sparkle } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

export interface CharacterSwapInputBoxProps {
  className?: string
  characterImage?: ImageUpload | null
  sceneImage?: ImageUpload | null
  onCharacterImageChange?: (image: ImageUpload | null) => void
  onSceneImageChange?: (image: ImageUpload | null) => void
  onGenerate?: () => void
  isGenerating?: boolean
}

export function CharacterSwapInputBox({
  className,
  characterImage,
  sceneImage,
  onCharacterImageChange,
  onSceneImageChange,
  onGenerate,
  isGenerating = false,
}: CharacterSwapInputBoxProps) {
  const isReady = React.useMemo(() => {
    return Boolean(characterImage && sceneImage)
  }, [characterImage, sceneImage])

  return (
    <Card className={cn("w-full max-w-sm sm:max-w-lg lg:max-w-4xl relative", className)}>
      <CardContent className="p-3 sm:p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <PhotoUpload
            value={characterImage}
            onChange={onCharacterImageChange}
            title="Reference Character"
            description="Upload character image"
          />
          <PhotoUpload
            value={sceneImage}
            onChange={onSceneImageChange}
            title="Reference Scene"
            description="Upload scene image"
          />
        </div>

        <Button
          onClick={onGenerate}
          disabled={!isReady || isGenerating}
          className={cn("w-full min-h-[50px] text-sm font-semibold", !isReady && "opacity-50 cursor-not-allowed")}
        >
          {isGenerating ? (
            <>
              <CircleNotch className="size-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-sm font-semibold">Generate</span>
              <div className="flex items-center gap-0.5">
                <Sparkle size={8} weight="fill" />
                <span className="text-[10px]">4 credits</span>
              </div>
            </div>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
