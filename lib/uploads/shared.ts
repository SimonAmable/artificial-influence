export const DEFAULT_UPLOAD_BUCKET = "public-bucket"
export const PRIVATE_UPLOAD_BUCKET = "private-bucket"

export type UploadBucket = typeof DEFAULT_UPLOAD_BUCKET | typeof PRIVATE_UPLOAD_BUCKET | string

export type UploadFileType = "image" | "video" | "audio" | "other"

export type UploadSource = string

export type UploadDescriptor = {
  bucket: UploadBucket
  source: UploadSource
  contentHash: string
  storagePath: string
  mimeType: string
  originalFileName: string
  sizeBytes: number
  fileType: UploadFileType
  label: string | null
  uploadId?: string
  url?: string
  deduped?: boolean
}

export type RegisterUploadRequest = {
  bucket?: UploadBucket
  source?: UploadSource
  contentHash: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

export type UploadResponsePayload = {
  uploadId: string
  bucket: UploadBucket
  storagePath: string
  url: string
  mimeType: string
  fileName: string
  fileType: UploadFileType
  sizeBytes: number
  deduped: boolean
}

export type RegisterUploadResponse =
  | {
      status: "existing"
      upload: UploadResponsePayload
    }
  | {
      status: "upload-required"
      bucket: UploadBucket
      storagePath: string
      token: string
    }

export type FinalizeUploadRequest = {
  bucket?: UploadBucket
  source?: UploadSource
  contentHash: string
  storagePath: string
  fileName: string
  mimeType: string
  sizeBytes: number
}
