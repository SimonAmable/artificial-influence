"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { FeedbackDialog } from "@/components/app/feedback-dialog"
import { Button } from "@/components/ui/button"

type TemplateCreateDialogProps = {
  currentUserId?: string | null
}

const TEMPLATE_REQUEST_PARAM = "request-template"

export function TemplateCreateDialog({ currentUserId }: TemplateCreateDialogProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [requestOpen, setRequestOpen] = React.useState(false)
  const isSignedIn = Boolean(currentUserId)

  const requestTemplateNextPath = `${pathname}?${TEMPLATE_REQUEST_PARAM}=1`
  const createTemplateNextPath = "/templates/new"

  const syncRequestTemplateQuery = React.useCallback(
    (open: boolean) => {
      const nextParams = new URLSearchParams(searchParams.toString())

      if (open) {
        nextParams.set(TEMPLATE_REQUEST_PARAM, "1")
      } else {
        nextParams.delete(TEMPLATE_REQUEST_PARAM)
      }

      const nextQuery = nextParams.toString()
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const handleRequestDialogOpenChange = React.useCallback(
    (open: boolean) => {
      setRequestOpen(open)
      syncRequestTemplateQuery(open)
    },
    [syncRequestTemplateQuery]
  )

  React.useEffect(() => {
    if (!isSignedIn) {
      setRequestOpen(false)
      return
    }

    setRequestOpen(searchParams.get(TEMPLATE_REQUEST_PARAM) === "1")
  }, [isSignedIn, searchParams])

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {isSignedIn ? (
          <Button className="rounded-full px-5" onClick={() => handleRequestDialogOpenChange(true)}>
            Request template
          </Button>
        ) : (
          <Button asChild className="rounded-full px-5">
            <Link href={`/login?next=${encodeURIComponent(requestTemplateNextPath)}`}>Request template</Link>
          </Button>
        )}

        <Button asChild variant="outline" className="rounded-full px-5">
          <Link
            href={
              isSignedIn
                ? createTemplateNextPath
                : `/login?next=${encodeURIComponent(createTemplateNextPath)}`
            }
          >
            Create manually
          </Link>
        </Button>
      </div>

      {isSignedIn ? (
        <FeedbackDialog
          open={requestOpen}
          onOpenChange={handleRequestDialogOpenChange}
          title="Request a Template"
          description="Share the trend or reference you want turned into a reusable template."
          initialFeedbackType="template_request"
        />
      ) : null}
    </>
  )
}
