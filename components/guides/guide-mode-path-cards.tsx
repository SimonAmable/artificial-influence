"use client"

import { OptionGroup } from "@/components/shared/option-group"
import type { GuidePathCard, GuidePathRelation } from "@/lib/guides/types"

export function GuideModePathCards({
  heading,
  paths,
  relation = "or",
}: {
  heading: string
  paths: GuidePathCard[]
  relation?: GuidePathRelation
}) {
  return (
    <OptionGroup
      heading={heading}
      relation={relation}
      items={paths.map((path) => ({
        title: path.title,
        description: path.description,
        href: path.ctaHref,
        ctaLabel: path.ctaLabel,
        meta: path.meta,
        mediaSrc: path.mediaSrc,
        mediaAlt: path.mediaAlt,
      }))}
    />
  )
}
