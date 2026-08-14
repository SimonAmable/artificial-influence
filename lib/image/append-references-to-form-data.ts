import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import { absolutizeAssetUrl } from "@/lib/assets/absolutize-asset-url"
import { isStoredReferenceImageUrl } from "@/lib/image/is-stored-reference-image-url"

/** Append reference images to generate-image FormData without re-uploading stored URLs. */
export function appendImageReferencesToFormData(
  formData: FormData,
  images: ImageUpload[],
): void {
  for (const image of images) {
    // Local uploads must win over preview URLs (blob/data or stale signed URLs).
    if (image.file) {
      formData.append("referenceImages", image.file)
      continue
    }

    if (image.url && isStoredReferenceImageUrl(image.url)) {
      formData.append("referenceImageUrls", absolutizeAssetUrl(image.url))
    }
  }
}
