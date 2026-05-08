"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

type NewChatButtonProps = Omit<React.ComponentProps<typeof Button>, "type">

export function NewChatButton({ children, onClick, ...props }: NewChatButtonProps) {
  const router = useRouter()

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event)
      const token = Date.now().toString()
      router.push(`/chat?new=${token}`)
    },
    [onClick, router],
  )

  return (
    <Button type="button" {...props} onClick={handleClick}>
      {children}
    </Button>
  )
}
