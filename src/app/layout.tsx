import type { Metadata, Viewport } from "next"
import { Inter, Sora, JetBrains_Mono } from "next/font/google"
import "./globals.css"

import { Providers } from "@/components/providers"
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
  openGraph: {
    type: "website",
    siteName: company.name,
    title: `${company.name} — ${company.tagline}`,
    description: company.description,
    images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${company.name} — ${company.tagline}`,
    description: company.description,
    images: ["/og-image.jpg"],
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
