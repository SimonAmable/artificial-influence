import type {
  LandingCanvasNodeSeed,
  LandingModelCard,
  LandingProcessStep,
  LandingWorkflowItem,
} from "@/lib/types/landing"

export const landingHero = {
  title: "Create AI Content That Converts",
  description:
    "Transform your marketing with realistic AI influencers, dynamic product shoots, and campaign-ready content. Build, iterate, and deploy creative assets in minutes, not days.",
  primaryCtaLabel: "Get Started Free",
  primaryCtaHref: "/login?mode=signup",
  secondaryCtaLabel: "See Workflows",
  secondaryCtaHref: "#workflows",
}

export const canvasSeeds: LandingCanvasNodeSeed[] = [
  {
    id: "seed-1",
    label: "Reference Image",
    mediaType: "image",
    mediaSrc: "/motion_copy/step1_image.png",
    position: { x: 40, y: 60 },
  },
  {
    id: "seed-2",
    label: "Style Video",
    mediaType: "video",
    mediaSrc: "/motion_copy/step2_video.mp4",
    position: { x: 40, y: 500 },
  },
  {
    id: "seed-3",
    label: "Motion Copy Output",
    mediaType: "video",
    mediaSrc: "/motion_copy/motion_copy_with_overlay.mp4",
    position: { x: 1040, y: 280 },
  },
]

export const workflowItems: LandingWorkflowItem[] = [
  {
    category: "Brand Assets",
    title: "Create reusable brand visuals",
    description:
      "Move from idea to repeatable templates for social, paid ads, and launch assets.",
    mediaType: "image",
    mediaSrc: "/canvas_landing_page_assets/icon_workflow.png",
    backgroundSrc: "/canvas_landing_page_assets/icon_workflow.png",
    backgroundType: "image",
    href: "/canvas",
  },
  {
    category: "Model Creation",
    title: "Create personas from text to image",
    description:
      "Describe your vision in detail and generate striking, editorial-style portraits and model looks on the canvas.",
    mediaType: "image",
    mediaSrc: "/canvas_landing_page_assets/model_creation.png",
    backgroundSrc: "/canvas_landing_page_assets/model_creation.png",
    backgroundType: "image",
    href: "/image",
  },
  {
    category: "Photoshoot",
    title: "Generate polished photoshoots",
    description:
      "Build product and creator shoots with consistent angles, wardrobe, and scene control.",
    mediaType: "image",
    mediaSrc: "/canvas_landing_page_assets/Photoshoot_workflow copy.png",
    backgroundSrc: "/canvas_landing_page_assets/Photoshoot_workflow copy.png",
    backgroundType: "image",
    href: "/image",
  },
  {
    category: "Influencer",
    title: "Design complete influencer campaigns",
    description:
      "Spin up personas, style references, and final content batches from one guided flow.",
    mediaType: "image",
    mediaSrc: "/canvas_landing_page_assets/influencer_workflows.png",
    backgroundSrc: "/canvas_landing_page_assets/influencer_workflows.png",
    backgroundType: "image",
    href: "/influencer-generator",
  },
]

export const modelCards: LandingModelCard[] = [
  {
    name: "Image Generation",
    tagline: "Photoreal outputs with controllable style and composition.",
    mediaType: "image",
    mediaSrc: "/hero_showcase_images/image_generation_wide.png",
    href: "/image",
  },
  {
    name: "Motion Copy",
    tagline: "Turn still assets into movement-driven short-form content.",
    mediaType: "video",
    mediaSrc: "/hero_showcase_images/motion_copy.mp4",
    href: "/motion-copy",
  },
  {
    name: "Lip Sync",
    tagline: "Match voice and expression with production-ready timing.",
    mediaType: "video",
    mediaSrc: "/hero_showcase_images/lipsync_final.mp4",
    href: "/lipsync",
  },
  {
    name: "Image Editing",
    tagline: "Retouch, expand, and adapt visuals without leaving the workflow.",
    mediaType: "image",
    mediaSrc: "/hero_showcase_images/image_editing_wide.png",
    href: "/image-editor",
  },
]

export const processSteps: LandingProcessStep[] = [
  {
    step: "01",
    title: "Start with strong references",
    description:
      "Drop in source visuals and prompts, then organize everything into one guided canvas.",
    mediaType: "image",
    mediaSrc: "/canvas_landing_page_assets/angle_changing.png",
  },
  {
    step: "02",
    title: "Iterate at creative speed",
    description:
      "Generate, compare, and refine outputs in fast cycles until the concept is locked.",
    mediaType: "image",
    mediaSrc: "/canvas_landing_page_assets/clothing ideation.png",
  },
  {
    step: "03",
    title: "Scale final production",
    description:
      "Package approved directions into repeatable workflows for launches and campaigns.",
    mediaType: "image",
    mediaSrc: "/canvas_landing_page_assets/production_velocity_step3_reference.png.png",
  },
]
