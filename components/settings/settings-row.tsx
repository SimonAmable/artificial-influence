import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type SettingsSectionProps = {
  title?: string
  children: ReactNode
  className?: string
}

export function SettingsSection({ title, children, className }: SettingsSectionProps) {
  return (
    <section className={cn("space-y-0", className)}>
      {title ? (
        <h2 className="mb-4 text-base font-semibold text-foreground">{title}</h2>
      ) : null}
      {children}
    </section>
  )
}

type SettingsRowProps = {
  label: string
  description?: string
  children?: ReactNode
  value?: string
  className?: string
}

export function SettingsRow({
  label,
  description,
  children,
  value,
  className,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        "flex min-h-[52px] items-center justify-between gap-4 border-b border-border/60 py-3 last:border-b-0",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0 text-right text-sm font-medium text-foreground">
        {children ?? value}
      </div>
    </div>
  )
}
