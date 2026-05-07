import * as React from "react"

import { getAudioModelIconSrc } from "@/lib/constants/audio"

export function AudioModelOptionLabel({
  modelId,
  children,
}: {
  modelId: string
  children: React.ReactNode
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <img
        src={getAudioModelIconSrc(modelId)}
        alt=""
        className="size-4 shrink-0"
        width={16}
        height={16}
        loading="lazy"
      />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  )
}
