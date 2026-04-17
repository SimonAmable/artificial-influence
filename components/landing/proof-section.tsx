import Image from "next/image"

const PROOF_IMAGES = [
  "/insta_proof/insta_proof_showcase_iphone/Screenshot-iPhone15 Pro Max-1-ss1.png",
  "/insta_proof/insta_proof_showcase_iphone/Screenshot-iPhone15 Pro Maxss-ss3.png",
] as const

export function ProofSection() {
  return (
    <section id="proof" className="w-full overflow-x-hidden bg-background py-16 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            Every week you wait, they&apos;re posting faster
          </h2>
          <p className="mt-4 text-muted-foreground">
            Creators use this to save time and strip friction, so posting stays easy and daily consistency actually
            sticks. The gap widens while you&apos;re still &quot;getting ready.&quot; Real feeds below, not mockups.
          </p>
        </div>
      </div>

      <div className="mt-10 flex w-full flex-col gap-12 sm:gap-16 md:gap-0 md:[--proof-img-w:min(122vw,760px)]">
        {PROOF_IMAGES.map((imageSrc, index) => {
          const anchorClass =
            index === 0
              ? "left-[30%] w-[min(122vw,760px)] max-w-none -translate-x-1/2 md:left-0"
              : "left-[70%] w-[min(122vw,760px)] max-w-none -translate-x-1/2 md:left-full"
          return (
            <div
              key={imageSrc}
              className={
                index === 1
                  ? "relative z-10 w-full overflow-x-hidden md:-mt-[calc(var(--proof-img-w)*0.4)]"
                  : "relative w-full overflow-x-hidden"
              }
            >
              <div className={`relative ${anchorClass}`}>
                <Image
                  src={encodeURI(imageSrc)}
                  alt={`Instagram profile proof ${index + 1}`}
                  width={900}
                  height={1800}
                  className="h-auto w-full object-contain object-center drop-shadow-[0_24px_48px_rgba(0,0,0,0.12)] dark:drop-shadow-[0_24px_48px_rgba(0,0,0,0.35)]"
                  sizes="100vw"
                  priority={index === 0}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
