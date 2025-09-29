import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import { RootErrorBoundary } from "@/components/error-boundaries/RootErrorBoundary"
import { Suspense } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "Texas811 POC Dashboard",
  description: "Utility locate ticket management dashboard",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <RootErrorBoundary>
          <Suspense fallback={null}>
            {children}
            <Toaster />
          </Suspense>
        </RootErrorBoundary>
        <Analytics />
      </body>
    </html>
  )
}
