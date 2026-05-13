import type { Metadata } from "next"

import { FancyButtonsShowcase } from "./fancy-buttons-showcase"

export const metadata: Metadata = {
  title: "Testing",
}

export default function TestingPage() {
  return <FancyButtonsShowcase />
}
