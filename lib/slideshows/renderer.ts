import "server-only"

import sharp from "sharp"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  getSlideshowProject,
  updateSlideshowProject,
} from "@/lib/slideshows/database-server"
import {
  overlaySvgBackground,
  overlaySvgFontSize,
  overlaySvgLineHeight,
  renderOverlaySvgLines,
} from "@/lib/slideshows/overlay-text-style"
import type { ResolvedSlideshowSlide, SlideshowAspectRatio } from "@/lib/slideshows/types"
import { slideUsesOverlayText } from "@/lib/slideshows/text-treatment"

const OUTPUT_BUCKET = "public-bucket"

function dimensionsForRatio(ratio: SlideshowAspectRatio) {
  if (ratio === "4:5") return { width: 1080, height: 1350 }
  if (ratio === "1:1") return { width: 1080, height: 1080 }
  return { width: 1080, height: 1920 }
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  })[char]!)
}

function wrapText(value: string, max = 28) {
  const words = value.trim().split(/\s+/)
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    if (`${line} ${word}`.trim().length > max && line) {
      lines.push(line)
      line = word
    } else {
      line = `${line} ${word}`.trim()
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 8)
}

function overlaySvg(slide: ResolvedSlideshowSlide, width: number, height: number) {
  if (!slideUsesOverlayText(slide)) return null
  const visible = slide.overlays.filter((overlay) => overlay.resolvedText.trim().length > 0)
  if (visible.length === 0) return null
  const groups = visible.map((overlay, overlayIndex) => {
    const lines = wrapText(overlay.resolvedText).map(escapeXml)
    const lineHeight = overlaySvgLineHeight(overlay.style)
    const fontSize = overlaySvgFontSize(overlay.style)
    const blockHeight = Math.max(lineHeight, lines.length * lineHeight)
    const baseY = overlay.position === "top"
      ? 180 + overlayIndex * 150
      : overlay.position === "bottom"
        ? height - blockHeight - 180 - overlayIndex * 150
        : height / 2 - blockHeight / 2 + overlayIndex * 150
    return [
      overlaySvgBackground(overlay.style, blockHeight, baseY, width),
      renderOverlaySvgLines({
        style: overlay.style,
        lines,
        x: width / 2,
        baseY,
        lineHeight,
        fontSize,
      }),
    ].join("")
  }).join("")
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${groups}</svg>`)
}

async function uploadSlide(userId: string, projectId: string, index: number, buffer: Buffer) {
  const supabase = createServiceRoleClient()
  if (!supabase) throw new Error("Server storage is not configured.")
  const path = `${userId}/slideshows/${projectId}/slide-${String(index + 1).padStart(2, "0")}.png`
  const { error } = await supabase.storage.from(OUTPUT_BUCKET).upload(path, buffer, {
    contentType: "image/png",
    upsert: true,
  })
  if (error) throw new Error(error.message)
  return supabase.storage.from(OUTPUT_BUCKET).getPublicUrl(path).data.publicUrl
}

export async function renderSlideshowProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
) {
  const project = await getSlideshowProject(supabase, userId, projectId)
  if (!project) throw new Error("Slideshow project not found.")
  if (!project.slides.every((slide) => slide.status === "ready" && slide.sourceImageUrl)) {
    throw new Error("Resolve every slide before rendering.")
  }

  await updateSlideshowProject(supabase, userId, project.id, { status: "rendering" })
  const { width, height } = dimensionsForRatio(project.aspectRatio)
  const outputUrls: string[] = []
  const nextSlides: ResolvedSlideshowSlide[] = []

  try {
    for (const slide of [...project.slides].sort((a, b) => a.index - b.index)) {
      const response = await fetch(slide.sourceImageUrl!)
      if (!response.ok) throw new Error(`Could not load slide ${slide.index + 1} image.`)
      let pipeline = sharp(Buffer.from(await response.arrayBuffer()))
        .resize(width, height, { fit: "cover", position: "centre" })
        .png()
      const svg = overlaySvg(slide, width, height)
      if (svg) pipeline = pipeline.composite([{ input: svg, top: 0, left: 0 }])
      const buffer = await pipeline.toBuffer()
      const url = await uploadSlide(userId, project.id, slide.index, buffer)
      outputUrls.push(url)
      nextSlides.push({ ...slide, finalImageUrl: url })
    }

    return updateSlideshowProject(supabase, userId, project.id, {
      slides: nextSlides,
      renderedSlideUrls: outputUrls,
      status: "rendered",
      errorMessage: null,
    })
  } catch (error) {
    await updateSlideshowProject(supabase, userId, project.id, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Failed to render slideshow.",
    })
    throw error
  }
}

