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
      "Artificial Influence is a cutting-edge platform that provides AI-powered tools for content creation, including image generation, motion copy, lip sync, and image editing. Our platform helps creators bring their ideas to life with advanced artificial intelligence technology.",
  },
  {
    question: "How do I get started?",
    answer:
      "Getting started is easy! Simply sign up for an account, choose a plan that fits your needs, and start exploring our suite of AI tools. Each tool comes with detailed guides and examples to help you create amazing content.",
  },
  {
    question: "What file formats are supported?",
    answer:
      "We support a wide range of file formats including PNG, JPEG, MP4, and more. Our image tools work with common image formats, while our video tools support standard video formats. Check the individual tool pages for specific format requirements.",
  },
  {
    question: "Is there a free trial available?",
    answer:
      "Yes! We offer a free trial that allows you to explore our platform and test out our AI tools. The trial includes limited usage so you can experience the quality and capabilities of our services before committing to a paid plan.",
  },
  {
    question: "How does the AI image generation work?",
    answer:
      "Our AI image generation uses advanced machine learning models trained on vast datasets. Simply provide a text description of what you want to create, and our AI will generate high-quality images that match your vision. You can refine and iterate on your prompts to get the perfect result.",
  },
  {
    question: "Can I use generated content commercially?",
    answer:
      "Yes, content generated through our platform can be used for commercial purposes according to your subscription plan. Please review our terms of service for specific details about usage rights and licensing.",
  },
  {
    question: "What kind of support do you offer?",
    answer:
      "We offer comprehensive support through email, documentation, and community forums. Premium subscribers also get priority support with faster response times and access to advanced features and tutorials.",
  },
  {
    question: "How secure is my data?",
    answer:
      "We take data security seriously. All your content and personal information is encrypted and stored securely. We follow industry best practices and comply with data protection regulations to ensure your privacy and security.",
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
          Frequently Asked Questions
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
