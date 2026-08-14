/**
 * Curated photodump presets. Optional `coverUrls` (two public paths) power the
 * 2-up card art; until you add them, the UI uses `fallbackClassName` gradients.
 */
import { PHOTODUMP_CUSTOM_PRESET_ID } from "@/lib/photodump/constants"

/** Shared scene skeleton — each pack restyles these into its aesthetic. */
export const PHOTODUMP_SCENE_TEMPLATES = [
  "mirror selfie with natural indoor light",
  "candid street walk, mid-stride, urban background",
  "cafe window seat, soft daylight on face",
  "golden hour outdoor portrait, warm backlight",
  "night flash portrait, direct on-camera flash",
  "elevator or hallway mirror moment",
  "cozy interior couch pose, relaxed expression",
  "kitchen or morning routine candid",
  "rooftop or balcony city view behind subject",
  "passenger seat car selfie, road bokeh outside",
  "hotel lobby or marble interior editorial framing",
  "bathroom vanity beauty-adjacent close portrait",
  "bookstore or quiet indoor cultural backdrop",
  "rainy window mood, soft overcast light",
  "party or social flash, energetic candid energy",
] as const

export type PhotodumpPack = {
  id: string
  name: string
  description: string
  /** Prompt style applied across every shot in the pack. */
  styleLine: string
  /**
   * Optional 2-up cover stills under `/public`. Leave empty until you add
   * real assets — the UI falls back to `fallbackClassName`.
   */
  coverUrls?: readonly string[]
  fallbackClassName: string
}

export const PHOTODUMP_CUSTOM_PACK: PhotodumpPack = {
  id: PHOTODUMP_CUSTOM_PRESET_ID,
  name: "Custom",
  description: "Upload 1–n aesthetic references for this run only",
  styleLine: "Match the lighting, color grade, wardrobe vibe, and locations from the aesthetic reference images.",
  fallbackClassName: "from-muted/80 via-muted/40 to-background",
}

const CURATED_PACKS: readonly PhotodumpPack[] = [
  {
    id: "sleepy-head",
    name: "Sleepy Head",
    description: "Soft morning, bed hair, half-awake dump",
    styleLine: "Sleepy morning photodump aesthetic: pillow-soft light, bedhead, lazy weekend energy, muted warm tones",
    fallbackClassName: "from-amber-200/40 via-rose-100/30 to-slate-300/40",
  },
  {
    id: "zen",
    name: "Zen",
    description: "Quiet spa, slow living, calm interiors",
    styleLine: "Zen lifestyle dump: neutral palette, soft natural light, calm minimal spaces, peaceful slow-living mood",
    fallbackClassName: "from-stone-300/50 via-emerald-100/30 to-slate-200/40",
  },
  {
    id: "candid-glow",
    name: "Candid Glow",
    description: "Golden hour, unposed, sun-kissed",
    styleLine: "Candid glow dump: golden hour sunlight, unposed movement, warm skin highlights, effortless influencer energy",
    fallbackClassName: "from-orange-300/50 via-amber-200/40 to-yellow-100/30",
  },
  {
    id: "office-dresscode",
    name: "Office dresscode",
    description: "Y2K office, CRT desks, cubicle play",
    styleLine: "Office dresscode dump: retro Y2K office, CRT monitors, cubicle props, playful corporate surrealism, harsh office fluorescent mixed with flash",
    fallbackClassName: "from-slate-500/40 via-red-300/30 to-yellow-200/30",
  },
  {
    id: "surreal-self",
    name: "Surreal Self",
    description: "Conceptual rooms, screens, uncanny props",
    styleLine: "Surreal self dump: conceptual interiors, scattered screens or phones, uncanny art-direction, cinematic flash",
    fallbackClassName: "from-violet-500/35 via-fuchsia-400/25 to-slate-900/50",
  },
  {
    id: "surreal-self-ii",
    name: "Surreal Self II",
    description: "Mirrors, mannequins, analog glitch",
    styleLine: "Surreal self II dump: mirror fragments, mannequins, analog glitch interiors, experimental editorial",
    fallbackClassName: "from-indigo-500/35 via-purple-400/25 to-zinc-800/50",
  },
  {
    id: "alter-ego",
    name: "Alter ego",
    description: "Opposite persona, night look, club energy",
    styleLine: "Alter ego dump: bolder night persona, dramatic makeup or styling shift, club flash, alley or neon accents",
    fallbackClassName: "from-rose-600/40 via-purple-700/30 to-black/50",
  },
  {
    id: "cool-girl-dump",
    name: "Cool Girl Dump",
    description: "IG canon cool-girl moments",
    styleLine: "Cool girl dump: mirror selfies, street candids, party flash, passenger-seat shots, effortless IG photodump",
    fallbackClassName: "from-zinc-400/40 via-stone-300/30 to-neutral-200/40",
  },
  {
    id: "male-archive",
    name: "Male Archive",
    description: "Mens editorial dump, studio and street",
    styleLine: "Male archive dump: mens editorial styling, gym locker, rooftop, car interior, studio three-quarter portraits",
    fallbackClassName: "from-slate-600/45 via-stone-500/30 to-neutral-400/35",
  },
  {
    id: "european-summer",
    name: "European Summer",
    description: "Coastal linen, piazza, gelato energy",
    styleLine: "European summer dump: coastal light, linen wardrobe, terrace and piazza backdrops, warm vacation palette",
    fallbackClassName: "from-sky-300/45 via-amber-100/35 to-cyan-200/30",
  },
  {
    id: "clean-girl",
    name: "Clean Girl",
    description: "Dewy bathroom, gold hoops, minimal glam",
    styleLine: "Clean girl dump: dewy skin, bathroom mirror, gold jewelry, minimal makeup, soft neutral palette",
    fallbackClassName: "from-rose-100/50 via-amber-50/40 to-stone-200/40",
  },
  {
    id: "quiet-luxury",
    name: "Quiet Luxury",
    description: "Hotel beige, old money, soft editorial",
    styleLine: "Quiet luxury dump: beige and cream palette, hotel lobby, linen textures, understated wealth, soft editorial light",
    fallbackClassName: "from-stone-300/50 via-amber-100/35 to-neutral-200/45",
  },
  {
    id: "downtown-girl",
    name: "Downtown Girl",
    description: "NYC stoop, subway, iced coffee",
    styleLine: "Downtown girl dump: city stoops, subway tiles, bookstore corners, iced coffee in hand, urban candid",
    fallbackClassName: "from-zinc-500/40 via-stone-400/30 to-slate-300/35",
  },
  {
    id: "y2k-flash",
    name: "Y2K Flash",
    description: "Disposable cam, club, chrome nights",
    styleLine: "Y2K flash dump: direct flash, disposable camera grain, club bathroom, parking lot nights, chrome accents",
    fallbackClassName: "from-fuchsia-400/40 via-cyan-300/30 to-violet-500/35",
  },
  {
    id: "cottagecore",
    name: "Cottagecore",
    description: "Meadow, picnic, film softness",
    styleLine: "Cottagecore dump: meadows, picnic tables, garden kitchens, soft film grain, pastoral warmth",
    fallbackClassName: "from-green-200/45 via-amber-100/35 to-lime-100/30",
  },
  {
    id: "dark-academia",
    name: "Dark Academia",
    description: "Library stacks, wool, rainy cobblestone",
    styleLine: "Dark academia dump: library stacks, cafe booths, wool textures, rainy cobblestone, warm desk lamps",
    fallbackClassName: "from-amber-900/35 via-stone-700/30 to-slate-800/45",
  },
  {
    id: "film-camera",
    name: "Film Camera",
    description: "Portra tones, candid grain, flash",
    styleLine: "Film camera dump: Portra-like color, candid grain, kitchen-night flash, couch documentary framing",
    fallbackClassName: "from-orange-200/40 via-rose-200/30 to-amber-100/35",
  },
  {
    id: "coquette",
    name: "Coquette",
    description: "Bows, vanity, soft pink",
    styleLine: "Coquette dump: bows, vanity mirrors, ballet flats details, soft pink palette, romantic bedroom light",
    fallbackClassName: "from-pink-200/50 via-rose-100/40 to-fuchsia-100/30",
  },
  {
    id: "gorpcore",
    name: "Gorpcore",
    description: "Trail mist, shell jacket, ridge views",
    styleLine: "Gorpcore dump: technical shell jackets, trail mist, car-trunk gear, ridge overlooks, outdoor utility aesthetic",
    fallbackClassName: "from-slate-400/45 via-emerald-300/25 to-stone-500/35",
  },
  {
    id: "vanilla-girl",
    name: "Vanilla Girl",
    description: "Beige apartment, latte, monochrome calm",
    styleLine: "Vanilla girl dump: monochrome beige interiors, latte tones, morning apartment light, calm minimal styling",
    fallbackClassName: "from-stone-200/55 via-amber-50/45 to-neutral-100/50",
  },
  {
    id: "night-out",
    name: "Night Out",
    description: "Flash, bathroom, afters",
    styleLine: "Night out dump: harsh party flash, bathroom mirror, sidewalk afters, neon spill, social energy",
    fallbackClassName: "from-violet-600/40 via-fuchsia-500/30 to-slate-900/50",
  },
]

export const PHOTODUMP_PACKS: readonly PhotodumpPack[] = [PHOTODUMP_CUSTOM_PACK, ...CURATED_PACKS]

export function getPhotodumpPackById(packId: string): PhotodumpPack | null {
  return PHOTODUMP_PACKS.find((pack) => pack.id === packId) ?? null
}

export function getPhotodumpShotBriefs(pack: PhotodumpPack, shotCount: number): string[] {
  const templates = PHOTODUMP_SCENE_TEMPLATES.slice(0, shotCount)
  if (templates.length < shotCount) {
    const padded = [...templates]
    while (padded.length < shotCount) {
      padded.push(PHOTODUMP_SCENE_TEMPLATES[padded.length % PHOTODUMP_SCENE_TEMPLATES.length]!)
    }
    return padded.map((scene) => `${pack.styleLine}. Scene: ${scene}.`)
  }

  return templates.map((scene) => `${pack.styleLine}. Scene: ${scene}.`)
}
