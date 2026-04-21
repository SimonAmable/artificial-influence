import { type ComponentPropsWithoutRef, type CSSProperties, type ReactNode } from "react"
import { ArrowRightIcon } from "@radix-ui/react-icons"

import { isAiMonochromeIconPath } from "@/lib/constants/ai-vendor-icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface BentoGridProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode
  className?: string
}

interface BentoCardProps extends ComponentPropsWithoutRef<"div"> {
  name: string
  className: string
  background: ReactNode
  /** Optional; omit when the card has no leading glyph (e.g. media-only header). */
  Icon?: React.ElementType
  /** Optional brand logo from `public/` (e.g. `/ai_icons/openai.svg`). Shown instead of Icon when set. */
  logoSrc?: string
  logoAlt?: string
  description: string
  href: string
  cta: string
  /** Override bottom text scrim gradient (defaults to dark fade to transparent). */
  textScrimStyle?: CSSProperties
}

const BentoCard = ({
  name,
  className,
  background,
  Icon,
  logoSrc,
  logoAlt,
  description,
  href,
  cta,
  textScrimStyle,
  ...props
}: BentoCardProps) => (
  <div
    className={cn(
      "group relative col-span-3 flex min-h-[280px] flex-col overflow-hidden rounded-3xl border border-white/10",
      "shadow-[0_24px_48px_-8px_rgba(0,0,0,0.55)] dark:shadow-[0_28px_56px_-6px_rgba(0,0,0,0.65)]",
      "transform-gpu",
      className
    )}
    style={
      {
        ["--bento-scrim-from" as string]: "rgb(0 0 0 / 0.88)",
        ["--bento-scrim-via" as string]: "rgb(0 0 0 / 0.38)",
        ...textScrimStyle,
      } as CSSProperties
    }
    {...props}
  >
    {/* Full-bleed media */}
    <div className="absolute inset-0 z-0 h-full min-h-full w-full *:h-full *:min-h-full *:w-full">
      {background}
    </div>

    {/* Bottom-only gradient behind text (fades to transparent; no full-card wash) */}
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-1 h-[min(52%,11rem)] bg-linear-to-t from-(--bento-scrim-from) via-(--bento-scrim-via) to-transparent"
      aria-hidden
    />

    <div className="relative z-10 mt-auto flex flex-col justify-end p-5">
      <div className="pointer-events-none z-10 flex transform-gpu flex-col gap-1 text-white transition-all duration-300 lg:group-hover:-translate-y-10">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- public SVG/PNG brand marks
          <img
            src={logoSrc}
            alt={logoAlt ?? ""}
            className={cn(
              "h-10 w-auto max-w-[9rem] origin-left object-contain object-left drop-shadow-md transition-all duration-300 ease-in-out group-hover:scale-95",
              isAiMonochromeIconPath(logoSrc) && "brightness-0 invert"
            )}
          />
        ) : Icon ? (
          <Icon className="h-10 w-10 origin-left transform-gpu text-white/90 transition-all duration-300 ease-in-out group-hover:scale-75" />
        ) : null}
        <h3 className="text-xl font-semibold text-white drop-shadow-sm">{name}</h3>
        <p className="max-w-lg text-sm text-white/80 drop-shadow-sm">{description}</p>
      </div>

      <div
        className={cn(
          "pointer-events-none flex w-full translate-y-0 transform-gpu flex-row items-center pt-3 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 lg:hidden"
        )}
      >
        <Button variant="link" asChild size="sm" className="pointer-events-auto h-auto px-3 py-2 text-white">
          <a href={href}>
            {cta}
            <ArrowRightIcon className="ms-2 h-4 w-4 rtl:rotate-180" />
          </a>
        </Button>
      </div>
    </div>

    <div
      className={cn(
        "pointer-events-none absolute bottom-0 hidden w-full translate-y-10 transform-gpu flex-row items-center p-5 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 lg:flex"
      )}
    >
      <Button variant="link" asChild size="sm" className="pointer-events-auto h-auto px-3 py-2 text-white">
        <a href={href}>
          {cta}
          <ArrowRightIcon className="ms-2 h-4 w-4 rtl:rotate-180" />
        </a>
      </Button>
    </div>
  </div>
)

const BentoGrid = ({ children, className, ...props }: BentoGridProps) => {
  return (
    <div
      className={cn(
        "grid w-full auto-rows-[22rem] grid-cols-3 gap-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { BentoCard, BentoGrid }
