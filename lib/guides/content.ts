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
    description: "Lock a recognizable face people remember.",
    mediaSrc: "/ai_influencer/learn_influencer_faceless.jpg",
    mediaAlt: "Faceless influencer holding cash on stairs",
    section: "start",
    available: true,
  },
  {
    slug: "shoot-week-of-content",
    title: "Shoot a week of content",
    description: "Batch a full week of posts in one shoot.",
    mediaSrc: "/docs/new/ez_agent_content/base.png",
    mediaAlt: "AI influencer portrait from a weekly content batch",
    section: "start",
    available: true,
  },
  {
    slug: "carousel-multi-angle-shoot",
    title: "Make a carousel / multi-angle shoot",
    description: "Turn one winner into a swipeable post.",
    mediaSrc: "/docs/new/shots/slide-03.png",
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
    slug: "scale-with-agents",
    title: "More scale levers",
    description: "Build a content system that keeps posting.",
    section: "start",
    available: true,
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
  {
    slug: "mcp",
    title: "MCP",
    description: "Connect your preferred AI tool to the studio.",
    section: "platform",
    available: true,
  },
]

const SHOOT_WEEK_PROMPT_TRY_TABS = [
  {
    id: "bedroom",
    label: "Bedroom",
    prompt:
      "candid image, badly framed, low light, grainy, iPhone 12 camera, unposed, shy. Use my locked AI influencer sitting on the edge of an unmade bed, lamp light only, looking away, messy room half in frame, same face as my character, vertical 4:5",
  },
  {
    id: "car",
    label: "Car",
    prompt:
      "candid image, badly framed, low light, grainy, iPhone 12 camera, unposed, shy. Use my locked AI influencer in a dark passenger seat at night, dashboard glow, face slightly cut off, same face as my character, vertical 4:5",
  },
  {
    id: "night-out",
    label: "Night out",
    prompt:
      "candid image, badly framed, low light, grainy, iPhone 12 camera, unposed, shy. Use my locked AI influencer on a night street, mixed streetlights, mid-turn, outfit cropped weirdly, same face as my character, vertical 4:5",
  },
  {
    id: "mirror",
    label: "Mirror",
    prompt:
      "candid image, badly framed, low light, grainy, iPhone 12 camera, unposed, shy. Use my locked AI influencer in a dim bathroom mirror selfie, phone flash, cluttered background, hesitant stance, same face as my character, vertical 9:16",
  },
  {
    id: "corner-store",
    label: "Corner store",
    prompt:
      "candid image, badly framed, low light, grainy, iPhone 12 camera, unposed, shy. Use my locked AI influencer in a late-night convenience store aisle, harsh fluorescents, snack in hand, looking down, same face as my character, vertical 4:5",
  },
] as const

export const GUIDE_ARTICLES: GuideArticle[] = [
  {
    slug: "create-ai-influencer",
    title: "Create your AI influencer",
    result: "Create one recognizable face you can grow into a real content brand.",
    overview:
      "People follow a face they recognize. Start with a clear, consistent character you can use in every post. Merge 2–3 strong closeups for the most realistic result. Use Direct Save if you already have the perfect photo, or Build if you want to start from scratch.",
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
    result: "Make 7–14 posts in one session so you can stay visible all week.",
    overview:
      "Posting often gives you more chances to hit. Keep the same face, then batch new scenes, outfits, and poses in one session. Save only the strongest images and post them across the week.",
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
        body: "Tap a face under Working with to add it to the prompt. No face yet? Use Create.",
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
    result: "Turn one strong image into a carousel people want to swipe through.",
    overview:
      "Carousels can earn more watch time and shares than a single image. Upload one strong post, choose the grid and format, then generate matching angles of the same person.",
    timeEstimate: "~5 min",
    tools: [
      { label: "Carousel Shots", href: "/carousel-shots" },
      { label: "Library", href: "/assets" },
    ],
    primaryCtaLabel: "Open Carousel Shots",
    primaryCtaHref: "/carousel-shots",
    mediaSrc: "/docs/new/shots/slide-03.png",
    mediaAlt: "Carousel Shots multi-angle example panels",
    stepsHeading: "Do this in order",
    steps: [
      {
        title: "Upload a reference photo",
        body: "Choose a strong still with a clear face. Upload it, select it from Assets, or open it from Library.",
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
        body: "Hit Generate once. Your matching panels land in History. Upscale the best ones if you need sharper exports.",
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
    result: "Turn a strong image into a paid Fanvue post in a few minutes.",
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
        body: "Open Content and connect your Fanvue account once. Presence keeps it ready for future posts.",
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
        body: "Attach the media, set your PPV price, and publish now or schedule it. Add the caption last.",
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
    nextGuideSlug: "scale-with-agents",
    nextGuideLabel: "More scale levers",
    askAgentPrompt:
      "Help me publish an AI influencer still to Fanvue with a PPV price from Presence Content",
  },
  {
    slug: "scale-with-agents",
    title: "More scale levers",
    result: "Turn your best content process into a system you can run again.",
    presentation: "mcp",
    overview: `You have a face, a batch of posts, and a carousel. Now turn that process into a repeatable system.

MCP connects tools like Claude, ChatGPT, Cursor, and Codex to your studio. They can use the characters, assets, credits, and models you already have.

Save the brief that gets good results. Reuse templates. Schedule batches when your client supports it. The goal is simple: make more strong posts without rebuilding the workflow every time.`,
    timeEstimate: "~5 min",
    tools: [
      { label: "MCP", href: "/mcp" },
      { label: "Automations", href: "/automations" },
      { label: "Templates", href: "/templates" },
    ],
    primaryCtaLabel: "Connect MCP",
    primaryCtaHref: "#mcp-setup",
    infoSectionsHeading: "Scale levers",
    infoSectionsNumbered: false,
    infoSections: [
      {
        title: "Preserve proven instructions",
        body: "Save the brief that already gets strong results. Include the character, shot count, format, caption voice, and what counts as a keeper. Reuse it for faster, more consistent batches.",
        ctaLabel: "Connect MCP",
        ctaHref: "#mcp-setup",
      },
      {
        title: "Schedule through an MCP workflow",
        body: "Schedule a weekly carousel, refresh your content queue, or prepare drafts before review. Keep a quick review step until the results stay consistent.",
        ctaLabel: "Open Automations",
        ctaHref: "/automations",
      },
      {
        title: "Reuse output structures",
        body: "Start with a template for your photo set, video, slideshow, or carousel. Change it only when the format needs to change.",
        ctaLabel: "Open Templates",
        ctaHref: "/templates",
      },
      {
        title: "Keep the studio as the source of truth",
        body: "Review results in the studio, save the winners, and improve your brief based on what people actually watch, share, and buy.",
        ctaLabel: "Open MCP",
        ctaHref: "/mcp",
      },
    ],
    nextGuideSlug: null,
    nextGuideLabel: null,
    askAgentPrompt:
      "Help me turn my connected MCP workflow into a repeatable content production system",
  },
  {
    slug: "mcp",
    title: "MCP",
    result: "Understand how external AI tools connect securely to your studio.",
    presentation: "demo",
    overview: `MCP (Model Context Protocol) is the secure connection between an AI client and the studio. It lets Claude, ChatGPT, Cursor, Codex, and other supported tools request work from the same account without rebuilding your setup somewhere else.

The connection uses OAuth. You approve access in the browser, your password is never shared with the external client, and you can revoke the connection later.

Once connected, the external client works with the same credit balance, characters, assets, models, and generation History as the studio. MCP is the bridge; the full guide walks through choosing a client, connecting it, and turning the connection into a repeatable workflow.`,
    timeEstimate: "~3 min",
    tools: [
      { label: "MCP", href: "/mcp" },
    ],
    primaryCtaLabel: "Open the full MCP guide",
    primaryCtaHref: "/guides/scale-with-agents",
    outcomes: [
      "You understand what MCP connects",
      "You know OAuth keeps your password out of the external client",
      "You know which studio data and tools carry across the connection",
    ],
    nextGuideSlug: "scale-with-agents",
    nextGuideLabel: "More scale levers",
    askAgentPrompt: "Explain how MCP connects my preferred AI client to the studio",
  },
  {
    slug: "introduction",
    title: "Introduction",
    result: "A simple path from your first character to posts that can take off.",
    overview: `This studio helps you create and grow an AI creator from one place. Lock a face, make a week of posts, turn winners into carousels, and publish.

Start with consistency. If the face changes every session, people will not remember the creator. Use the Start here guides in order and build a recognizable feed.

Create your AI influencer first. Merge a few strong closeups for realism, save a photo you already love, or build a new face. The goal is one character you can use again and again.

Next, shoot a week of content in one sitting. Keep the winners and post them over several days. More good posts means more chances to go viral.

Turn your best still into a carousel when you want more watch time and swipes. Carousel Shots gives you matching angles of the same person.

Publish to Fanvue on Presence. Then use MCP, saved briefs, schedules, and templates to keep content moving.

The Platform guides explain credits, models, History, Assets, and MCP. When you are ready, open the first guide and lock your face.`,
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
        body: "Lock one reusable face with Direct Save, Merge, or Build. A consistent face makes the whole feed stronger.",
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
      {
        title: "More scale levers",
        body: "Use MCP with reusable briefs, scheduled workflows, and templates to make production repeatable.",
        ctaLabel: "Open guide",
        ctaHref: "/guides/scale-with-agents",
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
    result: "Spend less while you test, then put more credits behind the winners.",
    presentation: "info",
    overview: `Credits never expire. Monthly credits roll forward and credit packs stay in your balance until you use them. Top up once and shoot when you are ready.

Images, videos, Carousel Shots, and upscales use credits. Fast models cost less. Premium image and video models cost more.

Failed generations refund automatically. You only pay for successful results.

Your balance sits in the header (coin control) and under Settings → Credits. Plans grant a monthly allotment; one-time packs top up when you need more. Exact plan sizes and billing portals differ by product, but the credit meter and model picker work the same way. A $10 top-up is 200 credits (~5¢ each).

Pick a model inside each tool. Use a fast, lower-cost model to test ideas. Use a premium model when a concept already looks promising.

The best way to spend is to test several hooks cheaply, keep the strongest one, and upgrade only the content most likely to perform.`,
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
        body: `Unused credits stay yours. Monthly grants stack and purchased packs do not time out. Save them during a quiet week and use them for a bigger shoot later.`,
      },
      {
        title: "What spends credits",
        body: `Image and video generations, Carousel Shots, upscale, SynthID scrub, and remove-background all deduct credits. Cost follows the selected model.

Direct Save for AI Influencer is free. Most free-tools (compressor and similar) do not spend credits.

Failed generations always refund. Credits return automatically when a job fails. You are not charged for broken runs.`,
      },
      {
        title: "Balance, plans, and packs",
        body: `Check the coin in the header or Settings → Credits. Plans add monthly credits; packs are one-time top-ups on Pricing. $10 buys 200 credits. Whatever you do not spend stays.

Buy credits during a batch so you do not stall on a strong idea, or buy ahead knowing they will not disappear.`,
        ctaLabel: "Open Pricing",
        ctaHref: "/pricing",
      },
      {
        title: "Image models",
        body: `Common picks: Nano Banana (fast / everyday stills), GPT Image 2 (strong faces and Merge/Build), Seedream (detail and alternate looks), plus Grok Imagine, Z-Image Turbo, and Qwen Image Edit when you need those lanes.

Carousel Shots defaults to Nano Banana 2 and can use GPT Image or Seedream. The full set is still billed like one image.`,
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
        "Studio: $10 = 200 credits, Nano Banana 2 Lite @ 2 cr, and credits never expire. dirtybunny.ai (PixelBunny): $10 = 200 credits @ 5¢, 8 cr / gen; multi-angle ~32 cr. Prism: NB2 @ 15 cr (~$0.01 / credit); multi-angle ~60 cr.",
      sources: [
        { label: "PixelBunny guides", href: "https://pixelbunny.ai/guides" },
        { label: "How credits work", href: "https://pixelbunny.ai/guides/credits-and-pricing" },
        { label: "Multi-angle shots", href: "https://pixelbunny.ai/guides/multi-angle-product-shots" },
      ],
    },
    outcomes: [
      "You know credits never expire",
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
    overview: `History keeps every still and video you generate. Reopen old work, compare versions, and bring a strong result back into a tool.

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
        body: "Your generation timeline. Reopen and reuse anything you already made.",
        ctaLabel: "Open History",
        ctaHref: "/assets?tab=history",
      },
      {
        title: "Assets",
        body: "Your saved winners and characters, ready to use with @ mentions.",
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
