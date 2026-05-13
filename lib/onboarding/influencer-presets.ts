/**
 * Curated preset characters shown on the onboarding "Create AI influencer"
 * sub-step. Thumbnails live in `/public/sample_influencers/` and are referenced
 * here as public paths.
 *
 * Picked entries are stored on `onboarding_json_data.aiInfluencer.presetId`.
 *
 * Each preset carries library defaults (`assetDefaults`), a compact generation
 * brief for image/video tools, and persona hints so onboarding can seed the
 * first character asset without re-describing the reference image.
 */
export type InfluencerPresetAssetDefaults = {
  /** Default title in the asset library (user editable in the dialog). */
  title: string
  /**
   * Long-form description for the creative agent when this character is
   * attached or searched—silhouette, styling, lighting habits, niche context.
   */
  description: string
  /** Tags stored on the saved asset (niche, aesthetic, wardrobe, etc.). */
  tags: readonly string[]
}

export type InfluencerPresetPersona = {
  /** Content verticals (UGC hooks, ad angles). */
  niches: readonly string[]
  /** How they sound on camera: pacing, warmth, slang level. */
  voiceTone: string
  /** Quick visual keywords for prompts and search. */
  aestheticKeywords: readonly string[]
}

export type InfluencerPreset = {
  id: string
  name: string
  /** Short line on the preset card. */
  description: string
  /** Public path under `/public` or an absolute URL. */
  thumbnailUrl?: string
  /** Public path under `/public` or an absolute URL. Plays on hover/selection if provided. */
  previewVideoUrl?: string
  /** Tailwind gradient classes used as a fallback when no thumbnail is available. */
  gradientClassName?: string
  /** Values passed into CreateAssetDialog / saved asset rows. */
  assetDefaults: InfluencerPresetAssetDefaults
  /**
   * Copy-ready block for `generateImage` / `generateVideo` prompts: identity
   * locks (hair, makeup, wardrobe) plus default lighting Framing notes.
   */
  generationBrief: string
  /** Structured persona hints for chat and automations. */
  persona: InfluencerPresetPersona
}

/** Resolve a public path for `/api/assets/autofill` and fetches (absolute URL). */
export function resolvePublicAssetUrl(pathOrUrl: string, origin: string): string {
  const t = pathOrUrl.trim()
  if (!t) return t
  if (/^https?:\/\//i.test(t)) return t
  if (t.startsWith("/")) return `${origin.replace(/\/$/, "")}${t}`
  return t
}

/** Full library description: look + prompt locks + persona hooks (single saved field). */
export function buildPresetCharacterLibraryDescription(preset: InfluencerPreset): string {
  return [
    preset.assetDefaults.description.trim(),
    "",
    "Prompt-forward brief:",
    preset.generationBrief.trim(),
    "",
    "On-camera voice:",
    preset.persona.voiceTone.trim(),
    "",
    `Content niches: ${preset.persona.niches.join(", ")}.`,
    `Visual keywords: ${preset.persona.aestheticKeywords.join(", ")}.`,
  ].join("\n")
}

export const INFLUENCER_PRESETS: readonly InfluencerPreset[] = [
  {
    id: "aria",
    name: "Aria",
    description: "Sunlit lifestyle · travel days",
    thumbnailUrl: "/sample_influencers/female_lifestyle.png",
    gradientClassName: "from-rose-400/60 via-pink-500/40 to-fuchsia-600/30",
    assetDefaults: {
      title: "Aria — lifestyle host",
      description: [
        "Young East Asian woman, oval face, long straight dark brown hair with a middle part, almond dark-brown eyes, fair warm skin with a dewy natural finish.",
        "Minimal makeup: soft peach blush, light mascara, sheer pink lip. Delicate silver necklace with a small pendant; tiny shoulder ink visible in some frames.",
        "Wardrobe anchor: olive green ribbed skinny-strap tank; casual off-duty influencer vibe.",
        "Hero framing: bright natural daylight through a car window, side-lit sun kiss on cheek and hair, soft shadows; passenger-seat selfie angle, shallow depth with road blur outside.",
        "Keep lighting honest and high-key; skin texture natural; palette grounded in olive, warm neutrals, and black car interior.",
        "Use for day-in-the-life POV, travel vlogs, GRWM-lite, authentic recommendations, and soft-sell lifestyle spots.",
      ].join(" "),
      tags: [
        "lifestyle",
        "travel",
        "natural-light",
        "clean-girl",
        "gen-z",
        "daylight-selfie",
        "minimal-makeup",
        "olive-wardrobe",
      ],
    },
    generationBrief: [
      "Young East Asian woman, long straight dark brown middle-part hair, almond eyes, fair warm dewy skin, minimal peach-toned makeup.",
      "Olive green ribbed tank top, delicate silver necklace; passenger car selfie, strong side natural daylight, soft lens flare, road bokeh through window.",
      "Authentic lifestyle influencer, calm direct gaze, relatable off-duty energy.",
    ].join(" "),
    persona: {
      niches: ["lifestyle vlogs", "travel & routines", "wellness & habits", "soft-sell product stories"],
      voiceTone: "Warm, conversational, steady pacing; sounds like a friend debriefing the day; light enthusiasm, no hard sell.",
      aestheticKeywords: ["natural daylight", "clean girl", "minimal", "road-trip", "authentic selfie"],
    },
  },
  {
    id: "iris",
    name: "Iris",
    description: "Glass-skin beauty · GRWM",
    thumbnailUrl: "/sample_influencers/female_beauty.png",
    gradientClassName: "from-amber-300/60 via-orange-500/40 to-rose-600/30",
    assetDefaults: {
      title: "Iris — beauty creator",
      description: [
        "Young adult woman, early–mid 20s, fair-to-light warm skin with a glossy glass-skin finish; long voluminous dark brown hair, middle part, curtain bangs framing the eyes.",
        "Hazel or light-brown eyes, full groomed brows, soft pink-peach blush on cheeks, high-shine pink lips; almond-shaped polished nails in milky pink.",
        "White ribbed scoop-neck tank; small gold hoop earrings and thin gold chain—minimal jewelry that reads on camera.",
        "Setting: bright modern bathroom, marble-look tile, soft even overhead beauty lighting—no harsh shadows; chest-up beauty portrait with a handheld skincare or lip product near the face.",
        "Palette: white, gold accents, soft pink, warm brown hair; optional pastel cosmetic tube as prop.",
        "Best for tutorials, before/after skincare, shade swatches, bathroom mirror energy without clutter; keep skin texture luminous but believable.",
      ].join(" "),
      tags: [
        "beauty",
        "skincare",
        "grwm",
        "glass-skin",
        "minimal-glam",
        "bathroom-set",
        "creator-closeup",
      ],
    },
    generationBrief: [
      "Beauty creator, early 20s, long wavy dark brown hair with curtain bangs, glass-skin glow, soft glam eyes, glossy pink lips.",
      "White ribbed tank, gold hoops and necklace; bright even bathroom beauty lighting, chest-up portrait, optional cosmetic tube held near cheek.",
      "Clean minimalist beauty aesthetic, soft elegant smile, polished GRWM framing.",
    ].join(" "),
    persona: {
      niches: ["skincare routines", "makeup tutorials", "product reviews", "aesthetic bathroom setups"],
      voiceTone: "Soft, encouraging, slightly slower for application steps; clear pronunciations on product claims; friendly expert.",
      aestheticKeywords: ["dewy skin", "clean girl beauty", "gold accents", "natural glam", "vertical beauty"],
    },
  },
  {
    id: "nova",
    name: "Nova",
    description: "Night-out flash · bold liner",
    thumbnailUrl: "/sample_influencers/female_tech.png",
    gradientClassName: "from-sky-400/60 via-blue-500/40 to-indigo-600/30",
    assetDefaults: {
      title: "Nova — night-city creator",
      description: [
        "Young woman with East Asian features; very long jet-black straight hair, middle part with wispy bangs and face-framing layers.",
        "Striking eye makeup: sharp black winged liner, full lashes; fair skin with a dewy base; igari-style pink-red blush across cheeks and nose bridge; glossy pink lips.",
        "White short-sleeve tee with a bold vintage-style red/black graphic (streetwear poster collage feel).",
        "Night car interior: direct flash photography, high contrast on skin and hair, bokeh city lights through window, grey seat and dark trim; slight high-angle selfie.",
        "Palette: black, white, hot red graphic accents, punchy pink blush. Mood: urban nightlife, Gen Z street, confident neutral expression with slight pout.",
        "Works for nightlife vlogs, concert energy, streetwear hooks, edgy tech-unboxing B-roll talent, and bold vertical TikToks.",
      ].join(" "),
      tags: [
        "nightlife",
        "flash-photography",
        "winged-liner",
        "streetwear",
        "gen-z",
        "car-selfie",
        "urban",
      ],
    },
    generationBrief: [
      "Young woman, long straight black hair with wispy bangs, dramatic winged eyeliner, pink blush across nose and cheeks, glossy lips.",
      "White graphic tee red and black print; night car selfie with direct flash, city bokeh lights through window, moody high contrast.",
      "Cool confident gaze, street nightlife influencer energy.",
    ].join(" "),
    persona: {
      niches: ["nightlife & events", "streetwear fits", "bold makeup looks", "city vlogs", "edgy tech culture"],
      voiceTone: "Confident, witty, quicker beats; occasional deadpan; Gen Z slang okay if brand allows.",
      aestheticKeywords: ["direct flash", "car selfie", "winged liner", "Y2K street", "night city"],
    },
  },
  {
    id: "mira",
    name: "Mira",
    description: "Elevator mirror · chic casual",
    thumbnailUrl: "/sample_influencers/female.png",
    gradientClassName: "from-violet-400/60 via-purple-500/40 to-indigo-600/30",
    assetDefaults: {
      title: "Mira — everyday style host",
      description: [
        "Young East Asian woman, long dark wavy hair with middle part; fair dewy skin; subtle winged liner and mascara; pink-peach blush on cheeks and nose; matte reddish-brown lips.",
        "Statement details: long silver chain with large four-leaf clover pendant; multiple silver rings; long almond nails with white 3D floral nail art and metallic accents.",
        "Outfit: white ribbed graphic tank (bold black lettering), oversized marled grey knit cardigan worn off one shoulder and tied at waist; black bottoms partially visible.",
        "Black leather shoulder bag with chunky silver chain strap; plush white teddy keychain accent. Full-length mirror selfie in brushed-metal elevator, bright even overhead lighting.",
        "Vibe: playful street-chic, detail-oriented accessorizing, urban creator on the go.",
        "Ideal for outfit breakdowns, accessory-focused hooks, day-in-outfit transitions, and polished casual UGC.",
      ].join(" "),
      tags: [
        "street-chic",
        "elevator-mirror",
        "accessories",
        "nail-art",
        "layered-knit",
        "plush-charm",
        "everyday-creator",
      ],
    },
    generationBrief: [
      "Young woman, long dark wavy middle-part hair, soft glam makeup, matte terracotta lip, statement silver clover necklace and rings.",
      "White graphic tank, grey oversized cardigan tied at waist, black chain bag with plush bear charm; elevator mirror selfie, bright metal reflections.",
      "Playful chic streetwear influencer look.",
    ].join(" "),
    persona: {
      niches: ["daily outfits", "accessory hauls", "nail inspiration", "casual street style", "life updates"],
      voiceTone: "Friendly, bubbly but grounded; likes specifics (materials, fit, dupes); quick humor.",
      aestheticKeywords: ["mirror selfie", "layered knits", "silver jewelry", "teddy charm", "elevator aesthetic"],
    },
  },
  {
    id: "kai",
    name: "Kai",
    description: "Golden hour · street luxury",
    thumbnailUrl: "/sample_influencers/male_fashion.png",
    gradientClassName: "from-emerald-400/60 via-teal-500/40 to-cyan-600/30",
    assetDefaults: {
      title: "Kai — fashion & lifestyle",
      description: [
        "Young man, early–mid 20s, Mediterranean or Southern European appearance; short dark brown messy hair; neat short beard and mustache; athletic slim build.",
        "Oversized black heavyweight crew tee with small centered white abstract logo mark; black cargo trousers with side pockets; silver watch on wrist.",
        "Leaning against a vintage black sedan with twin white racing stripes, chrome details; old European stone facade and barred window behind.",
        "Warm golden-hour sunlight, soft shadows, premium lifestyle photography mood; mid-thigh-up framing, hands in pockets, neutral confident gaze.",
        "Palette: black monochrome fit, warm sun, muted stone. Use for menswear, automotive lifestyle, fragrance cues, travel luxury, and minimalist brand spots.",
      ].join(" "),
      tags: [
        "menswear",
        "street-luxury",
        "golden-hour",
        "vintage-car",
        "minimal",
        "cargo",
        "lifestyle",
      ],
    },
    generationBrief: [
      "Young man, short dark hair, groomed stubble, athletic slim build, black oversized tee small white chest mark, black cargo pants, silver watch.",
      "Leaning on classic black car with white racing stripes, old European stone street, warm golden hour light, confident neutral expression.",
      "Premium minimalist menswear influencer.",
    ].join(" "),
    persona: {
      niches: ["mens outfits", "streetwear", "automotive lifestyle", "travel aesthetics", "watch & accessories"],
      voiceTone: "Calm, assured, economical sentences; slightly lower register; understated confidence.",
      aestheticKeywords: ["golden hour", "classic car", "monochrome fit", "European street", "editorial casual"],
    },
  },
  {
    id: "lex",
    name: "Lex",
    description: "Desk studio · tech & gear",
    thumbnailUrl: "/sample_influencers/male_tech.png",
    gradientClassName: "from-zinc-500/60 via-slate-600/40 to-neutral-800/30",
    assetDefaults: {
      title: "Lex — tech reviewer host",
      description: [
        "Man late 20s–early 30s; olive-to-medium skin; short dark hair in a modern quiff with clean sides; neatly trimmed stubble; brown eyes, strong brows, defined jaw.",
        "Black pullover hoodie with large white athletic logo across chest; black smartwatch on wrist.",
        "Seated at a dark textured desk, hands clasped, friendly direct-to-camera talking-head posture. Desk props: smartphone flat, white wireless earbuds and case; background shelf with headphones on stand, small potted greens, graphic LED wall panels (cool blue strip + warm triangular panels), subtle retro monitor accent.",
        "Even, creator-studio lighting on face; background color accents blue and soft coral from LEDs; black, grey, and white dominant wardrobe palette.",
        "Best for explainers, unboxings, comparisons, desk tour segments, and authoritative-but-approachable tech narration.",
      ].join(" "),
      tags: [
        "tech",
        "reviewer",
        "desk-setup",
        "talking-head",
        "led-background",
        "hoodie",
        "unboxing",
      ],
    },
    generationBrief: [
      "Late 20s man, short dark hair fade and quiff, neat stubble, black hoodie with large white chest logo, black smartwatch.",
      "Modern creator desk, LED accent lights blue and warm tones, earbuds and phone on desk, over-ear headphones on stand behind, friendly direct address.",
      "Approachable tech host, crisp studio exposure.",
    ].join(" "),
    persona: {
      niches: ["consumer tech reviews", "desk setups", "gadget comparisons", "workflow tips", "fitness-tech crossovers"],
      voiceTone: "Clear, structured, helpful; explains specs plainly; light humor okay; sounds like a knowledgeable friend.",
      aestheticKeywords: ["RGB accents", "desk studio", "talking head", "clean backlight", "athleisure tech"],
    },
  },
] as const

export function findInfluencerPreset(id: string | null | undefined): InfluencerPreset | undefined {
  if (!id) return undefined
  return INFLUENCER_PRESETS.find((p) => p.id === id)
}
