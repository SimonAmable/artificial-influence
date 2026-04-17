"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

type NewChatButtonProps = Omit<React.ComponentProps<typeof Button>, "type" | "onClick">

export function NewChatButton({ children, ...props }: NewChatButtonProps) {
  const router = useRouter()

  const handleClick = React.useCallback(() => {
    const token = Date.now().toString()
    router.push(`/chat?new=${token}`)
  }, [router])

  return (
    <Button type="button" onClick={handleClick} {...props}>
      {children}
    </Button>
  )
}
