"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

import type { FeatureLandingConfig } from "@/lib/types/feature-landing"

type FaqProps = {
  faq: FeatureLandingConfig["faq"]
}

export function FeatureLandingFaq({ faq }: FaqProps) {
  const heading = faq.heading ?? "Frequently asked questions"
  return (
    <section className="border-b border-border/60 bg-background py-12 sm:py-16" aria-labelledby="faq-heading">
      <div className="mx-auto w-full max-w-3xl px-4 lg:px-8">
        <h2 id="faq-heading" className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
          {heading}
        </h2>
        <Accordion type="single" collapsible className="mt-10 w-full">
          {faq.items.map((item, index) => (
            <AccordionItem key={item.question} value={`faq-${index}`}>
              <AccordionTrigger className="text-left text-base font-medium hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
