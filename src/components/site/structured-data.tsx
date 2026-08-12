import { company, faqs } from "@/lib/site"

/**
 * JSON-LD for the marketing home page.
 *
 * Two graphs: the brokerage itself, so search engines can build a knowledge
 * panel from the real contact details in `site.ts`, and the FAQ, which is what
 * earns the expandable answers under the search result. Both are generated from
 * the same config the page renders, so they can never drift from the visible
 * copy — which is exactly what Google penalises.
 */

/** `<` is the only character that can terminate a script block early. */
function serialize(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c")
}

const organization = {
  "@context": "https://schema.org",
  "@type": "FinancialService",
  "@id": `${company.url}/#organization`,
  name: company.name,
  alternateName: company.shortName,
  url: company.url,
  logo: `${company.url}/logo-mark.png`,
  image: `${company.url}/og-image.jpg`,
  description: company.description,
  email: company.email,
  telephone: company.phone,
  address: {
    "@type": "PostalAddress",
    streetAddress: company.addressParts.street,
    addressLocality: company.addressParts.locality,
    addressRegion: company.addressParts.region,
    postalCode: company.addressParts.postalCode,
    addressCountry: company.addressParts.country,
  },
  areaServed: "Worldwide",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: company.email,
    telephone: company.phone,
    availableLanguage: "English",
    hoursAvailable: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "00:00",
      closes: "23:59",
    },
  },
}

const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${company.url}/#website`,
  url: company.url,
  name: company.name,
  description: company.description,
  publisher: { "@id": `${company.url}/#organization` },
}

const faqPage = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${company.url}/#faq`,
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
}

export function StructuredData() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serialize(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serialize(website) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serialize(faqPage) }}
      />
    </>
  )
}
