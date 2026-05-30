import { z } from "zod"

export const slideshowProviderSchema = z.enum(["instagram", "tiktok"])
export const slideshowProjectStatusSchema = z.enum([
  "draft",
  "hooks_generated",
  "slides_generated",
  "draft_created",
])
export const slideshowSelectionModeSchema = z.enum(["random", "first", "manual"])

export const slideshowHookOptionSchema = z.object({
  id: z.string().trim().min(1).max(64),
  text: z.string().trim().min(1).max(180),
})

export const slideshowSlideSchema = z.object({
  index: z.number().int().min(0),
  overlayText: z.string().trim().min(1).max(220),
  collectionId: z.string().uuid(),
  collectionImageId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  assetUrl: z.string().url(),
  selectionMode: slideshowSelectionModeSchema,
  narrativeRole: z.string().trim().min(1).max(120).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
})
  .superRefine((value, ctx) => {
    if (!value.collectionImageId && !value.assetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["collectionImageId"],
        message: "collectionImageId is required",
      })
    }
  })
  .transform(({ assetId, collectionImageId, ...rest }) => ({
    ...rest,
    collectionImageId: collectionImageId ?? assetId!,
  }))

export const slideshowProjectHooksSchema = z.array(slideshowHookOptionSchema).max(20)
export const slideshowProjectSlidesSchema = z.array(slideshowSlideSchema).max(12)

export const slideshowCollectionImageSourceKindSchema = z.enum(["upload", "asset", "pinterest"])

export const slideshowCollectionItemSchema = z.object({
  id: z.string().uuid(),
  sourceKind: slideshowCollectionImageSourceKindSchema,
  sourceAssetId: z.string().uuid().nullable(),
  sourceUrl: z.string().url().nullable(),
  sourceQuery: z.string().trim().max(500).nullable(),
  title: z.string(),
  url: z.string().url(),
  thumbnailUrl: z.string().url().nullable(),
  tags: z.array(z.string()),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  sortOrder: z.number().int().min(0),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
})

export const slideshowCollectionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable(),
  items: z.array(slideshowCollectionItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const slideshowProjectSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  provider: slideshowProviderSchema,
  socialConnectionId: z.string().uuid(),
  brandKitId: z.string().uuid().nullable(),
  status: slideshowProjectStatusSchema,
  selectedHook: z.string().trim().min(1).max(180).nullable(),
  hookOptions: slideshowProjectHooksSchema,
  slides: slideshowProjectSlidesSchema,
  autopostJobId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const createSlideshowCollectionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
})

export const updateSlideshowCollectionSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  itemIds: z.array(z.string().uuid()).max(200).optional(),
})

export const slideshowCollectionUploadPayloadSchema = z.object({
  uploadId: z.string().uuid(),
  title: z.string().trim().min(1).max(160).optional(),
})

export const appendUploadedCollectionImagesSchema = z.object({
  uploads: z.array(slideshowCollectionUploadPayloadSchema).min(1).max(50),
})

export const appendAssetCollectionImagesSchema = z.object({
  assetIds: z.array(z.string().uuid()).min(1).max(50),
})

export const slideshowImportModeSchema = z.enum(["board_url", "search"])

export const slideshowImportCandidateSchema = z.object({
  id: z.string().trim().min(1).max(120),
  previewUrl: z.string().url(),
  sourceUrl: z.string().url(),
  title: z.string().trim().max(300).nullable(),
  description: z.string().trim().max(1000).nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  tags: z.array(z.string()).max(20).default([]),
})

export const previewSlideshowCollectionImportSchema = z.object({
  collectionId: z.string().uuid(),
  mode: slideshowImportModeSchema,
  query: z.string().trim().min(1).max(500),
  limit: z.number().int().min(1).max(50).default(50),
})

export const commitSlideshowCollectionImportSchema = z.object({
  collectionId: z.string().uuid(),
  jobId: z.string().uuid(),
  candidateIds: z.array(z.string().trim().min(1).max(120)).min(1).max(50),
})

export const createSlideshowProjectSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  socialConnectionId: z.string().uuid(),
  brandKitId: z.string().uuid(),
})

export const updateSlideshowProjectSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  socialConnectionId: z.string().uuid().optional(),
  brandKitId: z.string().uuid().nullable().optional(),
  selectedHook: z.string().trim().min(1).max(180).nullable().optional(),
  hookOptions: slideshowProjectHooksSchema.optional(),
  slides: slideshowProjectSlidesSchema.optional(),
  status: slideshowProjectStatusSchema.optional(),
  autopostJobId: z.string().uuid().nullable().optional(),
  slideUpdate: z
    .object({
      index: z.number().int().min(0),
      overlayText: z.string().trim().min(1).max(220).optional(),
      collectionId: z.string().uuid().optional(),
      collectionImageId: z.string().uuid().optional(),
      assetId: z.string().uuid().optional(),
      assetUrl: z.string().url().optional(),
      selectionMode: slideshowSelectionModeSchema.optional(),
      narrativeRole: z.string().trim().min(1).max(120).nullable().optional(),
      notes: z.string().trim().max(500).nullable().optional(),
    })
    .optional(),
})

export type SlideshowProvider = z.infer<typeof slideshowProviderSchema>
export type SlideshowProjectStatus = z.infer<typeof slideshowProjectStatusSchema>
export type SlideshowSelectionMode = z.infer<typeof slideshowSelectionModeSchema>
export type SlideshowHookOption = z.infer<typeof slideshowHookOptionSchema>
export type SlideshowSlide = z.infer<typeof slideshowSlideSchema>
export type SlideshowCollectionImageSourceKind = z.infer<typeof slideshowCollectionImageSourceKindSchema>
export type SlideshowCollectionItem = z.infer<typeof slideshowCollectionItemSchema>
export type SlideshowCollection = z.infer<typeof slideshowCollectionSchema>
export type SlideshowProject = z.infer<typeof slideshowProjectSchema>
export type SlideshowImportMode = z.infer<typeof slideshowImportModeSchema>
export type SlideshowImportCandidate = z.infer<typeof slideshowImportCandidateSchema>
