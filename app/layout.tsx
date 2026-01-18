import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/app/theme-provider";
import { Header } from "@/components/app/header";
import { LayoutModeProviderWrapper } from "@/components/shared/layout/layout-mode-provider-wrapper";
import { Toaster } from "@/components/ui/sonner";

const notoSans = Noto_Sans({variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Artificial Influence",
  description: "Create and manage AI-powered influencer content with uncanny AI generation tools",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={notoSans.variable} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
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
        </ThemeProvider>
      </body>
    </html>
  );
}
