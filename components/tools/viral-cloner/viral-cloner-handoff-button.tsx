"use client"

import { useRouter } from "next/navigation"
import { LinkSimple } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { saveViralClonerHandoff } from "@/lib/viral-cloner/handoff"

type ViralClonerHandoffButtonProps = {
  characterAssetId?: string | null
  characterPreviewUrl?: string | null
  className?: string
}

export function ViralClonerHandoffButton({
  characterAssetId,
  characterPreviewUrl,
  className,
}: ViralClonerHandoffButtonProps) {
  const router = useRouter()

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={() => {
        saveViralClonerHandoff({ characterAssetId, characterPreviewUrl })
        router.push("/viral-cloner")
      }}
    >
      <LinkSimple className="mr-1.5 size-4" />
      Viral Cloner
    </Button>
  )
}