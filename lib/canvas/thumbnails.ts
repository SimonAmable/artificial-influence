import { toPng } from "html-to-image"
import { createClient } from "@/lib/supabase/client"

/**
 * Generate a thumbnail image of the React Flow canvas and upload to Supabase Storage
 * 
 * @param canvasElement - The HTML element containing the React Flow canvas
 * @param canvasId - The ID of the canvas to associate with the thumbnail
 * @param userId - The user ID for storage path
 * @returns The public URL of the uploaded thumbnail, or null if generation failed
 */
export async function generateAndUploadThumbnail(
  canvasElement: HTMLElement,
  canvasId: string,
  userId: string
): Promise<string | null> {
  try {
    // Generate PNG blob from the canvas element
    const dataUrl = await toPng(canvasElement, {
      quality: 0.8,
      backgroundColor: "#ffffff",
      cacheBust: true,
      pixelRatio: 1, // Lower resolution for thumbnails
      width: 800, // Max width for thumbnail
      height: 600, // Max height for thumbnail
    })

    // Convert data URL to blob
    const blob = await dataUrlToBlob(dataUrl)

    // Upload to Supabase Storage
    const supabase = createClient()
    const path = `${userId}/canvas-data/${canvasId}/thumbnail.png`

    const { error: uploadError } = await supabase.storage
      .from("public-bucket")
      .upload(path, blob, {
        contentType: "image/png",
        upsert: true, // Replace existing thumbnail
      })

    if (uploadError) {
      console.error("Error uploading thumbnail:", uploadError)
      return null
    }

    // Get public URL
    const { data } = supabase.storage
      .from("public-bucket")
      .getPublicUrl(path)

    return data.publicUrl
  } catch (error) {
    console.error("Error generating thumbnail:", error)
    return null
  }
}

/**
 * Convert data URL to Blob
 */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl)
  return response.blob()
}

/**
 * Delete a canvas thumbnail from Supabase Storage
 */
export async function deleteThumbnail(
  thumbnailUrl: string
): Promise<void> {
  try {
    const supabase = createClient()
    
    // Extract path from URL
    const url = new URL(thumbnailUrl)
    const match = url.pathname.match(/\/public-bucket\/(.+)/)
    
    if (!match) {
      console.error("Invalid thumbnail URL format")
      return
    }

    const path = match[1]
    
    const { error } = await supabase.storage
      .from("public-bucket")
      .remove([path])

    if (error) {
      console.error("Error deleting thumbnail:", error)
    }
  } catch (error) {
    console.error("Error deleting thumbnail:", error)
  }
}
