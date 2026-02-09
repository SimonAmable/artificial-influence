import { Iphone } from "@/components/ui/iphone"

const PROOF_IMAGES = [
  "/insta_proof/Screenshot_20260118_111335_Instagram.jpg",
  "/insta_proof/Screenshot_20260118_112044_Instagram.jpg",
  "/insta_proof/Screenshot_20260118_112211_Instagram.jpg",
]

export function ProofSection() {
  return (
    <section id="proof" className="w-full bg-background py-16 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Social Proof
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-foreground sm:text-4xl">
            Outputs that look ready for real campaigns
          </h2>
          <p className="mt-4 text-muted-foreground">
            Samples from creator-style content and influencer-focused production experiments.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 items-center justify-items-center gap-8 md:grid-cols-3 md:gap-12">
          {PROOF_IMAGES.map((imageSrc, index) => (
            <div key={imageSrc} className="w-full max-w-[300px] md:max-w-[350px]">
              <Iphone src={imageSrc} aria-label={`Proof sample ${index + 1}`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
