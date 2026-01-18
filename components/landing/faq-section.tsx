"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { CaretDown } from "@phosphor-icons/react"

const faqData = [
  {
    question: "What is Artificial Influence?",
    answer:
      "An AI-powered platform for content creation including image generation, motion copy, lip sync, and image editing.",
  },
  {
    question: "How do I get started?",
    answer:
      "Sign up for an account, choose a plan, and start using our AI tools. Each tool includes guides and examples.",
  },
  {
    question: "Is there a free trial available?",
    answer:
      "Yes! We offer a free trial with limited usage so you can test our AI tools before committing to a paid plan.",
  },
  {
    question: "How does the AI image generation work?",
    answer:
      "Provide a text description and our AI generates high-quality images. Refine your prompts to get the perfect result.",
  },
  {
    question: "Can I use generated content commercially?",
    answer:
      "Yes, according to your subscription plan. Review our terms of service for specific usage rights and licensing details.",
  },
  {
    question: "What kind of support do you offer?",
    answer:
      "Support via email, documentation, and community forums. Premium subscribers get priority support and faster response times.",
  },
  {
    question: "How secure is my data?",
    answer:
      "All content and personal information is encrypted and stored securely. We follow industry best practices and comply with data protection regulations.",
  },
]

export function FAQSection() {
  return (
    <section
      className={cn(
        "relative min-h-screen w-full",
        "flex items-center justify-center",
        "bg-background",
        "py-8 md:py-12"
      )}
    >
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4">
        <h2 className="text-4xl md:text-5xl font-bold text-center text-foreground mb-12">
          FREQUENTLY ASKED QUESTIONS
        </h2>
        <Accordion type="single" collapsible className="w-full">
          {faqData.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left hover:no-underline">
                {faq.question}
                <CaretDown className="h-4 w-4 shrink-0 transition-transform duration-200 ml-auto" />
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
