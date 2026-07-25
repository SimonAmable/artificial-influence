import { influencerModeHref } from "@/lib/ai-influencer/modes"
import type { ProductId } from "@/lib/product/types"
import { isVisibleByProductMetadata } from "@/lib/product/visibility"
import type { GuideArticle, GuideHubCard, GuideSectionId } from "@/lib/guides/types"

export const GUIDE_SECTION_ORDER: GuideSectionId[] = ["platform", "start", "publish"]

export const GUIDE_SECTION_LABELS: Record<GuideSectionId, string> = {
  start: "Start here",
  publish: "Publish",
  platform: "Platform",
}

export const GUIDE_HUB_CARDS: GuideHubCard[] = [
  {
    slug: "create-ai-influencer",
    title: "Create your AI influencer",
    description: "Lock a face and look you can reuse.",
    mediaSrc: "/ai_influencer/learn_influencer_faceless.jpg",
    mediaAlt: "Faceless influencer holding cash on stairs",
    section: "start",
    available: true,
  },
  {
    slug: "shoot-week-of-content",
    title: "Shoot a week of content",
    description: "Batch 7–14 stills ready to post.",
    mediaSrc: "/docs/shoot-week/order/1/slide-06.png",
    mediaAlt: "AI influencer portrait from a weekly content batch",
    section: "start",
    available: true,
  },
  {
    slug: "carousel-multi-angle-shoot",
    title: "Make a carousel / multi-angle shoot",
    description: "Matching angles for one post set.",
    mediaSrc: "/docs/carousel-shots/hero.png",
    mediaAlt: "Carousel Shots multi-angle example",
    section: "start",
    available: true,
  },
  {
    slug: "publish-to-fanvue",
    title: "Publish to Fanvue",
    description: "Send vault-ready posts straight to Fanvue.",
    mediaSrc: "/brand_icons/fanvue_logo.png",
    mediaAlt: "Fanvue",
    section: "start",
    available: true,
    products: ["presence-studio"],
  },
  {
    slug: "publish-to-instagram",
    title: "Publish to Instagram",
    description: "Export and post Instagram-ready content.",
    section: "publish",
    available: false,
    products: ["unican"],
  },
  {
    slug: "introduction",
    title: "Introduction",
    description: "What this studio is built for.",
    section: "platform",
    available: true,
  },
  {
    slug: "credits-and-models",
    title: "Credits & models",
    description: "Spend smart, pick the right tool.",
    section: "platform",
    available: true,
  },
  {
    slug: "history-and-assets",
    title: "History & Assets",
    description: "Where generations live vs what you save.",
    section: "platform",
    available: true,
  },
]

const SHOOT_WEEK_PROMPT_TRY_TABS = [
  {
    id: "bedroom",
    label: "Bedroom",
    prompt:
      "candid image, badly framed, low light, grainy, iPhone 12 camera, unposed, shy — using my locked AI influencer sitting on the edge of an unmade bed, lamp light only, looking away, messy room half in frame, same face as my character, vertical 4:5",
  },
  {
    id: "car",
    label: "Car",
    prompt:
      "candid image, badly framed, low light, grainy, iPhone 12 camera, unposed, shy — using my locked AI influencer in a dark passenger seat at night, dashboard glow, face slightly cut off, same face as my character, vertical 4:5",
  },
  {
    id: "night-out",
    label: "Night out",
    prompt:
      "candid image, badly framed, low light, grainy, iPhone 12 camera, unposed, shy — using my locked AI influencer on a night street, mixed streetlights, mid-turn, outfit cropped weirdly, same face as my character, vertical 4:5",
  },
  {
    id: "mirror",
    label: "Mirror",
    prompt:
      "candid image, badly framed, low light, grainy, iPhone 12 camera, unposed, shy — using my locked AI influencer in a dim bathroom mirror selfie, phone flash, cluttered background, hesitant stance, same face as my character, vertical 9:16",
  },
  {
    id: "corner-store",
    label: "Corner store",
    prompt:
      "candid image, badly framed, low light, grainy, iPhone 12 camera, unposed, shy — using my locked AI influencer in a late-night convenience store aisle, harsh fluorescents, snack in hand, looking down, same face as my character, vertical 4:5",
  },
] as const

export const GUIDE_ARTICLES: GuideArticle[] = [
  {
    slug: "create-ai-influencer",
    title: "Create your AI influencer",
    result: "One reusable face you can generate from again.",
    overview:
      "The best characters read as one real person — clear face, consistent features, and a look you’d recognize in a crowd. Merge is usually the most realistic path: blend 2–3 strong closeups into one face that holds up across stills. Direct Save works when you already love a photo; Build is for starting from traits when you have no reference.",
    timeEstimate: "~10 min",
    tools: [
      { label: "AI Influencer", href: influencerModeHref("direct") },
      { label: "Image", href: "/image" },
      { label: "Library", href: "/assets" },
    ],
    primaryCtaLabel: "Open AI Influencer",
    primaryCtaHref: influencerModeHref("direct"),
    pathsHeading: "Pick one starting point",
    pathsRelation: "or",
    paths: [
      {
        title: "Direct Save",
        description: "Keep a face you already have.",
        meta: "1 photo · free",
        ctaLabel: "Open Direct Save",
        ctaHref: influencerModeHref("direct"),
      },
      {
        title: "Merge",
        description: "Blend 2–3 closeups into one new face.",
        ctaLabel: "Open Merge",
        ctaHref: influencerModeHref("merge"),
      },
      {
        title: "Build",
        description: "Start from scratch with Builder traits.",
        ctaLabel: "Open Build",
        ctaHref: influencerModeHref("build"),
      },
    ],
    nextGuideSlug: "shoot-week-of-content",
    nextGuideLabel: "Shoot a week of content",
    askAgentPrompt: "Help me lock a consistent AI influencer face with Direct Save, Merge, or Build",
  },
  {
    slug: "shoot-week-of-content",
    title: "Shoot a week of content",
    result: "7–14 stills of the same person, ready to drip through the week.",
    overview:
      "Consistency beats variety. Keep one locked face, then batch different scenes, outfits, and poses in one sitting. Cull hard, save winners to Library, and post over the next 7 days instead of generating every morning.",
    timeEstimate: "~20 min",
    tools: [
      { label: "Image", href: "/image" },
      { label: "Agent", href: "/chat" },
      { label: "Library", href: "/assets" },
    ],
    primaryCtaLabel: "Open Image",
    primaryCtaHref: "/image",
    promptTry: {
      heading: "Try a week brief",
      tabs: [...SHOOT_WEEK_PROMPT_TRY_TABS],
      submitHref: "/chat",
    },
    stepsHeading: "Do this in order",
    steps: [
      {
        title: "Pick your character in the strip",
        body: "Tap a face under Working with — it drops an @ reference into the prompt. No face yet? Use Create.",
        ctaLabel: "Open AI Influencer",
        ctaHref: influencerModeHref("direct"),
        demo: "mention",
      },
      {
        title: "Run the five briefs",
        body: "Tab through Coffee → Street with that @ character still attached, edit if you want, then send. Aim for 2–3 options per scene.",
        demo: "batch",
      },
      {
        title: "Cull to 7+ keepers",
        body: "Delete anything that drifts off-face. Enhance winners if needed, then save them in Library so you can drip them all week.",
        ctaLabel: "Open Library",
        ctaHref: "/assets",
        demo: "cull",
      },
    ],
    nextGuideSlug: "carousel-multi-angle-shoot",
    nextGuideLabel: "Make a carousel / multi-angle shoot",
    askAgentPrompt:
      "Help me batch a week of consistent AI influencer stills across coffee, gym, night out, mirror, and street scenes",
  },
  {
    slug: "carousel-multi-angle-shoot",
    title: "Make a carousel / multi-angle shoot",
    result: "One reference photo → a matching multi-angle shot set ready to post.",
    overview:
      "Carousel Shots turns a single still into a coherent panel set — same person, different angles — for the cost of one image. Upload a keeper from your week batch, set grid and aspect, then generate.",
    timeEstimate: "~5 min",
    tools: [
      { label: "Carousel Shots", href: "/carousel-shots" },
      { label: "Library", href: "/assets" },
    ],
    primaryCtaLabel: "Open Carousel Shots",
    primaryCtaHref: "/carousel-shots",
    mediaSrc: "/docs/carousel-shots/hero.png",
    mediaAlt: "Carousel Shots multi-angle example panels",
    stepsHeading: "Do this in order",
    steps: [
      {
        title: "Upload a reference photo",
        body: "Drop in a strong still of your locked face — Upload, Select asset, or open from Library with Open in Carousel Shots.",
        ctaLabel: "Open Carousel Shots",
        ctaHref: "/carousel-shots",
        demo: "shots-upload",
      },
      {
        title: "Set grid, aspect, and variation",
        body: "Pick 4 or 9 shots, a panel ratio (9:16 / 4:5 / 3:4), then Subtle / Natural / Creative. Choose the model last.",
        demo: "shots-settings",
      },
      {
        title: "Generate the set",
        body: "Hit Generate once. Matching panels land in History — upscale keepers if you need sharper exports.",
        ctaLabel: "Open Carousel Shots",
        ctaHref: "/carousel-shots",
        demo: "shots-generate",
      },
    ],
    carouselUpload: {
      heading: "Try it with your photo",
      description:
        "Upload a reference still here and we’ll open Carousel Shots with it already loaded.",
    },
    nextGuideSlug: "publish-to-fanvue",
    nextGuideLabel: "Publish to Fanvue",
    askAgentPrompt:
      "Help me turn one AI influencer still into a multi-angle carousel with Carousel Shots",
  },
  {
    slug: "publish-to-fanvue",
    title: "Publish to Fanvue",
    result: "A keeper from Studio lands as a priced Fanvue post — vault or schedule.",
    overview:
      "Content is where Fanvue lives in Presence. Connect once, pick media from your vault or Studio keepers, set a PPV price, then publish or schedule. Same path whether you start from Library or Create Fanvue post.",
    timeEstimate: "~5 min",
    tools: [
      { label: "Content", href: "/content" },
      { label: "Library", href: "/assets" },
    ],
    primaryCtaLabel: "Open Content",
    primaryCtaHref: "/content",
    mediaSrc: "/brand_icons/fanvue_logo.png",
    mediaAlt: "Fanvue",
    stepsHeading: "Do this in order",
    steps: [
      {
        title: "Connect Fanvue",
        body: "Open Content and connect your Fanvue account. You only do this once — Presence keeps the link for vault sync and posts.",
        ctaLabel: "Open Content",
        ctaHref: "/content",
        demo: "fanvue-connect",
      },
      {
        title: "Select vault media",
        body: "In Media, pick a still already in Fanvue or upload a keeper from Studio. One strong frame is enough for a PPV drop.",
        ctaLabel: "Open Media",
        ctaHref: "/content?tab=media",
        demo: "fanvue-media",
      },
      {
        title: "Set price and publish",
        body: "Open compose, attach the media, set your PPV price, then publish now or schedule. Caption last — price and media first.",
        ctaLabel: "Create post",
        ctaHref: "/content?tab=schedule&compose=1",
        demo: "fanvue-publish",
      },
    ],
    fanvueTry: {
      heading: "Try it with a keeper",
      description:
        "Pick a still from your history, then create a Fanvue post or upload it to your vault.",
    },
    nextGuideSlug: null,
    nextGuideLabel: null,
    askAgentPrompt:
      "Help me publish an AI influencer still to Fanvue with a PPV price from Presence Content",
  },
  {
    slug: "introduction",
    title: "Introduction",
    result: "A clear map of the studio — then you start with locking a face.",
    overview: `This studio is built for one job: run a consistent AI creator without juggling five apps. Lock a face once, generate stills that still look like that person, turn keepers into multi-angle sets when you need a carousel, and publish from the same place you create — including Fanvue via Content on Presence.

Most setups fall apart on consistency. New faces every session means no brand and no library worth posting from. The Start here guides are the fix: three pages, in order, that take you from a reusable character to a week of stills to a matching carousel set.

Create your AI influencer first. Merge usually wins for realism — blend a few strong closeups into one face that holds up across scenes. Direct Save is fine when you already love a photo; Build is for starting from traits with no reference. The goal is one character you can @ again and again.

Shoot a week of content next. Keep that locked face, batch different scenes and outfits in one sitting, cull hard, and drip winners over the next days instead of generating every morning. Consistency beats novelty.

Make a carousel / multi-angle shoot when one still needs a full post set. Carousel Shots turns a single keeper into matching angles for roughly the cost of one image — same person, different panels.

Publish (Fanvue and later Instagram) sits after that pipeline. Platform guides — this Introduction, Credits & models, History & Assets — explain how the studio works day to day. You do not need every surface on day one. Walk Start here in order, then open the first guide when you are ready to lock a face.`,
    timeEstimate: "~3 min",
    tools: [
      { label: "Guides", href: "/guides" },
      { label: "AI Influencer", href: influencerModeHref("direct") },
    ],
    primaryCtaLabel: "Start: Create your AI influencer",
    primaryCtaHref: "/guides/create-ai-influencer",
    mediaSrc: "/ai_influencer/learn_influencer_faceless.jpg",
    mediaAlt: "AI influencer content example",
    stepsHeading: "Start here (in order)",
    steps: [
      {
        title: "Create your AI influencer",
        body: "Lock one reusable face — Direct Save, Merge, or Build. Everything downstream depends on this.",
        ctaLabel: "Open guide",
        ctaHref: "/guides/create-ai-influencer",
        demo: "mention",
      },
      {
        title: "Shoot a week of content",
        body: "Batch 7–14 stills of that same person across scenes, cull to keepers, save them in Library.",
        ctaLabel: "Open guide",
        ctaHref: "/guides/shoot-week-of-content",
        demo: "batch",
      },
      {
        title: "Make a carousel / multi-angle shoot",
        body: "Turn one keeper into a matching multi-angle set for a single post.",
        ctaLabel: "Open guide",
        ctaHref: "/guides/carousel-multi-angle-shoot",
        demo: "shots-generate",
      },
      {
        title: "Publish to Fanvue",
        body: "Connect Fanvue in Content, pick vault media or a Studio keeper, set PPV, and publish or schedule.",
        ctaLabel: "Open guide",
        ctaHref: "/guides/publish-to-fanvue",
        demo: "fanvue-publish",
        products: ["presence-studio"],
      },
    ],
    nextGuideSlug: "create-ai-influencer",
    nextGuideLabel: "Create your AI influencer",
    askAgentPrompt:
      "Give me a quick orientation of this studio and what I should do first to lock a consistent AI influencer",
  },
  {
    slug: "credits-and-models",
    title: "Credits & models",
    result: "Credits never expire — spend smart, pick the right model, keep what you buy.",
    presentation: "info",
    overview: `Credits never expire. Buy a pack or roll unused monthly credits forward — they stay on your balance until you spend them. That is a hard advantage over platforms like Higgsfield, where unused allotments typically vanish when the cycle resets. Top up once, shoot when you are ready.

Credits are the studio currency. Almost every generation — image, video, Carousel Shots, upscale, and similar tools — spends them. Costs are per model: lighter models burn less; premium video and image models cost more.

Failed generations always refund. If a job fails, those credits come back — you only pay for successful outputs.

Your balance sits in the header (coin control) and under Settings → Credits. Plans grant a monthly allotment; one-time packs top up when you need more. Exact plan sizes and billing portals differ by product, but the credit meter and model picker work the same way. A $10 top-up is 200 credits (~5¢ each).

Models are chosen inside each tool. Image, Video, Carousel Shots, and AI Influencer each expose the models that fit that job. You do not need every model — match quality and cost to the step you are on. Locking a face with Direct Save is free; Merge and Build use GPT Image 2. Day-to-day stills and carousels usually run on Nano Banana, GPT Image, or Seedream. Motion leans on Kling, Veo, Seedance, and related video models.

Spend smart: batch with a mid-tier model while exploring, then upscale or re-run keepers on a stronger model. Carousel Shots is priced like one image for a full multi-angle set — often cheaper than generating panels one by one.`,
    timeEstimate: "~4 min",
    tools: [
      { label: "Pricing", href: "/pricing" },
      { label: "Image", href: "/image" },
      { label: "Video", href: "/video" },
    ],
    primaryCtaLabel: "Open Pricing",
    primaryCtaHref: "/pricing",
    logoStrip: [
      { src: "/ai_icons/gemini-color.svg", label: "Google" },
      { src: "/ai_icons/openai.svg", label: "OpenAI" },
      { src: "/ai_icons/bytedance-color.svg", label: "ByteDance" },
      { src: "/ai_icons/kling-color.svg", label: "Kling" },
      { src: "/ai_icons/grok.svg", label: "Grok" },
      { src: "/ai_icons/flux.svg", label: "Flux" },
      { src: "/ai_icons/qwen.svg", label: "Qwen" },
    ],
    infoSectionsHeading: "Key points",
    infoSections: [
      {
        title: "Credits never expire",
        body: `Unused credits stay yours — monthly grants stack, and purchased packs do not time out. Platforms like Higgsfield usually wipe unused credits when the billing period ends. Here you can bank a top-up for a quiet week and burn it on a big shoot later.`,
      },
      {
        title: "What spends credits",
        body: `Image and video generations, Carousel Shots, upscale, SynthID scrub, and remove-background all deduct credits. Cost follows the selected model.

Direct Save for AI Influencer is free. Most free-tools (compressor and similar) do not spend credits.

Failed generations always refund. Credits return automatically when a job fails — you are not charged for broken runs.`,
      },
      {
        title: "Balance, plans, and packs",
        body: `Check the coin in the header or Settings → Credits. Plans add monthly credits; packs are one-time top-ups on Pricing. $10 buys 200 credits. Whatever you do not spend stays.

Buy credits when you are mid-batch so you do not stall on a keeper run — or buy ahead knowing they will not evaporate.`,
        ctaLabel: "Open Pricing",
        ctaHref: "/pricing",
      },
      {
        title: "Image models",
        body: `Common picks: Nano Banana (fast / everyday stills), GPT Image 2 (strong faces and Merge/Build), Seedream (detail and alternate looks), plus Grok Imagine, Z-Image Turbo, and Qwen Image Edit when you need those lanes.

Carousel Shots defaults to Nano Banana 2 and can use GPT Image or Seedream — still billed like a single image for the set.`,
        logos: [
          { src: "/ai_icons/gemini-color.svg", label: "Nano Banana" },
          { src: "/ai_icons/openai.svg", label: "GPT Image" },
          { src: "/ai_icons/bytedance-color.svg", label: "Seedream" },
          { src: "/ai_icons/grok.svg", label: "Grok" },
        ],
        ctaLabel: "Open Image",
        ctaHref: "/image",
      },
      {
        title: "Video models",
        body: `Video is where credits move fastest. Kling, Veo, Seedance, Gemini Omni, Happy Horse, and Grok Imagine Video cover motion, lipsync-adjacent, and control workflows.

Draft motion on a cheaper/faster option, then spend on a premium pass only for finals.`,
        logos: [
          { src: "/ai_icons/kling-color.svg", label: "Kling" },
          { src: "/ai_icons/gemini-color.svg", label: "Veo / Gemini" },
          { src: "/ai_icons/bytedance-color.svg", label: "Seedance" },
          { src: "/ai_icons/grok.svg", label: "Grok Video" },
        ],
        ctaLabel: "Open Video",
        ctaHref: "/video",
      },
    ],
    compareTable: {
      heading: "How far $10 goes",
      description: "Nano Banana stills from the same ~$10 spend.",
      columns: ["", "This studio", "dirtybunny.ai", "Prism"],
      rows: [
        {
          label: "$10 of credits",
          values: ["200", "200", "~1,000"],
        },
        {
          label: "Stills",
          values: ["~100", "~25", "~66"],
        },
        {
          label: "$ / Nano Banana still",
          values: ["~$0.10", "~$0.40", "~$0.15"],
        },
        {
          label: "Multi-angle",
          values: ["4–8 credits (~$0.20–$0.40)", "32 credits (~$1.60)", "60 credits (~$0.60)"],
        },
        {
          label: "Credits expire?",
          values: ["Never", "Paid: never · Free: yes", "Typically cycle"],
        },
      ],
      footnote:
        "Studio: $10 = 200 credits, Nano Banana 2 Lite @ 2 cr — and credits never expire (unlike Higgsfield-style monthly resets). dirtybunny.ai (PixelBunny): $10 = 200 credits @ 5¢, 8 cr / gen; multi-angle ~32 cr. Prism: NB2 @ 15 cr (~$0.01 / credit); multi-angle ~60 cr.",
      sources: [
        { label: "PixelBunny guides", href: "https://pixelbunny.ai/guides" },
        { label: "How credits work", href: "https://pixelbunny.ai/guides/credits-and-pricing" },
        { label: "Multi-angle shots", href: "https://pixelbunny.ai/guides/multi-angle-product-shots" },
      ],
    },
    outcomes: [
      "You know credits never expire — unlike Higgsfield-style resets",
      "You know failed generations always refund",
      "You can match image vs video models to the job without overspending",
      "You treat Carousel Shots and Direct Save as credit-smart shortcuts",
    ],
    nextGuideSlug: "history-and-assets",
    nextGuideLabel: "History & Assets",
    askAgentPrompt:
      "Help me pick an image or video model for my next generation and estimate how many credits I should budget",
  },
  {
    slug: "history-and-assets",
    title: "History & Assets",
    result: "History is everything you generated. Assets is what you keep on purpose.",
    presentation: "info",
    overview: `History is the full run log — every still and video you generate shows up there so you can reopen, compare, and pull something back into a tool.

Assets is the curated shelf. Save keepers, characters, and files you want to find again without scrolling the whole timeline. Characters you lock live here so you can reuse them.

In prompts, type {{@}} to attach a saved character or generation, or tap {{+}} when you need a new one. That reference keeps the next stills on the same person instead of drifting.`,
    timeEstimate: "~1 min",
    tools: [
      { label: "History", href: "/assets?tab=history" },
      { label: "Assets", href: "/assets" },
    ],
    primaryCtaLabel: "Open History",
    primaryCtaHref: "/assets?tab=history",
    infoSectionsHeading: "Open",
    infoSections: [
      {
        title: "History",
        body: "Your generation timeline — reopen and reuse anything you already made.",
        ctaLabel: "Open History",
        ctaHref: "/assets?tab=history",
      },
      {
        title: "Assets",
        body: "Saved keepers and characters — the shelf you pull into @ mentions.",
        ctaLabel: "Open Assets",
        ctaHref: "/assets",
      },
    ],
    nextGuideSlug: null,
    nextGuideLabel: null,
    askAgentPrompt:
      "Explain when I should save something to Assets versus leaving it in History, and how @ character mentions work",
  },
]

export function getGuideHubCardsForProduct(productId: ProductId): GuideHubCard[] {
  return GUIDE_HUB_CARDS.filter((card) => isVisibleByProductMetadata(card, productId))
}

export function getGuideArticleBySlug(slug: string): GuideArticle | undefined {
  return GUIDE_ARTICLES.find((article) => article.slug === slug)
}

export function getAvailableGuideSlugs(): string[] {
  return GUIDE_ARTICLES.map((article) => article.slug)
}
