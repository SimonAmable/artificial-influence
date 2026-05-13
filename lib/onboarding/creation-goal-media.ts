export type CreationGoalMedia =
  | { kind: "video"; src: string; poster?: string }
  | { kind: "image"; src: string }

export const CREATION_GOAL_MEDIA: Record<string, CreationGoalMedia> = {
  ugc_social: { kind: "video", src: "/onboarding/UNICAN-UGC-5SEC.mp4" },
  ai_influencer: { kind: "video", src: "/onboarding/influencer.mp4" },
  product_ads: { kind: "video", src: "/onboarding/DIOR_AD.mp4" },
  memes_brainrot: { kind: "video", src: "/onboarding/trump-meme.webm" },
  carousel_posts: { kind: "image", src: "/onboarding/carosel_example.png" },
  fashion_lifestyle: { kind: "image", src: "/onboarding/fashion_exmaple.png" },
}
