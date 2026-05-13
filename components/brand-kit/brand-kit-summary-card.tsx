import type { BrandKit } from "@/lib/brand-kit/types"
import { normalizeMinimalBrandColors } from "@/lib/brand-kit/normalize-minimal-colors"
import { cn } from "@/lib/utils"

function pickThumbUrl(kit: BrandKit): string | null {
  const u =
    kit.logoUrl?.trim() ||
    kit.logoDarkUrl?.trim() ||
    kit.iconUrl?.trim() ||
    kit.iconDarkUrl?.trim() ||
    null
  return u || null
}

function initialLetter(name: string): string {
  const t = name.trim()
  return t ? t.slice(0, 1).toUpperCase() : "?"
}

export type BrandKitSummaryCardProps = {
  kit: BrandKit
  className?: string
  /** When false, only the inner layout (for nesting inside `Card` or other shells). */
  framed?: boolean
}

/**
 * Compact brand preview: logo / initial, name, tagline, URL, and normalized palette swatches.
 * Used on the brand hub grid and onboarding review so the same surface appears everywhere.
 */
export function BrandKitSummaryCard({
  kit,
  className,
  framed = true,
}: BrandKitSummaryCardProps) {
  const thumb = pickThumbUrl(kit)
  const colors = normalizeMinimalBrandColors(kit.colors ?? [])

  const body = (
    <>
      <div className="flex gap-4">
        <div
          className={cn(
            "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black",
            thumb ? "ring-1 ring-border/60" : null,
          )}
        >
          {thumb ? (
            // Brand assets come from arbitrary CDNs; native img avoids Next image host allowlists.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-contain p-1.5" />
          ) : (
            <span className="text-lg font-bold tabular-nums text-white">{initialLetter(kit.name)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-base font-semibold leading-tight tracking-tight text-foreground">{kit.name}</p>
          {kit.tagline?.trim() ? (
            <p className="text-sm leading-snug text-muted-foreground">{kit.tagline.trim()}</p>
          ) : null}
          {kit.websiteUrl?.trim() ? (
            <p className="truncate text-xs text-primary">{kit.websiteUrl.trim()}</p>
          ) : null}
        </div>
      </div>
      {colors.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {colors.map((c) => (
            <span
              key={c.role}
              title={c.role}
              className="size-9 shrink-0 rounded-full border border-border shadow-sm"
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      ) : null}
    </>
  )

  if (!framed) {
    return <div className={cn(className)}>{body}</div>
  }

  return (
    <div
      className={cn(
        "w-full rounded-2xl border border-border bg-muted/40 p-5 text-foreground shadow-sm",
        className,
      )}
    >
      {body}
    </div>
  )
}
