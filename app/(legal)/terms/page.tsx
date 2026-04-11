import type { Metadata } from "next"

import { LegalPage } from "@/components/legal/legal-page"
import { getLegalMetadata } from "@/lib/legal/metadata"

export const metadata: Metadata = getLegalMetadata("terms")

export default function TermsPage() {
  return <LegalPage slug="terms" />
}
