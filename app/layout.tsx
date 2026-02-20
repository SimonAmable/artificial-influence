import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/app/theme-provider"
import { Header } from "@/components/app/header"
import { LayoutModeProviderWrapper } from "@/components/shared/layout/layout-mode-provider-wrapper"
import { Toaster } from "@/components/ui/sonner"
import { AIChat } from "@/components/ai-chat"
import { Analytics } from "@vercel/analytics/next"

export const metadata: Metadata = {
  title: "UniCan",
  description: "Create and manage AI-powered content with uncanny AI generation tools",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <LayoutModeProviderWrapper>
            <Header />
            {children}
          </LayoutModeProviderWrapper>
          <Toaster />
          <AIChat />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
