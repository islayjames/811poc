"use client"

import React from "react"
import { ErrorBoundary } from "./ErrorBoundary"
import { TicketService } from "@/lib/services/ticketService"
import type { TicketFormData } from "@/lib/types/form"

interface FormErrorBoundaryProps {
  children: React.ReactNode
  formId?: string
  onFormRestore?: (data: Partial<TicketFormData>) => void
  fallbackMessage?: string
}

/**
 * Specialized error boundary for form components
 * Integrates with the auto-save system to provide form state recovery
 */
export function FormErrorBoundary({
  children,
  formId,
  onFormRestore,
  fallbackMessage = "The form encountered an error. Your data has been preserved."
}: FormErrorBoundaryProps) {
  const handleFormRestore = () => {
    if (onFormRestore) {
      // Try to restore from auto-save first
      const autoSavedData = TicketService.getAutoSavedDraft()
      if (autoSavedData) {
        onFormRestore(autoSavedData)
        return
      }

      // Fallback to manual saved draft
      const draftData = TicketService.getSavedDraft()
      if (draftData) {
        onFormRestore(draftData)
      }
    }
  }

  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Enhanced logging for form errors
    console.group('🔧 Form Error Boundary')
    console.error('Form ID:', formId || 'unknown')
    console.error('Error:', error)
    console.error('Error Info:', errorInfo)

    // Check if form data is available
    const hasAutoSave = !!TicketService.getAutoSavedDraft()
    const hasDraft = !!TicketService.getSavedDraft()

    console.log('Recovery Options:', {
      hasAutoSave,
      hasDraft,
      canRestore: hasAutoSave || hasDraft
    })
    console.groupEnd()
  }

  const formFallback = (
    <div className="p-6 text-center space-y-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="text-red-800 font-medium">
        {fallbackMessage}
      </div>
      <div className="space-x-2">
        <button
          onClick={handleFormRestore}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Restore Form Data
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Reload Page
        </button>
      </div>
      <p className="text-sm text-red-600">
        If the problem persists, please contact support.
      </p>
    </div>
  )

  return (
    <ErrorBoundary
      fallback={formFallback}
      onError={handleError}
      showDetails={process.env.NODE_ENV === 'development'}
      isolateError={true}
    >
      {children}
    </ErrorBoundary>
  )
}

export default FormErrorBoundary