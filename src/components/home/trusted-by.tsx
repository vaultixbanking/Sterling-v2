import Image from "next/image"

import { Section } from "@/components/site/section"
import { Reveal } from "@/components/site/reveal"
import { partners } from "@/lib/site"

export function TrustedBy() {
  return (
    <Section className="bg-white py-12 sm:py-16 lg:py-16">
      <Reveal>
        <p className="text-center text-xs font-semibold tracking-[0.18em] text-secondary-400 uppercase">
          Trusted by investors worldwide
        </p>

        <div className="mt-8 grid grid-cols-3 items-center gap-x-8 gap-y-10 sm:grid-cols-6">
          {partners.map((partner) => (
            <div
              key={partner.name}
              className="flex items-center justify-center"
            >
              {partner.logo ? (
                <Image
                  src={partner.logo}
                  alt={partner.name}
                  width={120}
                  height={40}
                  className="h-7 w-auto object-contain opacity-50 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0 sm:h-8"
                />
              ) : (
                <span className="font-heading text-lg font-bold tracking-tight text-secondary-400 transition-colors duration-300 hover:text-secondary-600 sm:text-xl">
                  {partner.name}
                </span>
              )}
            </div>
          ))}
        </div>
      </Reveal>
    </Section>
  )
}
