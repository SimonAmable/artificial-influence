"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, CircleNotch } from "@phosphor-icons/react"
import { toast } from "sonner"

import { PhotoUpload, type ImageUpload } from "@/components/shared/upload/photo-upload"
import { Button } from "@/components/ui/button"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import { carouselShotsHrefFromImage } from "@/lib/carousel-shots/constants"
import type { GuideCarouselUpload } from "@/lib/guides/types"

export function GuideCarouselUploadSection({
  upload,
}: {
  upload: GuideCarouselUpload
}) {
  const router = useRouter()
  const [image, setImage] = React.useState<ImageUpload | null>(null)
  const [isOpening, setIsOpening] = React.useState(false)

  const openInShots = React.useCallback(async () => {
    if (!image?.file && !image?.url) {
      toast.error("Upload a reference photo first")
      return
    }

    setIsOpening(true)
    try {
      let url = image.url?.trim() ?? ""
      if (image.file) {
        const uploaded = await uploadFileToSupabase(image.file, "carousel-shots-guide")
        if (!uploaded?.url) {
          throw new Error("Upload failed")
        }
        url = uploaded.url
      }
      if (!url) {
        throw new Error("Missing image URL")
      }
      router.push(carouselShotsHrefFromImage(url))
    } catch (error) {
      console.error("Failed to open Carousel Shots from guide:", error)
      toast.error(error instanceof Error ? error.message : "Could not open Carousel Shots")
      setIsOpening(false)
    }
  }, [image, router])

  return (
    <section className="flex flex-col gap-4 border-t border-border/70 pt-8">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {upload.heading ?? "Try it with your photo"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {upload.description ??
            "Upload a reference photo and jump straight into Carousel Shots with it prefilled."}
        </p>
      </div>

      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 sm:p-5">
        <PhotoUpload
          value={image}
          onChange={setImage}
          title="Reference photo"
          description="Upload one still. Keep the same face across every panel."
          maxHeight="max-h-[220px]"
          minHeight="min-h-[160px] sm:min-h-[180px]"
          previewFit="contain"
          className="w-full"
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="lg"
            disabled={isOpening || (!image?.file && !image?.url)}
            onClick={() => void openInShots()}
          >
            {isOpening ? (
              <>
                <CircleNotch className="size-4 animate-spin" />
                Opening…
              </>
            ) : (
              <>
                Open in Carousel Shots
                <ArrowRight data-icon="inline-end" className="size-4" />
              </>
            )}
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href="/carousel-shots">Open empty</a>
          </Button>
        </div>
      </div>
    </section>
  )
}
