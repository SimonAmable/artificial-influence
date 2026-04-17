import type {
  LandingCanvasNodeSeed,
  LandingModelCard,
  LandingPlatformSurfaceCard,
  LandingProcessStep,
  LandingWorkflowItem,
} from "@/lib/types/landing"

export const landingHero = {
  eyebrow: "For creators",
  titlePrefix: "Scale content with AI",
  morphingTexts: ["agents", "images", "videos", "audio", "automations"],
  description:
    "Unlock unlimited scale with automations. State-of-the-art AI tools for images, video, and audio. Post on your terms, or use our Instagram automation so your pipeline keeps shipping on autopilot.",
  primaryCtaLabel: "Get Started Free",
  primaryCtaHref: "/login?mode=signup",
  secondaryCtaLabel: "View pricing",
  secondaryCtaHref: "/pricing",
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
    category: "Image editing",
    title: "Refine regions with mask inpaint",
    description:
      "Brush a mask, describe the change, and keep everything outside the mask pixel-locked.",
    mediaType: "image",
    mediaSrc: "/canvas_landing_page_assets/influencer_workflows.png",
    backgroundSrc: "/canvas_landing_page_assets/influencer_workflows.png",
    backgroundType: "image",
    href: "/inpaint",
  },
]

/** Bento row: generator + agent wide, then workflow + automation. */
export const platformSurfaceCards: LandingPlatformSurfaceCard[] = [
  {
    kind: "image",
    id: "generator",
    name: "Generators",
    description: "20+ SOTA models for images and video.",
    href: "/image",
    cta: "Open",
    imageSrc: "/page_screenshots_or_screenrecordings/generator.png",
    imageAlt: "UniCan generator UI screenshot",
    safariUrl: "unican.app/image",
    layoutClass: "lg:col-span-8 lg:min-h-[300px]",
  },
  {
    kind: "image",
    id: "agent",
    name: "Agents",
    description:
      "Plain-language chat for images, video, edits, and multi-step projects. No canvas.",
    href: "/chat",
    cta: "Open",
    imageSrc: "/page_screenshots_or_screenrecordings/agent.png",
    imageAlt: "UniCan agent UI screenshot",
    safariUrl: "unican.app/chat",
    layoutClass: "lg:col-span-4 lg:min-h-[300px]",
  },
  {
    kind: "image",
    id: "workflow",
    name: "Workflows",
    description: "Reusable node flows you edit, group, and rerun.",
    href: "/canvases",
    cta: "Open",
    imageSrc: "/page_screenshots_or_screenrecordings/workflow.png",
    imageAlt: "UniCan workflow UI screenshot",
    safariUrl: "unican.app/canvas",
    layoutClass: "lg:col-span-6 lg:min-h-[280px]",
  },
  {
    kind: "automation",
    id: "automation",
    name: "Automations",
    description: "Connect Instagram and publish on your schedule.",
    href: "/autopost",
    cta: "Open",
    safariUrl: "unican.app/autopost",
    layoutClass: "lg:col-span-6 lg:min-h-[280px]",
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
    href: "/inpaint",
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
