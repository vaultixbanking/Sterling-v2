import { Section } from "@/components/site/section"
import { SectionHeading } from "@/components/site/section-heading"
import { Reveal } from "@/components/site/reveal"
import { steps } from "@/lib/site"

export function HowItWorks() {
  return (
    <Section
      id="how-it-works"
      className="bg-linear-to-b from-secondary-50 to-white"
    >
      <Reveal>
        <SectionHeading
          eyebrow="Getting started"
          title="Trading in four steps"
          description="From signup to your first position in under ten minutes. No paperwork, no waiting on a branch to call you back."
        />
      </Reveal>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <Reveal key={step.title} delay={i * 0.08}>
            <div className="group h-full rounded-2xl border border-secondary-100/60 bg-white p-5 shadow-md transition-all duration-300 hover:-translate-y-2 hover:border-primary-200 hover:shadow-2xl">
              <div className="relative overflow-hidden rounded-xl bg-secondary-900">
                <video
                  src={step.video}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-hidden
                  className="aspect-square h-full w-full object-cover"
                />
                <span className="absolute top-3 left-3 flex size-8 items-center justify-center rounded-lg bg-primary-600 font-heading text-sm font-bold text-white shadow-lg">
                  {i + 1}
                </span>
              </div>

              <div className="mt-5 flex items-center gap-2.5">
                <step.icon className="size-5 shrink-0 text-primary-600" />
                <h3 className="text-lg font-bold text-secondary-900 transition-colors group-hover:text-primary-600">
                  {step.title}
                </h3>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-secondary-600">
                {step.description}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
