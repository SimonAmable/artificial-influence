"use client"

import { memo } from "react"
import ReactMarkdown from "react-markdown"

export const MemoizedMarkdown = memo(
  ({ content, id }: { content: string; id: string }) => {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
            li: ({ children }) => <li className="mb-1">{children}</li>,
            code: ({ inline, children, ...props }: any) =>
              inline ? (
                <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props}>
                  {children}
                </code>
              ) : (
                <code className="block bg-muted p-2 rounded text-sm overflow-x-auto" {...props}>
                  {children}
                </code>
              ),
            pre: ({ children }) => <pre className="mb-2 overflow-x-auto">{children}</pre>,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    )
  },
  (prevProps, nextProps) => {
    return prevProps.id === nextProps.id && prevProps.content === nextProps.content
  }
)

MemoizedMarkdown.displayName = "MemoizedMarkdown"
