"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FeedbackSettingsPanel, type FeedbackType } from "@/components/profile/feedback-settings-panel"

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  initialFeedbackType?: FeedbackType
  hideFeedbackType?: boolean
}

export function FeedbackDialog({
  open,
  onOpenChange,
  title = "Send Feedback",
  description = "Share feedback, report bugs, or request features.",
  initialFeedbackType = "general",
  hideFeedbackType = false,
}: FeedbackDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {description}
          </DialogDescription>
        </DialogHeader>
        <FeedbackSettingsPanel
          open={open}
          variant="dialog"
          initialFeedbackType={initialFeedbackType}
          hideFeedbackType={hideFeedbackType}
          onSubmitted={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
