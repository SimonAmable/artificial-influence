import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import { absolutizeAssetUrl } from "@/lib/assets/absolutize-asset-url"
import { isPersistedReferenceImageUrl } from "@/lib/image/stored-reference-url"

/** Append reference images to generate-image FormData without re-uploading stored URLs. */
export function appendImageReferencesToFormData(
  formData: FormData,
  images: ImageUpload[],
): void {
  for (const image of images) {
    if (image.url && isPersistedReferenceImageUrl(image.url)) {
      formData.append("referenceImageUrls", absolutizeAssetUrl(image.url))
      continue
    }

    if (image.file) {
      formData.append("referenceImages", image.file)
    }
  }
}
