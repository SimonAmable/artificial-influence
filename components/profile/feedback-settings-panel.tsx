"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export type FeedbackType =
  | "general"
  | "bug"
  | "feature"
  | "improvement"
  | "template_request"

export type FeedbackSettingsPanelProps = {
  variant?: "dialog" | "modal"
  onSubmitted?: () => void
  onCancel?: () => void
  open?: boolean
  initialFeedbackType?: FeedbackType
  hideFeedbackType?: boolean
}

const DEFAULT_FEEDBACK_TYPE: FeedbackType = "general"

const FEEDBACK_COPY: Record<
  FeedbackType,
  {
    description: string
    messageLabel: string
    messagePlaceholder: string
  }
> = {
  general: {
    description: "Help us improve by sharing your thoughts, suggestions, or reporting issues.",
    messageLabel: "Message",
    messagePlaceholder: "Tell us what you think...",
  },
  bug: {
    description: "Tell us what broke, what you expected, and how we can reproduce it.",
    messageLabel: "Message",
    messagePlaceholder: "Describe the bug, what happened, and the steps that led to it...",
  },
  feature: {
    description: "Share the feature you want and how it would help your workflow.",
    messageLabel: "Message",
    messagePlaceholder: "Tell us which feature you want and why it matters...",
  },
  improvement: {
    description: "Point out any workflow, UI, or quality improvements you want to see.",
    messageLabel: "Message",
    messagePlaceholder: "Tell us what should be improved and how you would change it...",
  },
  template_request: {
    description: "Share a trend, format, or reference you want turned into a template.",
    messageLabel: "What should we make?",
    messagePlaceholder:
      "Describe the hook, format, or visual style you want.",
  },
}

export function FeedbackSettingsPanel({
  variant = "dialog",
  onSubmitted,
  onCancel,
  open,
  initialFeedbackType = DEFAULT_FEEDBACK_TYPE,
  hideFeedbackType = false,
}: FeedbackSettingsPanelProps) {
  const [feedbackType, setFeedbackType] = React.useState<FeedbackType>(initialFeedbackType)
  const [message, setMessage] = React.useState("")
  const [tiktokLinks, setTiktokLinks] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const isModal = variant === "modal"
  const typeId = isModal ? "feedback-type-modal" : "feedback-type"
  const messageId = isModal ? "feedback-message-modal" : "message"
  const tiktokLinksId = isModal ? "feedback-tiktok-links-modal" : "feedback-tiktok-links"
  const isTemplateRequest = feedbackType === "template_request"
  const activeCopy = FEEDBACK_COPY[feedbackType]

  React.useEffect(() => {
    if (!open) return
    setFeedbackType(initialFeedbackType)
    setMessage("")
    setTiktokLinks("")
  }, [initialFeedbackType, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!message.trim()) {
      toast.error("Please enter your feedback message")
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase.from("feedback").insert({
        user_id: user?.id || null,
        feedback_type: feedbackType,
        message: message.trim(),
        tiktok_links: isTemplateRequest ? tiktokLinks.trim() || null : null,
      })

      if (error) throw error

      toast.success("Thank you for your feedback! We'll review it soon.")
      setMessage("")
      setTiktokLinks("")
      setFeedbackType(initialFeedbackType)
      onSubmitted?.()
    } catch (error) {
      console.error("Error submitting feedback:", error)
      toast.error("Failed to submit feedback. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn("w-full max-w-none space-y-6", isModal && "min-w-0")}>
      <p className="text-sm text-muted-foreground">
        {activeCopy.description}
      </p>

      <div className="grid gap-4">
        {hideFeedbackType ? null : (
          <div className="grid gap-2">
            <Label htmlFor={typeId}>Feedback type</Label>
            <Select value={feedbackType} onValueChange={(value) => setFeedbackType(value as FeedbackType)}>
              <SelectTrigger id={typeId} className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Feedback</SelectItem>
                <SelectItem value="bug">Bug Report</SelectItem>
                <SelectItem value="feature">Feature Request</SelectItem>
                <SelectItem value="improvement">Improvement Suggestion</SelectItem>
                <SelectItem value="template_request">Template Request</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {isTemplateRequest ? (
          <div className="grid gap-2">
            <Label htmlFor={tiktokLinksId}>Example links</Label>
            <Textarea
              id={tiktokLinksId}
              placeholder="Paste TikTok links or references."
              value={tiktokLinks}
              onChange={(e) => setTiktokLinks(e.target.value)}
              className="min-h-[96px] w-full resize-none"
            />
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor={messageId}>{activeCopy.messageLabel}</Label>
          <Textarea
            id={messageId}
            placeholder={activeCopy.messagePlaceholder}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[140px] w-full resize-none"
            required
          />
        </div>
      </div>

      <div
        className={cn(
          "flex gap-3",
          isModal ? "flex-row flex-wrap" : "flex-col-reverse sm:flex-row sm:justify-end"
        )}
      >
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} className={isModal ? "rounded-full" : undefined}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting} className={isModal ? "rounded-full" : undefined}>
          {isSubmitting ? "Submitting..." : isTemplateRequest ? "Send request" : "Submit feedback"}
        </Button>
      </div>
    </form>
  )
}
