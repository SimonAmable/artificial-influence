import { ALL_FORMATS, BlobSource, Input, UrlSource } from "mediabunny"

function createMediaInput(fileOrUrl: File | string) {
  return typeof fileOrUrl === "string"
    ? new Input({
        formats: ALL_FORMATS,
        source: new UrlSource(fileOrUrl, {
          getRetryDelay: () => null,
        }),
      })
    : new Input({
        formats: ALL_FORMATS,
        source: new BlobSource(fileOrUrl),
      })
}

export async function getVideoDurationSeconds(fileOrUrl: File | string): Promise<number> {
  const input = createMediaInput(fileOrUrl)
  try {
    return await input.computeDuration()
  } finally {
    input.dispose()
  }
}

export async function getVideoDimensions(fileOrUrl: File | string): Promise<{ width: number; height: number }> {
  const input = createMediaInput(fileOrUrl)
  try {
    const videoTrack = await input.getPrimaryVideoTrack()
    if (!videoTrack) {
      throw new Error("No video track found")
    }
    return {
      width: videoTrack.displayWidth,
      height: videoTrack.displayHeight,
    }
  } finally {
    input.dispose()
  }
}

export async function getAudioDurationSeconds(file: File): Promise<number> {
  const input = createMediaInput(file)
  try {
    return await input.computeDuration()
  } finally {
    input.dispose()
  }
}

/** Natural pixel size for raster images / first frame of GIF (browser decode). */
export function getImageDimensionsFromFile(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Failed to read image dimensions"))
    }
    img.src = url
  })
}
