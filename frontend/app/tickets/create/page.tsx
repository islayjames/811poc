"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { TicketFormComponent } from "@/components/forms/TicketFormComponent"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertTriangle } from "lucide-react"
import type { TicketFormData, ValidationError } from "@/lib/types/form"
import { TicketService, TicketAPIError } from "@/lib/services/ticketService"

export default function CreateTicketPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showAbandonDialog, setShowAbandonDialog] = useState(false)
  const [draftData, setDraftData] = useState<Partial<TicketFormData> | null>(null)

  // Load draft data from localStorage on mount
  useEffect(() => {
    const savedDraft = TicketService.getSavedDraft()
    if (savedDraft) {
      setDraftData(savedDraft)
    }
  }, [])

  // Auto-save functionality
  const handleAutoSave = async (data: Partial<TicketFormData>) => {
    setAutoSaveStatus('saving')
    try {
      await TicketService.saveDraft(data)
      setAutoSaveStatus('saved')
      setTimeout(() => setAutoSaveStatus('idle'), 2000)
    } catch (error) {
      console.error('Auto-save failed:', error)
      setAutoSaveStatus('error')
      setTimeout(() => setAutoSaveStatus('idle'), 3000)
    }
  }

  const handleSave = async (data: TicketFormData, options?: { isDraft?: boolean }) => {
    if (options?.isDraft) {
      // Save as draft
      await handleAutoSave(data)
      setHasUnsavedChanges(false)
      return
    }

    setIsSubmitting(true)
    setValidationErrors([])

    try {
      const response = await TicketService.handleFormSubmit(data, {
        isDraft: false
      })

      // Clear draft data on successful creation
      TicketService.clearSavedDraft()
      setHasUnsavedChanges(false)

      // Redirect to the newly created ticket
      router.push(`/tickets/${response.ticket_id}`)
    } catch (error) {
      console.error('Failed to create ticket:', error)

      if (error instanceof TicketAPIError) {
        if (error.validationGaps && error.validationGaps.length > 0) {
          setValidationErrors(error.validationGaps)
        } else {
          setValidationErrors([{ message: error.message }])
        }
      } else {
        setValidationErrors([
          { message: 'Failed to create ticket. Please try again.' }
        ])
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setShowAbandonDialog(true)
    } else {
      router.push('/tickets')
    }
  }

  const handleAbandonChanges = () => {
    TicketService.clearSavedDraft()
    setHasUnsavedChanges(false)
    setShowAbandonDialog(false)
    router.push('/tickets')
  }

  const handleContinueEditing = () => {
    setShowAbandonDialog(false)
  }

  // Form change tracking
  const handleFormChange = () => {
    setHasUnsavedChanges(true)
  }

  // Prevent accidental navigation away
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/tickets">Tickets</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Create New Ticket</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Draft Recovery Notice */}
      {draftData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <p className="text-sm text-blue-800">
              A draft of this ticket was found. Would you like to continue from where you left off?
            </p>
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDraftData(null)
                TicketService.clearSavedDraft()
              }}
            >
              Start Fresh
            </Button>
            <Button
              size="sm"
              onClick={() => {
                // The form component will use draftData as initialData
                // No additional action needed here
              }}
            >
              Continue Draft
            </Button>
          </div>
        </div>
      )}

      {/* Main Form */}
      <TicketFormComponent
        mode="create"
        initialData={draftData || undefined}
        onSave={handleSave}
        onCancel={handleCancel}
        validationErrors={validationErrors}
        isSubmitting={isSubmitting}
        autoSaveStatus={autoSaveStatus}
      />

      {/* Form Abandonment Warning Dialog */}
      <Dialog open={showAbandonDialog} onOpenChange={setShowAbandonDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes to this ticket. Are you sure you want to leave? Your changes will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleContinueEditing}>
              Continue Editing
            </Button>
            <Button variant="destructive" onClick={handleAbandonChanges}>
              Discard Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}