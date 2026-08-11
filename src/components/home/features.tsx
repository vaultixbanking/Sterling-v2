import { Section } from "@/components/site/section"
import { SectionHeading } from "@/components/site/section-heading"
import { Reveal } from "@/components/site/reveal"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { features } from "@/lib/site"

export function Features() {
  return (
    <Section id="why-us" className="bg-white">
      <Reveal>
        <SectionHeading
          eyebrow="Why Sterling Edge"
          title="Built for traders who take it seriously"
          description="Everything here exists to remove friction between your decision and your position — and to make sure your capital is still there tomorrow."
        />
      </Reveal>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, i) => (
          <Reveal key={feature.title} delay={(i % 3) * 0.08}>
            <Card className="h-full">
              <div
                aria-hidden
                className={`absolute inset-0 rounded-2xl bg-linear-to-br ${feature.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-[0.04]`}
              />

              <div className="relative z-10">
                <div
                  className={`mb-5 flex size-14 items-center justify-center rounded-xl bg-linear-to-br ${feature.gradient} shadow-lg transition-transform duration-300 group-hover:scale-110 sm:size-16`}
                >
                  <feature.icon className="size-7 text-white sm:size-8" />
                </div>

                <CardTitle className="mb-3 transition-colors group-hover:text-primary-600">
                  {feature.title}
                </CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
