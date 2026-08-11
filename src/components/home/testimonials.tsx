import { Quote, Star } from "lucide-react"

import { Section } from "@/components/site/section"
import { SectionHeading } from "@/components/site/section-heading"
import { Reveal } from "@/components/site/reveal"
import { testimonials } from "@/lib/site"

export function Testimonials() {
  return (
    <Section id="testimonials" className="bg-white">
      <Reveal>
        <SectionHeading
          eyebrow="Client stories"
          title="What our traders say"
          description="Real accounts, real balances. Results vary — these are individual experiences, not a promise of what you'll earn."
        />
      </Reveal>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {testimonials.map((testimonial, i) => (
          <Reveal key={testimonial.name} delay={i * 0.08}>
            <figure className="group relative h-full rounded-2xl border border-secondary-100/60 bg-white p-6 shadow-md transition-all duration-300 hover:-translate-y-2 hover:border-primary-200 hover:shadow-2xl sm:p-8">
              <Quote
                aria-hidden
                className="absolute top-5 right-5 size-8 text-primary-100"
              />

              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star
                    key={s}
                    aria-hidden
                    className="size-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>

              <blockquote className="mt-4 text-sm leading-relaxed text-secondary-600">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>

              <figcaption className="mt-6 flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary-500 to-primary-700 font-heading text-sm font-bold text-white">
                  {testimonial.initials}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-secondary-900">
                    {testimonial.name}
                  </span>
                  <span className="block text-xs text-secondary-500">
                    {testimonial.location}
                  </span>
                </span>
              </figcaption>

              <div className="mt-6 border-t border-secondary-100 pt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-secondary-500">Total earnings</span>
                  <span className="tabular font-semibold text-emerald-600">
                    {testimonial.earnings}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary-100">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-primary-500 to-emerald-500"
                    style={{ width: `${testimonial.progress}%` }}
                  />
                </div>
              </div>
            </figure>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
