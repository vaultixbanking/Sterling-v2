import Link from "next/link"

import { Section } from "@/components/site/section"
import { SectionHeading } from "@/components/site/section-heading"
import { Reveal } from "@/components/site/reveal"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { company, faqs, supportEmailHref } from "@/lib/site"

export function Faq() {
  return (
    <Section id="faq" className="bg-secondary-50">
      <Reveal>
        <SectionHeading
          title="Questions, answered"
          description="The things people ask us most often before opening an account."
        />
      </Reveal>

      <Reveal delay={0.1}>
        <Accordion
          type="single"
          collapsible
          className="mx-auto mt-12 flex max-w-3xl flex-col gap-3"
        >
          {faqs.map((faq, i) => (
            <AccordionItem key={faq.question} value={`item-${i}`}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>

      <Reveal delay={0.15}>
        <p className="mt-10 text-center text-sm text-secondary-600">
          Still have a question?{" "}
          <Link
            href={supportEmailHref}
            className="font-semibold text-primary-600 underline-offset-4 hover:underline"
          >
            Email {company.email}
          </Link>{" "}
          — we answer 24/7.
        </p>
      </Reveal>
    </Section>
  )
}
