export type Size = { width: number; height: number }

type ConstrainedSizeOptions = {
  min?: number
  max?: number
}

export function getConstrainedSize(
  input: Size,
  opts: ConstrainedSizeOptions = {}
): Size {
  const min = opts.min ?? 200
  const max = opts.max ?? 500

  if (input.width <= 0 || input.height <= 0) {
    return { width: min, height: min }
  }

  const aspect = input.width / input.height
  let width = input.width
  let height = input.height

  if (width > height) {
    width = Math.min(max, Math.max(min, width))
    height = Math.round(width / aspect)
    if (height < min) {
      height = min
      width = Math.round(height * aspect)
    }
  } else {
    height = Math.min(max, Math.max(min, height))
    width = Math.round(height * aspect)
    if (width < min) {
      width = min
      height = Math.round(width / aspect)
    }
  }

  return { width, height }
}

export function loadImageSize(url: string): Promise<Size> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = url
  })
}

export function loadVideoSize(url: string): Promise<Size> {
  return new Promise((resolve) => {
    const video = document.createElement("video")
    video.preload = "metadata"

    video.onloadedmetadata = () => {
      resolve({ width: video.videoWidth, height: video.videoHeight })
    }
    video.onerror = () => resolve({ width: 1280, height: 720 })
    video.src = url
  })
}
