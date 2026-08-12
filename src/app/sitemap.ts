import type { MetadataRoute } from "next"

import { company } from "@/lib/site"

/**
 * Public, indexable routes only. Everything under the app and admin groups is
 * behind auth, and the password/verification routes only work with a token, so
 * none of them belong in a sitemap.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return [
    {
      url: company.url,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${company.url}/signup`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${company.url}/login`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ]
}
