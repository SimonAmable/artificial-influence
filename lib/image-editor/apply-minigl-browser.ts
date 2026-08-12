import { applyGradingCpu } from "./grading-cpu"
import { applyFilmGrainToContext } from "./apply-film-grain"
import type { MiniGlPipeline } from "./minigl-params"

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
    img.src = url
  })
}

export async function gradeImageWithMiniGl(
  sourceUrl: string,
  pipeline: MiniGlPipeline
): Promise<string> {
  const img = await loadHtmlImage(sourceUrl)
  const width = img.naturalWidth
  const height = img.naturalHeight

  const glCanvas = document.createElement("canvas")
  glCanvas.width = width
  glCanvas.height = height

  const { minigl } = await import("@xdadda/mini-gl")
  const wgl = minigl(glCanvas, img, "srg")
  if (!wgl) {
    throw new Error("mini-gl: WebGL2 not available")
  }

  wgl.loadImage()

  if (pipeline.insta) {
    wgl.filterInsta(pipeline.insta, pipeline.insta.mix)
  }

  wgl.filterAdjustments(pipeline.adjustments ?? {})

  if (pipeline.highlightsShadows) {
    const [highlights, shadows] = pipeline.highlightsShadows
    wgl.filterHighlightsShadows(highlights, shadows)
  }

  wgl.paintCanvas()
  wgl.destroy()

  // WebGL canvas cannot acquire a 2D context — copy pixels out, then grain on 2D.
  const exportCanvas = document.createElement("canvas")
  exportCanvas.width = width
  exportCanvas.height = height
  const exportCtx = exportCanvas.getContext("2d")
  if (!exportCtx) {
    throw new Error("Canvas 2D not available")
  }

  exportCtx.drawImage(glCanvas, 0, 0, width, height)

  if (pipeline.grain > 0) {
    applyFilmGrainToContext(exportCtx, width, height, pipeline.grain)
  }

  return exportCanvas.toDataURL("image/jpeg", 0.92)
}

/** CPU fallback when WebGL2 is unavailable. */
export async function gradeImageWithCpu(
  sourceUrl: string,
  pipeline: MiniGlPipeline
): Promise<string> {
  const img = await loadHtmlImage(sourceUrl)
  const width = img.naturalWidth
  const height = img.naturalHeight
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D not available")
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, width, height)
  const graded = applyGradingCpu(imageData.data, width, height, pipeline)
  ctx.putImageData(new ImageData(graded, width, height), 0, 0)
  return canvas.toDataURL("image/jpeg", 0.92)
}

export async function gradeImage(
  sourceUrl: string,
  pipeline: MiniGlPipeline
): Promise<string> {
  try {
    return await gradeImageWithMiniGl(sourceUrl, pipeline)
  } catch {
    return await gradeImageWithCpu(sourceUrl, pipeline)
  }
}
