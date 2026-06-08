import { z } from "zod"

export const slideshowAspectRatioSchema = z.enum(["9:16", "4:5", "1:1"])
export const slideshowVariationSchema = z.enum(["fixed", "fresh_each_run", "prefer_unused"])
export const slideshowVisualSourceSchema = z.enum(["collection", "generate", "reuse", "manual"])
export const slideshowTemplateOriginSchema = z.enum(["generated", "saved", "starter", "cloned"])
export const slideshowProjectStatusSchema = z.enum([
  "planning",
  "resolving",
  "ready",
  "rendering",
  "rendered",
  "failed",
])

export const slideshowOverlaySchema = z.object({
  id: z.string().trim().min(1).max(80),
  role: z.string().trim().min(1).max(80),
  prompt: z.string().trim().max(1000).default(""),
  resolvedText: z.string().trim().max(500).default(""),
  position: z.enum(["top", "center", "bottom"]).default("center"),
  style: z.enum(["clean", "caption", "impact", "minimal"]).default("minimal"),
  locked: z.boolean().default(false),
  variation: slideshowVariationSchema.default("fresh_each_run"),
})

export const slideshowContentSchema = z.object({
  role: z.string().trim().min(1).max(100),
  prompt: z.string().trim().min(1).max(2000),
  resolvedText: z.string().trim().max(1200).default(""),
  variation: slideshowVariationSchema.default("fresh_each_run"),
  locked: z.boolean().default(false),
})

export const slideshowSlideKindSchema = z.enum(["ai", "pack", "custom", "character"])
export const slideshowTextModeSchema = z.enum(["off", "overlay"])
export const slideshowTextTreatmentSchema = z.enum(["off", "overlay"])
export const slideshowTextModeStoredSchema = z.enum(["off", "overlay", "auto", "baked"])
export const slideshowTextTreatmentStoredSchema = z.enum(["off", "overlay", "inherit", "baked"])
export const slideshowCharacterModeSchema = z.enum(["generate", "edit_pack"])
export const slideshowTemplateModeSchema = z.enum(["product", "custom"])

export const slideshowTemplateTextDefaultsSchema = z.object({
  fontSize: z.enum(["normal", "small"]).default("normal"),
  textWidth: z.enum(["wide", "narrow"]).default("narrow"),
  style: z.enum(["clean", "caption", "impact", "minimal"]).default("minimal"),
})

export const slideshowTemplateSettingsSchema = z.object({
  brandKitId: z.string().uuid().nullable().default(null),
  mode: slideshowTemplateModeSchema.default("custom"),
  language: z.string().trim().max(12).default("en"),
  textMode: slideshowTextModeSchema.default("off"),
  textDefaults: slideshowTemplateTextDefaultsSchema.default({
    fontSize: "normal",
    textWidth: "narrow",
    style: "minimal",
  }),
  defaultCharacterAssetId: z.string().uuid().nullable().default(null),
  defaultCharacterPreviewUrl: z.string().url().nullable().default(null),
})

export const slideshowReferenceImageSchema = z.object({
  assetId: z.string().uuid().nullable().default(null),
  url: z.string().url(),
  title: z.string().trim().max(160).optional(),
})

export const slideshowVisualRecipeSchema = z.object({
  source: slideshowVisualSourceSchema,
  collectionId: z.string().uuid().nullable().default(null),
  prompt: z.string().trim().max(4000).default(""),
  aiEditPrompt: z.string().trim().max(4000).nullable().default(null),
  reuseSlideId: z.string().trim().max(80).nullable().default(null),
  variation: slideshowVariationSchema.default("prefer_unused"),
  modelIdentifier: z.string().trim().max(160).nullable().default(null),
  locked: z.boolean().default(false),
  manualAssetId: z.string().uuid().nullable().default(null),
  manualImageUrl: z.string().url().nullable().default(null),
  referenceImages: z.array(slideshowReferenceImageSchema).max(8).default([]),
})

export const slideshowSlideBlueprintSchema = z.object({
  id: z.string().trim().min(1).max(80),
  role: z.string().trim().min(1).max(100),
  slideKind: slideshowSlideKindSchema.optional(),
  characterMode: slideshowCharacterModeSchema.optional(),
  characterReferenceAssetId: z.string().uuid().nullable().optional(),
  characterReferenceUrl: z.string().url().nullable().optional(),
  textTreatment: slideshowTextTreatmentSchema.default("off"),
  content: slideshowContentSchema,
  visual: slideshowVisualRecipeSchema,
  overlays: z.array(slideshowOverlaySchema).max(8).default([]),
})

export const slideshowBlueprintSchema = z.object({
  creativeDirection: z.string().trim().max(3000).default(""),
  settings: slideshowTemplateSettingsSchema.default({
    brandKitId: null,
    mode: "custom",
    language: "en",
    textMode: "off",
    textDefaults: { fontSize: "normal", textWidth: "narrow", style: "minimal" },
    defaultCharacterAssetId: null,
    defaultCharacterPreviewUrl: null,
  }),
  slides: z.array(slideshowSlideBlueprintSchema).min(1).max(35),
})

export const slideshowSlideBlueprintStoredSchema = slideshowSlideBlueprintSchema.extend({
  textTreatment: slideshowTextTreatmentStoredSchema.default("off"),
})

export const slideshowTemplateSettingsStoredSchema = slideshowTemplateSettingsSchema.extend({
  textMode: slideshowTextModeStoredSchema.default("off"),
})

export const slideshowBlueprintStoredSchema = z.object({
  creativeDirection: z.string().trim().max(3000).default(""),
  settings: slideshowTemplateSettingsStoredSchema.default({
    brandKitId: null,
    mode: "custom",
    language: "en",
    textMode: "off",
    textDefaults: { fontSize: "normal", textWidth: "narrow", style: "minimal" },
    defaultCharacterAssetId: null,
    defaultCharacterPreviewUrl: null,
  }),
  slides: z.array(slideshowSlideBlueprintStoredSchema).min(1).max(35),
})

export const resolvedSlideshowSlideSchema = slideshowSlideBlueprintSchema.extend({
  index: z.number().int().min(0),
  sourceImageUrl: z.string().url().nullable().default(null),
  sourceCollectionImageId: z.string().uuid().nullable().default(null),
  generationId: z.string().uuid().nullable().default(null),
  finalImageUrl: z.string().url().nullable().default(null),
  status: z.enum(["pending", "resolving", "ready", "failed"]).default("pending"),
  errorMessage: z.string().nullable().default(null),
})

export const resolvedSlideshowSlideStoredSchema = slideshowSlideBlueprintStoredSchema.extend({
  index: z.number().int().min(0),
  sourceImageUrl: z.string().url().nullable().default(null),
  sourceCollectionImageId: z.string().uuid().nullable().default(null),
  generationId: z.string().uuid().nullable().default(null),
  finalImageUrl: z.string().url().nullable().default(null),
  status: z.enum(["pending", "resolving", "ready", "failed"]).default("pending"),
  errorMessage: z.string().nullable().default(null),
})

export const slideshowProjectSlidesSchema = z.array(resolvedSlideshowSlideSchema).max(35)

export const slideshowProjectSlidesStoredSchema = z.array(resolvedSlideshowSlideStoredSchema).max(35)

export type SlideshowAspectRatio = z.infer<typeof slideshowAspectRatioSchema>
export type SlideshowVariation = z.infer<typeof slideshowVariationSchema>
export type SlideshowVisualSource = z.infer<typeof slideshowVisualSourceSchema>
export type SlideshowSlideKind = z.infer<typeof slideshowSlideKindSchema>
export type SlideshowTextMode = z.infer<typeof slideshowTextModeSchema>
export type SlideshowTextTreatment = z.infer<typeof slideshowTextTreatmentSchema>
export type SlideshowCharacterMode = z.infer<typeof slideshowCharacterModeSchema>
export type SlideshowTemplateSettings = z.infer<typeof slideshowTemplateSettingsSchema>
export type SlideshowOverlay = z.infer<typeof slideshowOverlaySchema>
export type SlideshowReferenceImage = z.infer<typeof slideshowReferenceImageSchema>
export type SlideshowVisualRecipe = z.infer<typeof slideshowVisualRecipeSchema>
export type SlideshowSlideBlueprint = z.infer<typeof slideshowSlideBlueprintSchema>
export type SlideshowSlideBlueprintStored = z.infer<typeof slideshowSlideBlueprintStoredSchema>
export type SlideshowBlueprint = z.infer<typeof slideshowBlueprintSchema>
export type SlideshowBlueprintStored = z.infer<typeof slideshowBlueprintStoredSchema>
export type ResolvedSlideshowSlide = z.infer<typeof resolvedSlideshowSlideSchema>
export type SlideshowProjectStatus = z.infer<typeof slideshowProjectStatusSchema>

export type SlideshowTemplate = {
  id: string
  userId: string
  name: string
  description: string | null
  thumbnailUrl: string | null
  isPublic: boolean
  origin: z.infer<typeof slideshowTemplateOriginSchema>
  currentVersion: number
  versionId: string
  aspectRatio: SlideshowAspectRatio
  blueprint: SlideshowBlueprint
  createdAt: string
  updatedAt: string
}

export type SlideshowProject = {
  id: string
  userId: string
  templateId: string
  templateVersionId: string
  brandKitId: string | null
  name: string
  brief: string
  aspectRatio: SlideshowAspectRatio
  status: SlideshowProjectStatus
  slides: ResolvedSlideshowSlide[]
  renderedSlideUrls: string[]
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export const createSlideshowRequestSchema = z.object({
  brief: z.string().trim().min(4).max(8000),
  templateId: z.string().uuid().optional(),
  aspectRatio: slideshowAspectRatioSchema.default("9:16"),
  brandKitId: z.string().uuid().nullable().optional(),
  slideCount: z.number().int().min(1).max(35).optional(),
})

export const updateSlideshowProjectSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  slides: slideshowProjectSlidesSchema.optional(),
})

export const createSlideshowTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  aspectRatio: slideshowAspectRatioSchema.default("9:16"),
  blueprint: slideshowBlueprintSchema,
  origin: slideshowTemplateOriginSchema.optional(),
})

export const updateSlideshowTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  aspectRatio: slideshowAspectRatioSchema.optional(),
  blueprint: slideshowBlueprintSchema.optional(),
})

