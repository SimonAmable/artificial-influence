import { redirect } from "next/navigation"

import { isPresenceProduct } from "@/lib/product/require-presence"

export default function SlideshowsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (isPresenceProduct()) {
    redirect("/templates")
  }

  return children
}
