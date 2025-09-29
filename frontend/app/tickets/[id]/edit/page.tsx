"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { TicketFormComponent } from "@/components/forms/TicketFormComponent"
import { FormErrorBoundary } from "@/components/error-boundaries/FormErrorBoundary"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react"
import { api, ApiError } from "@/lib/api"
import { formatTicketId } from "@/lib/format"
import type { TicketFormData, ValidationError } from "@/lib/types/form"
import type { TicketDetail } from "@/lib/types"
import {
  TicketService,
  TicketAPIError,
  type ConflictData,
  type UpdateResult,
  type OptimisticUpdateOptions
} from "@/lib/services/ticketService"

/**
 * Transform ticket detail data from API to form data format
 */
function transformTicketToFormData(ticket: TicketDetail): TicketFormData {
  return {
    excavator: {
      company: ticket.excavator.company || "",
      contact_name: ticket.excavator.contact_name || "",
      phone: ticket.excavator.phone || "",
      email: ticket.excavator.email || ""
    },
    work: {
      work_for: ticket.work.work_for || "",
      type_of_work: ticket.work.type_of_work || "",
      is_trenchless: ticket.work.is_trenchless,
      is_blasting: ticket.work.is_blasting,
      depth_inches: ticket.work.depth_inches,
      duration_days: ticket.work.duration_days
    },
    site: {
      county: ticket.site.county || "",
      city: ticket.site.city || "",
      address: ticket.site.address || "",
      cross_street: ticket.site.cross_street || "",
      subdivision: ticket.site.subdivision || "",
      lot_block: ticket.site.lot_block || "",
      gps: {
        lat: ticket.site.gps.lat,
        lng: ticket.site.gps.lng
      },
      driving_directions: ticket.site.driving_directions || "",
      marking_instructions: ticket.site.marking_instructions || "",
      remarks: ticket.site.remarks || "",
      work_area_description: ticket.site.work_area_description || "",
      site_marked_white: ticket.site.site_marked_white
    },
    additional: {}
  }
}

export default function EditTicketPage() {
  const router = useRouter()
  const params = useParams()
  const ticketId = params.id as string

  // State management
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [originalTicket, setOriginalTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, ValidationError[]>>({})
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showAbandonDialog, setShowAbandonDialog] = useState(false)
  const [conflicts, setConflicts] = useState<ConflictData[]>([])
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [optimisticTicket, setOptimisticTicket] = useState<TicketDetail | null>(null)

  // Fetch ticket data
  const fetchTicket = useCallback(async () => {
    if (!ticketId) return

    try {
      setLoading(true)
      setError(null)
      const ticketData = await api.getTicket(ticketId)
      setTicket(ticketData)
      setOriginalTicket(ticketData) // Store original for conflict detection
      setOptimisticTicket(null) // Reset optimistic state
    } catch (err) {
      console.error("Error loading ticket:", err)
      setError(err instanceof ApiError ? err.message : "Failed to load ticket")
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  // Load ticket on mount
  useEffect(() => {
    fetchTicket()
  }, [fetchTicket])

  // Auto-save functionality (legacy - now handled by TicketFormComponent)
  const handleAutoSave = async (data: Partial<TicketFormData>) => {
    if (!ticketId) return

    setAutoSaveStatus('saving')
    try {
      await TicketService.saveDraft(data, ticketId)
      setAutoSaveStatus('saved')
      setTimeout(() => setAutoSaveStatus('idle'), 2000)
    } catch (error) {
      console.error('Auto-save failed:', error)
      setAutoSaveStatus('error')
      setTimeout(() => setAutoSaveStatus('idle'), 3000)
    }
  }

  // Handle auto-save errors from the new system
  const handleAutoSaveError = (error: Error) => {
    console.error('New auto-save system error:', error)
    // Could show a toast notification or other user feedback
  }

  // Handle form changes for unsaved changes tracking
  const handleFormChangeTracking = (data: TicketFormData) => {
    setHasUnsavedChanges(true)
  }

  // Handle ticket submission to Texas811
  const handleSubmitToTexas811 = async (submissionReference: string, notes?: string) => {
    if (!ticketId) return

    try {
      setIsSubmitting(true)

      // Call the submission API
      const result = await TicketService.submitTicket(ticketId, submissionReference, notes)

      if (result.success) {
        // Clear unsaved changes flag
        setHasUnsavedChanges(false)

        // Redirect to ticket detail page to show updated status
        router.push(`/tickets/${ticketId}`)
      }
    } catch (error) {
      console.error('Failed to submit ticket:', error)

      if (error instanceof TicketAPIError) {
        setValidationErrors([{ message: error.message }])
      } else {
        setValidationErrors([
          { message: 'Failed to submit ticket. Please try again.' }
        ])
      }

      // Re-throw to allow dialog to handle error display
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle form submission with optimistic updates
  const handleSave = async (data: TicketFormData, options?: { isDraft?: boolean }) => {
    if (!ticketId || !originalTicket) return

    if (options?.isDraft) {
      // Save as draft
      await handleAutoSave(data)
      setHasUnsavedChanges(false)
      return
    }

    setIsSubmitting(true)
    setValidationErrors([])
    setFieldErrors({})

    try {
      // Transform form data to original ticket format for comparison
      const originalFormData = transformTicketToFormData(originalTicket)

      // Optimistic update - show changes immediately
      setOptimisticTicket(prev => ({
        ...originalTicket,
        // Apply form changes to the ticket structure
        excavator: { ...originalTicket.excavator, ...data.excavator },
        work: { ...originalTicket.work, ...data.work },
        site: {
          ...originalTicket.site,
          ...data.site,
          gps: {
            lat: data.site.gps.lat ?? originalTicket.site.gps.lat,
            lng: data.site.gps.lng ?? originalTicket.site.gps.lng
          }
        }
      }))

      // Attempt the update with conflict detection
      const result: UpdateResult = await TicketService.updateTicketAdvanced(
        ticketId,
        data,
        originalFormData,
        {
          enableOptimistic: true,
          rollbackOnError: true,
          conflictResolution: 'prompt'
        }
      )

      if (result.success) {
        // Update succeeded
        setHasUnsavedChanges(false)
        setOptimisticTicket(null)

        // Process validation gaps if any
        if (result.validationGaps && result.validationGaps.length > 0) {
          const gaps = TicketService.highlightValidationGaps(result.validationGaps)
          setFieldErrors(gaps)
          setValidationErrors(result.validationGaps)
        }

        // Redirect to the ticket detail page if no validation issues
        if (!result.validationGaps || result.validationGaps.length === 0) {
          router.push(`/tickets/${ticketId}`)
        }
      } else if (result.conflicts && result.conflicts.length > 0) {
        // Handle conflicts
        setConflicts(result.conflicts)
        setShowConflictDialog(true)
        setOptimisticTicket(null) // Rollback optimistic update
      }

    } catch (error) {
      console.error('Failed to update ticket:', error)
      setOptimisticTicket(null) // Rollback optimistic update

      if (error instanceof TicketAPIError) {
        if (error.validationGaps && error.validationGaps.length > 0) {
          const gaps = TicketService.highlightValidationGaps(error.validationGaps)
          setFieldErrors(gaps)
          setValidationErrors(error.validationGaps)
        } else {
          setValidationErrors([{ message: error.message }])
        }
      } else {
        setValidationErrors([
          { message: 'Failed to update ticket. Please try again.' }
        ])
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle cancel action
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setShowAbandonDialog(true)
    } else {
      router.push(`/tickets/${ticketId}`)
    }
  }

  // Handle abandoning changes
  const handleAbandonChanges = () => {
    setHasUnsavedChanges(false)
    setShowAbandonDialog(false)
    router.push(`/tickets/${ticketId}`)
  }

  const handleContinueEditing = () => {
    setShowAbandonDialog(false)
  }

  // Handle conflict resolution
  const handleConflictResolution = async (resolutions: Record<string, 'client' | 'server'>) => {
    if (!ticketId) return

    try {
      setIsSubmitting(true)
      const result = await TicketService.resolveConflicts(ticketId, conflicts, resolutions)

      if (result.success) {
        setConflicts([])
        setShowConflictDialog(false)
        setHasUnsavedChanges(false)

        // Process any remaining validation gaps
        if (result.validationGaps && result.validationGaps.length > 0) {
          const gaps = TicketService.highlightValidationGaps(result.validationGaps)
          setFieldErrors(gaps)
          setValidationErrors(result.validationGaps)
        } else {
          router.push(`/tickets/${ticketId}`)
        }
      }
    } catch (error) {
      console.error('Failed to resolve conflicts:', error)
      setValidationErrors([{ message: 'Failed to resolve conflicts. Please try again.' }])
    } finally {
      setIsSubmitting(false)
    }
  }

  // Form change tracking (legacy - now handled by handleFormChangeTracking)
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

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        {/* Breadcrumb skeleton */}
        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-16" />
          <span className="text-muted-foreground">/</span>
          <Skeleton className="h-4 w-20" />
          <span className="text-muted-foreground">/</span>
          <Skeleton className="h-4 w-24" />
        </div>

        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/tickets">Tickets</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/tickets/${ticketId}`}>
                {ticketId ? formatTicketId(ticketId) : 'Ticket'}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Edit</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Ticket</AlertTitle>
          <AlertDescription className="mt-2">
            {error}
            <div className="flex items-center space-x-3 mt-3">
              <Button size="sm" onClick={fetchTicket} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
              <Button size="sm" onClick={() => router.push("/tickets")} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to List
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Not found state
  if (!ticket) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/tickets">Tickets</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Edit Ticket</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Ticket Not Found</AlertTitle>
          <AlertDescription className="mt-2">
            The ticket you're trying to edit could not be found.
            <div className="flex items-center space-x-3 mt-3">
              <Button size="sm" onClick={fetchTicket} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
              <Button size="sm" onClick={() => router.push("/tickets")} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to List
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Transform ticket data to form data (use optimistic if available)
  const displayTicket = optimisticTicket || ticket
  const initialFormData = transformTicketToFormData(displayTicket)

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
            <BreadcrumbLink href={`/tickets/${ticketId}`}>
              {formatTicketId(ticketId)}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Edit</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Main Form */}
      <FormErrorBoundary
        formId={`edit-ticket-${ticketId}`}
        fallbackMessage="The ticket form encountered an error. Your progress has been automatically saved."
      >
        <TicketFormComponent
          mode="edit"
          ticketId={ticketId}
          initialData={initialFormData}
          onSave={handleSave}
          onCancel={handleCancel}
          validationErrors={validationErrors}
          isSubmitting={isSubmitting}
          autoSaveStatus={autoSaveStatus}
          fieldErrors={fieldErrors}
          onConflictResolution={handleConflictResolution}
          optimisticUpdate={true}
          autoSaveEnabled={true}
          onAutoSaveError={handleAutoSaveError}
          onFormChange={handleFormChangeTracking}
          onSubmitToTexas811={handleSubmitToTexas811}
          currentStatus={ticket?.status}
          enableSubmission={ticket?.status ? TicketService.canSubmitTicket(ticket.status) : false}
        />
      </FormErrorBoundary>

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

      {/* Conflict Resolution Dialog */}
      <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Resolve Update Conflicts</DialogTitle>
            <DialogDescription>
              Another user has modified this ticket while you were editing. Please choose which version to keep for each conflicting field.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {conflicts.map((conflict, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="font-medium mb-2">{conflict.field}</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-blue-600">Your Version</div>
                    <div className="text-sm bg-blue-50 p-2 rounded">
                      {JSON.stringify(conflict.clientValue)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-orange-600">Server Version</div>
                    <div className="text-sm bg-orange-50 p-2 rounded">
                      {JSON.stringify(conflict.serverValue)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Modified: {new Date(conflict.lastModified).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConflictDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleConflictResolution(
                conflicts.reduce((acc, conflict) => ({ ...acc, [conflict.field]: 'server' }), {})
              )}
              disabled={isSubmitting}
            >
              Keep Server Version
            </Button>
            <Button
              onClick={() => handleConflictResolution(
                conflicts.reduce((acc, conflict) => ({ ...acc, [conflict.field]: 'client' }), {})
              )}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Resolving...' : 'Keep My Version'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}