import type { Metadata, Viewport } from "next"
import { Inter, Sora, JetBrains_Mono } from "next/font/google"
import "./globals.css"

import { Providers } from "@/components/providers"
import { baseOpenGraph, shareImage } from "@/lib/seo"
import { company } from "@/lib/site"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(company.url),
  title: {
    default: `${company.name} — ${company.tagline}`,
    template: `%s | ${company.name}`,
  },
  description: company.description,
  keywords: [
    "online trading",
    "forex broker",
    "crypto trading",
    "stock trading",
    "commodities",
    "CFD trading",
    "investment platform",
    "Sterling Edge Trade",
  ],
  /* Inherited by every route. Deliberately no `alternates.canonical` here —
     metadata is shallow-merged, so a canonical set at the root would tell
     crawlers that every page is a duplicate of it. Canonicals are per page. */
  openGraph: baseOpenGraph,
  twitter: {
    card: "summary_large_image",
    title: `${company.name} — ${company.tagline}`,
    description: company.description,
    images: [shareImage.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Without these Google truncates the snippet and shows a thumbnail.
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#2563eb",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sora.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-white font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
