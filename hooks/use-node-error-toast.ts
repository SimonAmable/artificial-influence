"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { isInsufficientCreditsMessage } from "@/lib/generate-image-client"

/** Show `nodeData.error` as a Sonner toast (in addition to inline UI in the prompt toolbar). */
export function useNodeErrorToast(nodeId: string, error: string | null | undefined) {
  const prevRef = useRef<string | null>(undefined)

  useEffect(() => {
    const toastId = `canvas-node-error-${nodeId}`
    const normalized = error?.trim() ? error : null

    if (normalized && normalized !== prevRef.current) {
      if (isInsufficientCreditsMessage(normalized)) {
        toast.error(normalized, {
          id: toastId,
          description: "Upgrade your plan to continue generating.",
          action: {
            label: "View Plans",
            onClick: () => window.open("/pricing", "_blank"),
          },
        })
      } else if (normalized.includes("Concurrency limit reached")) {
        toast.error("Too many active generations", {
          id: toastId,
          description: `${normalized} Wait for one to finish, then try again.`,
        })
      } else {
        toast.error(normalized, { id: toastId })
      }
    } else if (!normalized && prevRef.current) {
      toast.dismiss(toastId)
    }
    prevRef.current = normalized
  }, [nodeId, error])
}
