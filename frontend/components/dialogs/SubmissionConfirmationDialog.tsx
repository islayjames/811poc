"use client"

import React, { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Send, AlertTriangle } from "lucide-react"

interface SubmissionConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (submissionReference: string, notes?: string) => Promise<void>
  ticketId: string
  isSubmitting?: boolean
}

export function SubmissionConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  ticketId,
  isSubmitting = false
}: SubmissionConfirmationDialogProps) {
  const [submissionReference, setSubmissionReference] = useState("")
  const [notes, setNotes] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleConfirm = async () => {
    // Validate submission reference
    const trimmedReference = submissionReference.trim()
    if (!trimmedReference) {
      setValidationError("Submission reference is required")
      return
    }

    if (trimmedReference.length < 3) {
      setValidationError("Submission reference must be at least 3 characters")
      return
    }

    try {
      setValidationError(null)
      await onConfirm(trimmedReference, notes.trim() || undefined)
      // Reset form on successful submission
      setSubmissionReference("")
      setNotes("")
    } catch (error) {
      console.error("Submission failed:", error)
      setValidationError(error instanceof Error ? error.message : "Submission failed")
    }
  }

  const handleCancel = () => {
    if (!isSubmitting) {
      setValidationError(null)
      onOpenChange(false)
    }
  }

  const handleReferenceChange = (value: string) => {
    setSubmissionReference(value)
    if (validationError) {
      setValidationError(null)
    }
  }

  // Handle dialog open change - prevent closing while submitting
  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Submit Ticket to Texas811</DialogTitle>
          <DialogDescription>
            You are about to submit ticket {ticketId} to Texas811. Please provide the submission reference
            and any additional notes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning Alert */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Once submitted, the ticket status will change to "Submitted"
              and will begin the official Texas811 processing timeline.
            </AlertDescription>
          </Alert>

          {/* Submission Reference Field */}
          <div className="space-y-2">
            <Label htmlFor="submission-reference">
              Submission Reference <span className="text-red-500">*</span>
            </Label>
            <Input
              id="submission-reference"
              placeholder="Enter Texas811 submission reference (e.g., TX24050123456)"
              value={submissionReference}
              onChange={(e) => handleReferenceChange(e.target.value)}
              disabled={isSubmitting}
              className={validationError ? "border-red-500" : ""}
            />
            <p className="text-sm text-muted-foreground">
              This should be the reference number provided by Texas811 upon submission.
            </p>
          </div>

          {/* Optional Notes Field */}
          <div className="space-y-2">
            <Label htmlFor="submission-notes">Additional Notes (Optional)</Label>
            <Textarea
              id="submission-notes"
              placeholder="Enter any additional notes about the submission..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          {/* Validation Error */}
          {validationError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting || !submissionReference.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit to Texas811
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}