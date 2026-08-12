import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import { absolutizeAssetUrl } from "@/lib/assets/absolutize-asset-url"
import { isStoredReferenceImageUrl } from "@/lib/image/is-stored-reference-image-url"

/** Append reference images to generate-image FormData without re-uploading stored URLs. */
export function appendImageReferencesToFormData(
  formData: FormData,
  images: ImageUpload[],
): void {
  for (const image of images) {
    if (image.url && isStoredReferenceImageUrl(image.url)) {
      formData.append("referenceImageUrls", absolutizeAssetUrl(image.url))
      continue
    }

    if (image.file) {
      formData.append("referenceImages", image.file)
    }
  }
}
