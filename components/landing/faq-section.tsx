// FAQ copy: no em dash; use commas, periods, or "to" for ranges.

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqData = [
  {
    question: "How does UniCan help me make Instagram content faster?",
    answer:
      "You work with an agent, not a blank canvas. Say what you want, a Reel idea, a carousel, a new hook, a lip sync clip, or a batch of stills. It does the heavy lifting and hands you drafts so you spend less time in tools and more time posting.",
  },
  {
    question: "What can I actually make? Is it just one kind of post?",
    answer:
      "You can aim at lots of different outputs. Same day you might ask for a story series, then a product shot, then a short video. You steer in plain language and the agent figures out how to get there.",
  },
  {
    question: "Do I need design or video skills?",
    answer:
      "No. If you can say what you want in a sentence or two, you are in good shape. The agent runs the workflow. You can tweak results, but you do not need to build everything by hand.",
  },
  {
    question: "Can I start free?",
    answer:
      "Yes. Sign up and try the main flows. Plans and limits are on the pricing page.",
  },
]

export function FAQSection() {
  return (
    <section id="faq" className="w-full bg-background py-16 sm:py-24">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-3xl font-semibold text-foreground sm:text-4xl">
          Frequently Asked Questions
        </h2>
        <Accordion type="single" collapsible className="mt-10 w-full">
          {faqData.map((faq, index) => (
            <AccordionItem key={faq.question} value={`item-${index}`}>
              <AccordionTrigger className="text-left text-base font-medium hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
