import type { Metadata } from "next"

import { CarouselShotsTool } from "@/components/tools/carousel-shots"

export const metadata: Metadata = {
  title: "Carousel Shots",
  description:
    "Generate consistent carousel panels from one reference image using a contact sheet workflow.",
}

export default function CarouselShotsPage() {
  return <CarouselShotsTool />
}
