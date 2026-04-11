import type { ComponentPropsWithoutRef } from "react"
import ReactMarkdown from "react-markdown"

type MarkdownCodeProps = ComponentPropsWithoutRef<"code"> & { inline?: boolean }

export function LegalMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none [&_h2]:scroll-mt-24 [&_h3]:scroll-mt-24">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-3 leading-relaxed last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc pl-5 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal pl-5 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="mb-1.5">{children}</li>,
          h2: ({ children }) => (
            <h2 className="mt-10 mb-3 text-xl font-semibold tracking-tight first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-6 mb-2 text-lg font-semibold tracking-tight">{children}</h3>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ children, href }) => (
            <a
              href={href}
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/90"
            >
              {children}
            </a>
          ),
          code: ({ inline, children, ...props }: MarkdownCodeProps) =>
            inline ? (
              <code className="rounded bg-muted px-1 py-0.5 text-[0.9em]" {...props}>
                {children}
              </code>
            ) : (
              <code className="block overflow-x-auto rounded-md bg-muted p-3 text-sm" {...props}>
                {children}
              </code>
            ),
          pre: ({ children }) => <pre className="mb-3 overflow-x-auto rounded-md">{children}</pre>,
          hr: () => <hr className="my-8 border-border" />,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-muted-foreground/30 pl-4 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
