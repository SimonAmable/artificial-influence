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

export type FeedbackSettingsPanelProps = {
  variant?: "dialog" | "modal"
  onSubmitted?: () => void
  onCancel?: () => void
}

export function FeedbackSettingsPanel({
  variant = "dialog",
  onSubmitted,
  onCancel,
}: FeedbackSettingsPanelProps) {
  const [feedbackType, setFeedbackType] = React.useState("general")
  const [message, setMessage] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const isModal = variant === "modal"
  const typeId = isModal ? "feedback-type-modal" : "feedback-type"
  const messageId = isModal ? "feedback-message-modal" : "message"

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
      })

      if (error) throw error

      toast.success("Thank you for your feedback! We'll review it soon.")
      setMessage("")
      setFeedbackType("general")
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
        Help us improve by sharing your thoughts, suggestions, or reporting issues.
      </p>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor={typeId}>Feedback type</Label>
          <Select value={feedbackType} onValueChange={setFeedbackType}>
            <SelectTrigger id={typeId} className="w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General Feedback</SelectItem>
              <SelectItem value="bug">Bug Report</SelectItem>
              <SelectItem value="feature">Feature Request</SelectItem>
              <SelectItem value="improvement">Improvement Suggestion</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={messageId}>Message</Label>
          <Textarea
            id={messageId}
            placeholder="Tell us what you think..."
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
          {isSubmitting ? "Submitting..." : "Submit feedback"}
        </Button>
      </div>
    </form>
  )
}
