"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Save, Send, Loader2, RefreshCw, AlertCircle, Download } from "lucide-react"
import { ExcavatorInfoSection } from "./sections/ExcavatorInfoSection"
import { WorkDetailsSection } from "./sections/WorkDetailsSection"
import { LocationInfoSection } from "./sections/LocationInfoSection"
import { AdditionalDetailsSection } from "./sections/AdditionalDetailsSection"
import { AutoSaveStatus } from "@/components/ui/auto-save-status"
import { SubmissionConfirmationDialog } from "@/components/dialogs/SubmissionConfirmationDialog"
import { FormProgressIndicator } from "./FormProgressIndicator"
import { ticketFormSchema } from "@/lib/schemas/ticketFormSchema"
import { useAutoSave } from "@/hooks/use-auto-save"
import { useFormValidation } from "@/hooks/use-form-validation"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { OfflineAlert } from "@/components/ui/offline-indicator"
import { TicketService } from "@/lib/services/ticketService"
import type { TicketFormData, TicketFormProps, ValidationError } from "@/lib/types/form"

interface ExtendedFormProps extends TicketFormProps {
  fieldErrors?: Record<string, ValidationError[]>
  onConflictResolution?: (resolutions: Record<string, 'client' | 'server'>) => void
  optimisticUpdate?: boolean
  autoSaveEnabled?: boolean
  onAutoSaveError?: (error: Error) => void
  onFormChange?: (data: TicketFormData) => void
  onSubmitToTexas811?: (submissionReference: string, notes?: string) => Promise<void>
  currentStatus?: string
  enableSubmission?: boolean
}

export function TicketFormComponent({
  mode,
  ticketId,
  initialData,
  onSave,
  onCancel,
  validationErrors = [],
  isSubmitting = false,
  autoSaveStatus = "idle",
  fieldErrors = {},
  onConflictResolution,
  optimisticUpdate = true,
  autoSaveEnabled = true,
  onAutoSaveError,
  onFormChange,
  onSubmitToTexas811,
  currentStatus = "",
  enableSubmission = false
}: ExtendedFormProps) {
  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: initialData || {
      excavator: {
        company: "",
        contact_name: "",
        phone: "",
        email: ""
      },
      work: {
        work_for: "",
        type_of_work: "",
        is_trenchless: false,
        is_blasting: false,
        depth_inches: null,
        duration_days: null
      },
      site: {
        county: "",
        city: "",
        address: "",
        cross_street: "",
        subdivision: "",
        lot_block: "",
        gps: { lat: null, lng: null },
        driving_directions: "",
        marking_instructions: "",
        remarks: "",
        work_area_description: "",
        site_marked_white: false
      },
      additional: {}
    },
    mode: "onChange"
  })

  const { handleSubmit, formState: { isDirty, isValid, errors }, watch, setError, clearErrors, getValues } = form
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set())
  const [showLocalBackupAlert, setShowLocalBackupAlert] = useState(false)
  const [showSubmissionDialog, setShowSubmissionDialog] = useState(false)
  const [isSubmittingToTexas811, setIsSubmittingToTexas811] = useState(false)

  // Form validation and progress tracking
  const formValidation = useFormValidation()

  // Online status monitoring
  const { isOnline, checkConnectivity } = useOnlineStatus()

  // Watch form data for auto-save
  const formData = watch()

  // Auto-save functionality
  const handleAutoSave = useCallback(async (data: TicketFormData) => {
    await TicketService.autoSave(data, ticketId, { silent: true })
  }, [ticketId])

  const handleAutoSaveError = useCallback((error: Error) => {
    console.error('Auto-save error:', error)
    onAutoSaveError?.(error)
  }, [onAutoSaveError])

  const autoSave = useAutoSave(formData, {
    interval: 30000, // 30 seconds
    debounceDelay: 1000, // 1 second
    onAutoSave: handleAutoSave,
    onError: handleAutoSaveError,
    enabled: autoSaveEnabled && mode === 'edit',
    ticketId
  })

  // Check for local backup on mount
  useEffect(() => {
    if (mode === 'create') {
      const backup = autoSave.restoreFromLocalStorage()
      if (backup && Object.keys(backup).length > 0) {
        setShowLocalBackupAlert(true)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // Notify parent of form changes
  useEffect(() => {
    if (onFormChange && formData) {
      onFormChange(formData)
    }
  }, [formData, onFormChange])

  // Retry queued requests when connection is restored
  useEffect(() => {
    if (isOnline) {
      TicketService.retryQueuedRequests().catch(error => {
        console.warn('Failed to retry queued requests:', error)
      })
    }
  }, [isOnline])

  // Set form errors from validation gaps
  useEffect(() => {
    Object.entries(fieldErrors).forEach(([field, fieldValidationErrors]) => {
      if (fieldValidationErrors.length > 0) {
        const message = fieldValidationErrors.map(e => e.message).join('; ')
        setError(field as any, { type: 'validation', message })
        setHighlightedFields(prev => new Set([...prev, field]))
      }
    })
  }, [fieldErrors, setError])

  // Clear highlighted fields when errors are resolved
  useEffect(() => {
    const currentErrorFields = new Set(Object.keys(errors))
    setHighlightedFields(currentErrorFields)
  }, [errors])

  const onSubmit = async (data: TicketFormData) => {
    try {
      clearErrors()
      setHighlightedFields(new Set())
      await onSave(data)
    } catch (error) {
      console.error("Form submission error:", error)
    }
  }

  const handleSaveDraft = () => {
    const currentData = form.getValues()
    onSave(currentData, { isDraft: true })
  }

  const handleManualAutoSave = async () => {
    await autoSave.triggerAutoSave()
  }

  const handleRestoreBackup = () => {
    const backup = autoSave.restoreFromLocalStorage()
    if (backup) {
      form.reset(backup)
      setShowLocalBackupAlert(false)
    }
  }

  const handleDismissBackup = () => {
    autoSave.clearLocalStorage()
    setShowLocalBackupAlert(false)
  }

  const handleSubmitRequest = async () => {
    // First save the current form data
    const currentData = form.getValues()
    try {
      // Save any pending changes first
      await onSave(currentData)
      // Then show the submission dialog
      setShowSubmissionDialog(true)
    } catch (error) {
      console.error("Failed to save before submission:", error)
      // Still allow submission attempt if save fails
      setShowSubmissionDialog(true)
    }
  }

  const handleConfirmSubmission = async (submissionReference: string, notes?: string) => {
    if (!onSubmitToTexas811 || !ticketId) {
      console.error("Submission handler or ticket ID not available")
      return
    }

    setIsSubmittingToTexas811(true)
    try {
      await onSubmitToTexas811(submissionReference, notes)
      setShowSubmissionDialog(false)
    } catch (error) {
      console.error("Submission failed:", error)
      // Don't close dialog on error so user can retry
      throw error
    } finally {
      setIsSubmittingToTexas811(false)
    }
  }

  const canSubmit = () => {
    if (!enableSubmission || !ticketId || !currentStatus) {
      return false
    }
    return TicketService.canSubmitTicket(currentStatus) && isValid
  }

  const getAutoSaveStatusText = () => {
    switch (autoSaveStatus) {
      case "saving":
        return "Saving..."
      case "saved":
        return "Draft saved"
      case "error":
        return "Save failed"
      default:
        return ""
    }
  }

  return (
    <FormProvider {...form}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Progress Sidebar */}
          <div className="lg:col-span-1">
            <FormProgressIndicator
              completionPercentage={formValidation.stats.completionPercentage}
              requiredFieldsCompleted={formValidation.stats.requiredFieldsCompleted}
              totalRequiredFields={formValidation.stats.totalRequiredFields}
              validationErrors={formValidation.stats.validationErrors}
              className="lg:sticky lg:top-4"
            />
          </div>

          {/* Main Form Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {mode === "create" ? "Create New Ticket" : "Edit Ticket"}
            </h1>
            <p className="text-muted-foreground">
              {mode === "create"
                ? "Create a new utility locate ticket for submission to Texas 811"
                : `Editing ticket ${ticketId}`}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Auto-save status */}
            {autoSaveEnabled && mode === 'edit' && (
              <AutoSaveStatus
                status={autoSave.status}
                lastSaved={autoSave.lastSaved}
                size="sm"
              />
            )}

            {/* Legacy auto-save status (fallback) */}
            {!autoSaveEnabled && autoSaveStatus !== "idle" && (
              <div className="text-sm text-muted-foreground flex items-center">
                {autoSaveStatus === "saving" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {getAutoSaveStatusText()}
              </div>
            )}

            {/* Manual auto-save button for edit mode */}
            {autoSaveEnabled && mode === 'edit' && autoSave.hasUnsavedChanges && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleManualAutoSave}
                disabled={autoSave.isSaving || isSubmitting}
                className="text-xs"
              >
                {autoSave.isSaving ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Save Now
              </Button>
            )}
          </div>
        </div>

        {/* Offline Status Alert */}
        <OfflineAlert
          offlineMessage="You're currently offline. Your work is being saved locally and will sync when connection is restored."
          onlineMessage="Connection restored! Your changes are being synchronized."
        />

        {/* Local Backup Alert */}
        {showLocalBackupAlert && (
          <Alert>
            <Download className="h-4 w-4" />
            <AlertTitle>Local Backup Found</AlertTitle>
            <AlertDescription>
              <div className="space-y-3">
                <p>
                  We found a local backup of your work from a previous session.
                  Would you like to restore it?
                </p>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleRestoreBackup}
                    variant="default"
                  >
                    Restore Backup
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleDismissBackup}
                    variant="outline"
                  >
                    Start Fresh
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Validation Issues</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span>{error.message}</span>
                    {error.field && (
                      <Badge variant="outline" className="text-xs">
                        {error.field}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Field-Specific Validation Gaps */}
        {Object.keys(fieldErrors).length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Field Validation Issues</AlertTitle>
            <AlertDescription>
              <div className="space-y-2">
                {Object.entries(fieldErrors).map(([field, errors]) => (
                  <div key={field} className="flex items-start space-x-2">
                    <Badge variant="destructive" className="text-xs">
                      {field}
                    </Badge>
                    <div className="flex-1">
                      {errors.map((error, index) => (
                        <div key={index} className="text-sm">
                          {error.message}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Excavator Information */}
          <Card>
            <CardHeader>
              <CardTitle>Excavator Information</CardTitle>
            </CardHeader>
            <CardContent>
              <ExcavatorInfoSection />
            </CardContent>
          </Card>

          {/* Work Details */}
          <Card>
            <CardHeader>
              <CardTitle>Work Details</CardTitle>
            </CardHeader>
            <CardContent>
              <WorkDetailsSection />
            </CardContent>
          </Card>

          {/* Location Information */}
          <Card>
            <CardHeader>
              <CardTitle>Location Information</CardTitle>
            </CardHeader>
            <CardContent>
              <LocationInfoSection />
            </CardContent>
          </Card>

          {/* Additional Details */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Details</CardTitle>
            </CardHeader>
            <CardContent>
              <AdditionalDetailsSection />
            </CardContent>
          </Card>

          {/* Form Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Auto-save info for edit mode */}
                {autoSaveEnabled && mode === 'edit' && (
                  <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <AutoSaveStatus
                          status={autoSave.status}
                          lastSaved={autoSave.lastSaved}
                          size="sm"
                          showText={false}
                        />
                        <span>
                          Auto-save every 30 seconds
                          {autoSave.hasUnsavedChanges && ' (changes pending)'}
                        </span>
                      </div>
                      {autoSave.lastSaved && (
                        <span className="text-xs">
                          Last saved: {autoSave.lastSaved.toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onCancel}
                      disabled={isSubmitting || isSubmittingToTexas811}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSaveDraft}
                      disabled={isSubmitting || isSubmittingToTexas811 || !isDirty}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Draft
                    </Button>
                    {/* Manual auto-save button */}
                    {autoSaveEnabled && mode === 'edit' && autoSave.hasUnsavedChanges && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleManualAutoSave}
                        disabled={autoSave.isSaving || isSubmitting || isSubmittingToTexas811}
                        size="sm"
                      >
                        {autoSave.isSaving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Now
                      </Button>
                    )}
                    {/* Save & Mark Submitted button */}
                    {enableSubmission && mode === 'edit' && (
                      <Button
                        type="button"
                        variant="default"
                        onClick={handleSubmitRequest}
                        disabled={!canSubmit() || isSubmitting || isSubmittingToTexas811}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Save & Mark Submitted
                      </Button>
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmitting || isSubmittingToTexas811 || !isValid}
                    className="min-w-[120px]"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    {mode === "create" ? "Create Ticket" : "Update Ticket"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>

        {/* Submission Confirmation Dialog */}
        {enableSubmission && ticketId && (
          <SubmissionConfirmationDialog
            open={showSubmissionDialog}
            onOpenChange={setShowSubmissionDialog}
            onConfirm={handleConfirmSubmission}
            ticketId={ticketId}
            isSubmitting={isSubmittingToTexas811}
          />
        )}
          </div>
        </div>
      </div>
    </FormProvider>
  )
}