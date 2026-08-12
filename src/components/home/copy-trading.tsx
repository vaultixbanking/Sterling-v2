import { Section } from "@/components/site/section"
import { SectionHeading } from "@/components/site/section-heading"
import { Reveal } from "@/components/site/reveal"
import { copyTradingVideos } from "@/lib/site"

export function CopyTrading() {
  return (
    <Section id="copy-trading" className="bg-white">
      <Reveal>
        <SectionHeading
          title="Follow traders who already know the way"
          description="Mirror the positions of experienced traders automatically, in proportion to your own capital. Watch how it works, then decide who earns your allocation."
        />
      </Reveal>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {copyTradingVideos.map((item, i) => (
          <Reveal key={item.title} delay={i * 0.08}>
            <div className="group h-full overflow-hidden rounded-2xl border border-secondary-100/60 bg-white shadow-md transition-all duration-300 hover:-translate-y-2 hover:border-primary-200 hover:shadow-2xl">
              <div className="overflow-hidden bg-secondary-900">
                <video
                  src={item.video}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-hidden
                  className="aspect-[1184/1012] h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              <div className="p-6">
                <h3 className="text-lg font-bold text-secondary-900 transition-colors group-hover:text-primary-600">
                  {item.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-secondary-600">
                  {item.description}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
