'use client'

import { Suspense } from 'react'
import { useAffiliateRefCapture } from '@/hooks/use-affiliate-ref'

function AffiliateRefCaptureInner() {
  useAffiliateRefCapture()
  return null
}

export function AffiliateRefCapture() {
  return (
    <Suspense fallback={null}>
      <AffiliateRefCaptureInner />
    </Suspense>
  )
}
