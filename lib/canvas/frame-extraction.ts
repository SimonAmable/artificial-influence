/**
 * Video frame extraction utilities for canvas nodes
 * Extracts frames from video files using HTML5 Canvas API
 */

export interface ExtractedFrame {
  blob: Blob
  url: string
  filename: string
  width: number
  height: number
}

/**
 * Extracts a frame from a video at a specific time
 * @param videoUrl - URL of the video file
 * @param targetTime - Time in seconds to extract frame, or 'first'/'last'
 * @param filename - Optional custom filename
 * @returns Promise that resolves with frame data
 */
export async function extractVideoFrame(
  videoUrl: string,
  targetTime: number | 'first' | 'last',
  filename?: string
): Promise<ExtractedFrame> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous' // Handle CORS for Supabase
    video.preload = 'metadata'

    video.onloadedmetadata = () => {
      // Determine target time
      let seekTime: number
      if (targetTime === 'first') {
        seekTime = 0
      } else if (targetTime === 'last') {
        seekTime = Math.max(0, video.duration - 0.1) // Slightly before end
      } else {
        seekTime = targetTime
      }

      video.currentTime = seekTime
    }

    video.onseeked = () => {
      try {
        // Create canvas and draw video frame
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        // Convert to blob
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to create image blob'))
            return
          }

          const url = URL.createObjectURL(blob)
          const frameFilename = filename || `frame-${Date.now()}.png`
          
          resolve({
            blob,
            url,
            filename: frameFilename,
            width: canvas.width,
            height: canvas.height,
          })
        }, 'image/png')
      } catch (error) {
        reject(error)
      }
    }

    video.onerror = () => {
      reject(new Error('Failed to load video'))
    }

    video.src = videoUrl
  })
}

/**
 * Extract first frame from video
 */
export async function extractFirstFrame(
  videoUrl: string,
  baseFilename?: string
): Promise<ExtractedFrame> {
  const filename = baseFilename 
    ? `${baseFilename}-first-frame.png`
    : `first-frame-${Date.now()}.png`
  return extractVideoFrame(videoUrl, 'first', filename)
}

/**
 * Extract last frame from video
 */
export async function extractLastFrame(
  videoUrl: string,
  baseFilename?: string
): Promise<ExtractedFrame> {
  const filename = baseFilename 
    ? `${baseFilename}-last-frame.png`
    : `last-frame-${Date.now()}.png`
  return extractVideoFrame(videoUrl, 'last', filename)
}
