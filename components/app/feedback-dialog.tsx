"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const [feedbackType, setFeedbackType] = React.useState<string>("general")
  const [message, setMessage] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!message.trim()) {
      toast.error("Please enter your feedback message")
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase.from("feedback").insert({
        user_id: user?.id || null,
        feedback_type: feedbackType,
        message: message.trim(),
      })

      if (error) throw error

      toast.success("Thank you for your feedback! We'll review it soon.")

      // Reset form
      setMessage("")
      setFeedbackType("general")
      onOpenChange(false)
    } catch (error) {
      console.error("Error submitting feedback:", error)
      toast.error("Failed to submit feedback. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
            <DialogDescription>
              Help us improve by sharing your thoughts, suggestions, or reporting issues.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="feedback-type">Feedback Type</Label>
              <Select value={feedbackType} onValueChange={setFeedbackType}>
                <SelectTrigger id="feedback-type">
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
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Tell us what you think..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[120px] resize-none"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Feedback"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
