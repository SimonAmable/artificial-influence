"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export function TemplateCreateDialog() {
  return (
    <Button asChild className="rounded-full px-5">
      <Link href="/templates/new">
        Create template
      </Link>
    </Button>
  )
}
