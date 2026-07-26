import type { AuroraShaderVariant } from "@/components/ui/aurora-shader-background"
import type { DashboardToolNavItem } from "@/lib/constants/navigation"

export type ToolShowcaseMotion =
  | "prompt"
  | "flow"
  | "transform"
  | "timeline"
  | "signal"
  | "organize"

export type ToolShowcaseMedia = {
  src: string
  type?: "image" | "video"
  poster?: string
  position?: string
}

export type ToolShowcasePreview = {
  media: ToolShowcaseMedia[]
  shader: AuroraShaderVariant
  motion: ToolShowcaseMotion
  inputLabel: string
  resultLabel: string
}

const creatorShots = [
  "/docs/shoot-week/order/2/slide-05.png",
  "/docs/shoot-week/order/2/slide-06.png",
  "/docs/shoot-week/order/2/slide-07.png",
  "/docs/shoot-week/order/2/slide-08.png",
] satisfies string[]

const carouselShots = [
  "/carousel-shots-slides/slide-01.png",
  "/carousel-shots-slides/slide-02.png",
  "/carousel-shots-slides/slide-03.png",
  "/carousel-shots-slides/slide-04.png",
] satisfies string[]

const previewByLabel: Record<string, ToolShowcasePreview> = {
  Agent: {
    media: [{ src: "/page_screenshots_or_screenrecordings/agent.png" }],
    shader: "flow",
    motion: "prompt",
    inputLabel: "Build a week of creator content",
    resultLabel: "Campaign ready",
  },
  Automations: {
    media: [
      { src: "/landing_images/automations/step_1_iterate_in_chat.png" },
      { src: "/landing_images/automations/step2-connect_instagram_accounts.png" },
      { src: "/landing_images/automations/step_3_post_to_instgram.png" },
    ],
    shader: "flow",
    motion: "flow",
    inputLabel: "Every Monday · 9:00",
    resultLabel: "Run completed",
  },
  Templates: {
    media: [
      { src: "/canvas_landing_page_assets/influencer_workflows.png" },
      { src: "/canvas_landing_page_assets/Photoshoot_workflow copy.png" },
      { src: "/canvas_landing_page_assets/icon_workflow.png" },
    ],
    shader: "organize",
    motion: "organize",
    inputLabel: "Choose a proven workflow",
    resultLabel: "Template launched",
  },
  Slideshows: {
    media: carouselShots.map((src) => ({ src })),
    shader: "organize",
    motion: "timeline",
    inputLabel: "4 selected images",
    resultLabel: "Slideshow ready",
  },
  Content: {
    media: [
      { src: "/hero_showcase_images/presence/1.jpeg" },
      { src: "/hero_showcase_images/presence/2.png" },
      { src: "/hero_showcase_images/presence/3.jpg" },
    ],
    shader: "organize",
    motion: "flow",
    inputLabel: "Add to content calendar",
    resultLabel: "Scheduled",
  },
  Autopost: {
    media: [
      { src: "/landing_images/automations/step_3_post_to_instgram.png" },
      { src: "/insta_proof/Screenshot_20260118_111335_Instagram.jpg" },
    ],
    shader: "flow",
    motion: "flow",
    inputLabel: "Queue Instagram post",
    resultLabel: "Published",
  },
  "Image Studio": {
    media: [
      { src: "/hero_showcase_images/image_generation.png" },
      ...creatorShots.slice(0, 3).map((src) => ({ src })),
    ],
    shader: "generative",
    motion: "prompt",
    inputLabel: "Editorial portrait, soft light",
    resultLabel: "4 images created",
  },
  "Video Studio": {
    media: [
      {
        src: "/hero_showcase_images/motion_copy_dance_1.mp4",
        type: "video",
        poster: "/hero_showcase_images/image_generation_wide.png",
      },
    ],
    shader: "motion",
    motion: "timeline",
    inputLabel: "Animate this frame",
    resultLabel: "Video ready",
  },
  "Audio Studio": {
    media: [
      { src: "/3d_icons/agent.png", position: "center" },
      { src: "/page_screenshots_or_screenrecordings/agent.png" },
    ],
    shader: "signal",
    motion: "signal",
    inputLabel: "Warm, confident voice",
    resultLabel: "Voiceover ready",
  },
  "Brand kit": {
    media: [
      { src: "/icon.png", position: "center" },
      { src: "/canvas_landing_page_assets/icon creation.png" },
      { src: "/canvas_landing_page_assets/clothing ideation.png" },
    ],
    shader: "organize",
    motion: "organize",
    inputLabel: "Logo · color · voice",
    resultLabel: "Brand locked",
  },
  "Motion Copy": {
    media: [
      {
        src: "/motion_copy/motion_copy_with_overlay.mp4",
        type: "video",
        poster: "/motion_copy/step1_image.png",
      },
    ],
    shader: "motion",
    motion: "transform",
    inputLabel: "Copy reference movement",
    resultLabel: "Motion transferred",
  },
  "Lip Sync": {
    media: [
      {
        src: "/lip_sync/final.mp4",
        type: "video",
        poster: "/lip_sync/step1_ref-Image.png",
      },
    ],
    shader: "signal",
    motion: "signal",
    inputLabel: "Match voice to character",
    resultLabel: "Speech synced",
  },
  "Image Editing": {
    media: [
      { src: "/hero_showcase_images/image_editing.png" },
      { src: "/hero_showcase_images/image_editing_wide.png" },
    ],
    shader: "transform",
    motion: "transform",
    inputLabel: "Replace the background",
    resultLabel: "Edit applied",
  },
  Angles: {
    media: [
      { src: "/canvas_landing_page_assets/angle_changing.png" },
      ...creatorShots.slice(0, 3).map((src) => ({ src })),
    ],
    shader: "transform",
    motion: "transform",
    inputLabel: "Move camera 45°",
    resultLabel: "New angle created",
  },
  "Carousel Shots": {
    media: carouselShots.map((src) => ({ src })),
    shader: "transform",
    motion: "organize",
    inputLabel: "One reference image",
    resultLabel: "4 consistent shots",
  },
  "Character Swap": {
    media: [
      { src: "/docs/shoot-week/order/1/slide-06.png" },
      { src: "/hero_showcase_images/influencer_generation_showcase.png" },
    ],
    shader: "generative",
    motion: "transform",
    inputLabel: "Keep scene, change character",
    resultLabel: "Character replaced",
  },
  "Face Swap": {
    media: [
      { src: "/sample_influencers/female.png" },
      { src: "/sample_influencers/female_beauty.png" },
      { src: "/sample_influencers/female_lifestyle.png" },
    ],
    shader: "generative",
    motion: "transform",
    inputLabel: "Transfer facial identity",
    resultLabel: "Identity matched",
  },
  "AI Influencer": {
    media: creatorShots.map((src) => ({ src })),
    shader: "generative",
    motion: "organize",
    inputLabel: "One consistent identity",
    resultLabel: "Creator profile ready",
  },
  Workflow: {
    media: [
      { src: "/page_screenshots_or_screenrecordings/workflow.png" },
      { src: "/canvas_landing_page_assets/influencer_workflows.png" },
    ],
    shader: "flow",
    motion: "flow",
    inputLabel: "Connect creation steps",
    resultLabel: "Workflow complete",
  },
  "Video Editor": {
    media: [
      {
        src: "/onboarding/UNICAN-UGC-5SEC.mp4",
        type: "video",
        poster: "/hero_showcase_images/image_generation_wide.png",
      },
    ],
    shader: "motion",
    motion: "timeline",
    inputLabel: "Arrange clips",
    resultLabel: "Edit ready to export",
  },
  History: {
    media: creatorShots.slice(0, 3).map((src) => ({ src })),
    shader: "organize",
    motion: "timeline",
    inputLabel: "Browse recent creations",
    resultLabel: "Version restored",
  },
  Library: {
    media: [
      ...creatorShots.slice(0, 2).map((src) => ({ src })),
      ...carouselShots.slice(0, 2).map((src) => ({ src })),
    ],
    shader: "organize",
    motion: "organize",
    inputLabel: "Filter all assets",
    resultLabel: "Collection organized",
  },
  Resources: {
    media: [
      { src: "/ai_icons/AI_MATERIALS_SHOWCASES/chatgpt.jpeg" },
      { src: "/ai_icons/AI_MATERIALS_SHOWCASES/grok.jpeg" },
      { src: "/ai_icons/AI_MATERIALS_SHOWCASES/KLING.jpeg" },
    ],
    shader: "organize",
    motion: "prompt",
    inputLabel: "Search creative references",
    resultLabel: "Reference saved",
  },
  Guides: {
    media: [
      { src: "/docs/carousel-shots/hero.png" },
      { src: "/docs/shoot-week/generated-image-1784957689456.jpg" },
    ],
    shader: "organize",
    motion: "flow",
    inputLabel: "Follow 3 clear steps",
    resultLabel: "Guide completed",
  },
}

const fallbackPreview: ToolShowcasePreview = {
  media: [{ src: "/page_screenshots_or_screenrecordings/generator.png" }],
  shader: "aurora",
  motion: "prompt",
  inputLabel: "Start creating",
  resultLabel: "Ready to open",
}

export function getToolShowcasePreview(
  tool: DashboardToolNavItem,
): ToolShowcasePreview {
  return previewByLabel[tool.label] ?? fallbackPreview
}
