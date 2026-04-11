import type { Metadata } from "next"

import { LegalPage } from "@/components/legal/legal-page"
import { getLegalMetadata } from "@/lib/legal/metadata"

export const metadata: Metadata = getLegalMetadata("privacy")

export default function PrivacyPage() {
  return <LegalPage slug="privacy" />
}
