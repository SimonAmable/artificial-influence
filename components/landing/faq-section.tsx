import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqData = [
  {
    question: "What can I build with Artificial Influence?",
    answer:
      "You can generate image sets, motion assets, lip-synced videos, and influencer-style campaign creatives from one workspace.",
  },
  {
    question: "Do I need design experience to use it?",
    answer:
      "No. You can begin with references and prompts, then iterate visually through guided workflows and templates.",
  },
  {
    question: "Can I start free?",
    answer:
      "Yes. You can create an account and explore core features before upgrading to higher-volume plans.",
  },
  {
    question: "Are outputs usable for commercial projects?",
    answer:
      "Yes, based on your selected plan and usage terms. Pricing and rights details are listed in the pricing page.",
  },
  {
    question: "How quickly can teams ship content?",
    answer:
      "Most teams use the workflow system to move from concept to campaign-ready assets in significantly fewer revision cycles.",
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
