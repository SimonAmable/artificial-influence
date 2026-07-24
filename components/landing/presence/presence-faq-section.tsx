import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { presenceLandingCopy } from "@/lib/constants/presence-landing-content"

export function PresenceFaqSection() {
  const { faq } = presenceLandingCopy

  return (
    <section id="faq" className="w-full bg-background py-16 sm:py-24">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-3xl font-semibold text-foreground sm:text-4xl">
          {faq.title}
        </h2>
        <Accordion type="single" collapsible className="mt-10 w-full">
          {faq.items.map((item, index) => (
            <AccordionItem key={item.question} value={`item-${index}`}>
              <AccordionTrigger className="text-left text-base font-medium hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
