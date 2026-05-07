import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/app/theme-provider"
import { Header } from "@/components/app/header"
import { TermsAcceptanceGate } from "@/components/app/terms-acceptance-gate"
import { LayoutModeProviderWrapper } from "@/components/shared/layout/layout-mode-provider-wrapper"
import { Toaster } from "@/components/ui/sonner"
import { AIChat } from "@/components/ai-chat"
import { Analytics } from "@vercel/analytics/next"
import { AffiliateRefCapture } from "@/components/affiliate/affiliate-ref-capture"
import { SitewideJsonLd } from "@/components/seo/sitewide-jsonld"
import { getSiteBaseUrl } from "@/lib/seo/site-url"
import { PricingUpsellController } from "@/components/pricing/pricing-upsell-controller"

const siteBase = getSiteBaseUrl()

export const metadata: Metadata = {
  metadataBase: new URL(siteBase),
  title: {
    default: "UniCan",
    template: "%s | UniCan",
  },
  description: "Create and manage AI-powered content with uncanny AI generation tools",
  openGraph: {
    siteName: "UniCan",
    type: "website",
    locale: "en_US",
    url: siteBase,
  },
  twitter: {
    card: "summary_large_image",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <LayoutModeProviderWrapper>
            <AffiliateRefCapture />
            <Header />
            <main>{children}</main>
          </LayoutModeProviderWrapper>
          <Toaster />
          <PricingUpsellController />
          <AIChat />
          <TermsAcceptanceGate />
        </ThemeProvider>
        <Analytics />
        <SitewideJsonLd />
      </body>
    </html>
  )
}
