// FAQ copy: no em dash; use commas, periods, or "to" for ranges.

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqData = [
  {
    question: "What can UniCan do for my Instagram workflow?",
    answer:
      "Make stills, Reels, and lip sync clips in one place, then post on your schedule. Save prompts and references so you can repeat what works.",
  },
  {
    question: "Do I need design or video experience?",
    answer:
      "No. Start from references and short prompts, then edit on the canvas. New to Reels? Try Motion Copy and Lip Sync first.",
  },
  {
    question: "Can I start free?",
    answer:
      "Yes. Sign up and try the main flows. Plans and limits are on the pricing page.",
  },
  {
    question: "How do I cancel my subscription?",
    answer:
      "In the app, open your profile, go to billing or account settings, and cancel there. You keep access through the end of your paid period per your plan.",
  },
  {
    question: "Are outputs usable for commercial Instagram campaigns?",
    answer:
      "Yes, if your plan allows it. Read the terms at checkout and on pricing. Match your tier to how you use assets for ads or client work.",
  },
  {
    question: "How should I warm up a new Instagram account before leaning on automation?",
    answer:
      "Use it like a normal account first. Scroll, save, and engage in your niche for 20 to 30 minutes a day for a few days before you post a lot. Then post about once or twice a day and keep browsing daily. If reach drops hard, pause posts, use the account normally again, then ramp back slowly.",
  },
  {
    question: "What posting rhythm works best when I am automating creative?",
    answer:
      "Often one or two posts a day until reach looks steady, then add more if it holds. Steady beats random spikes.",
  },
  {
    question: "What content formats tend to work on Instagram with AI-assisted production?",
    answer:
      "Carousels and list posts get saves. Reels need motion. In UniCan, use image flows for carousels and Motion Copy for Reels. Copy hooks that work in other niches, then rewrite for your crowd.",
  },
  {
    question: "Can I repurpose Instagram assets to TikTok, Shorts, or elsewhere?",
    answer:
      "Yes. Export and resize or recrop per app. Change the hook and pace for each platform.",
  },
  {
    question: "How fast can a team ship with UniCan compared to manual creation?",
    answer:
      "You generate and compare on the canvas instead of long back and forth. That cuts rounds when you test new hooks each week.",
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
