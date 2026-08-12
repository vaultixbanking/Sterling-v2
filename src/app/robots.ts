import type { MetadataRoute } from "next"

import { company } from "@/lib/site"

/**
 * Every logged-in surface is already `noindex` via its route-group layout, but
 * crawlers still spend budget fetching them to find that out. Blocking them
 * here keeps the crawl on the pages that can actually rank.
 */
const privatePaths = [
  "/api/",
  "/admin",
  "/dashboard",
  "/deposit",
  "/withdraw",
  "/transactions",
  "/settings",
  "/calculator",
  "/plans",
  "/markets",
  "/welcome",
  // Token-bearing URLs — never worth crawling, and the tokens are single-use.
  "/reset-password",
  "/verify-email",
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: privatePaths,
    },
    sitemap: `${company.url}/sitemap.xml`,
    host: company.url,
  }
}
