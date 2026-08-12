import type { Metadata } from "next"

import { company } from "@/lib/site"

/**
 * The share card behind every WhatsApp / iMessage / social preview. 1200×630 is
 * the size every scraper crops to, and at ~40KB it stays under WhatsApp's
 * thumbnail budget, which silently drops heavier images.
 */
export const shareImage = {
  url: "/og-image.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: `${company.name} — ${company.tagline}`,
} as const

/** Root-level Open Graph. Exported so pages can extend it without retyping it. */
export const baseOpenGraph: Metadata["openGraph"] = {
  type: "website",
  siteName: company.name,
  locale: "en_US",
  title: `${company.name} — ${company.tagline}`,
  description: company.description,
  images: [shareImage],
}

interface PageSeoOptions {
  /** Page title, without the site suffix — the root template appends that. */
  title: string
  description: string
  /** Route path such as "/signup", resolved against `metadataBase`. */
  path: string
}

/**
 * Builds a complete metadata object for a public page.
 *
 * Next merges metadata *shallowly*: a page that declares `openGraph` replaces
 * the root's copy wholesale rather than merging into it, which silently drops
 * the share image and leaves links previewing as bare text. So every field is
 * rebuilt here instead of relying on inheritance.
 */
export function pageSeo({ title, description, path }: PageSeoOptions): Metadata {
  // og:title has no template applied to it, so spell the full thing out.
  const socialTitle = `${title} | ${company.name}`

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      ...baseOpenGraph,
      url: path,
      title: socialTitle,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [shareImage.url],
    },
  }
}
