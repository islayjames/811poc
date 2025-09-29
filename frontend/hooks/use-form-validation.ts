"use client"

import { useCallback, useEffect, useState } from "react"
import { useFormContext } from "react-hook-form"
import { getValidationCompletion } from "@/lib/schemas/ticketFormSchema"
import type { TicketFormData } from "@/lib/types/form"

interface ValidationStats {
  completionPercentage: number
  requiredFieldsCompleted: number
  totalRequiredFields: number
  validationErrors: number
  touchedFieldsCount: number
  isFormValid: boolean
}

interface FormValidationState {
  stats: ValidationStats
  fieldValidationState: Record<string, {
    isValid: boolean
    isTouched: boolean
    hasError: boolean
    errorMessage?: string
  }>
  refreshValidation: () => void
}

const REQUIRED_FIELDS = [
  'excavator.company',
  'excavator.contact_name',
  'excavator.phone',
  'work.type_of_work',
  'site.county',
  'site.city',
  'site.work_area_description'
]

const OPTIONAL_SECTIONS = [
  'additional.notes',
  'additional.reference_number',
  'additional.contact_method',
  'excavator.email',
  'work.work_for',
  'work.depth_inches',
  'work.duration_days',
  'site.subdivision',
  'site.lot_block',
  'site.driving_directions',
  'site.marking_instructions',
  'site.remarks'
]

export function useFormValidation(): FormValidationState {
  const formContext = useFormContext<TicketFormData>()

  // Handle case where hook is used outside FormProvider
  if (!formContext) {
    return {
      stats: {
        completionPercentage: 0,
        requiredFieldsCompleted: 0,
        totalRequiredFields: REQUIRED_FIELDS.length,
        validationErrors: 0,
        touchedFieldsCount: 0,
        isFormValid: false
      },
      fieldValidationState: {},
      refreshValidation: () => {}
    }
  }

  const {
    formState: { errors, touchedFields, isValid },
    watch
  } = formContext

  const formData = watch()
  const [refreshCounter, setRefreshCounter] = useState(0)

  const calculateStats = useCallback((): ValidationStats => {
    const completionPercentage = getValidationCompletion(formData)

    const requiredFieldsCompleted = REQUIRED_FIELDS.filter(fieldPath => {
      const value = getNestedValue(formData, fieldPath)
      return value && String(value).trim().length > 0
    }).length

    const errorCount = Object.keys(errors).length
    const touchedCount = Object.keys(touchedFields).length

    return {
      completionPercentage,
      requiredFieldsCompleted,
      totalRequiredFields: REQUIRED_FIELDS.length,
      validationErrors: errorCount,
      touchedFieldsCount: touchedCount,
      isFormValid: isValid && errorCount === 0
    }
  }, [formData, errors, touchedFields, isValid])

  const buildFieldValidationState = useCallback(() => {
    const fieldState: Record<string, any> = {}

    // Process all form fields (required + optional)
    const allFields = [...REQUIRED_FIELDS, ...OPTIONAL_SECTIONS]

    allFields.forEach(fieldPath => {
      const error = getNestedError(errors, fieldPath)
      const isTouched = getNestedValue(touchedFields, fieldPath) || false
      const hasError = !!error

      fieldState[fieldPath] = {
        isValid: isTouched && !hasError,
        isTouched,
        hasError,
        errorMessage: error?.message
      }
    })

    return fieldState
  }, [errors, touchedFields])

  const [stats, setStats] = useState<ValidationStats>(calculateStats)
  const [fieldValidationState, setFieldValidationState] = useState(() => buildFieldValidationState())

  // Update stats when form data changes
  useEffect(() => {
    setStats(calculateStats())
    setFieldValidationState(buildFieldValidationState())
  }, [calculateStats, buildFieldValidationState, refreshCounter])

  const refreshValidation = useCallback(() => {
    setRefreshCounter(prev => prev + 1)
  }, [])

  return {
    stats,
    fieldValidationState,
    refreshValidation
  }
}

// Helper functions
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

function getNestedError(errors: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], errors)
}

// Additional hook for field-level validation feedback
export function useFieldValidation(fieldName: string) {
  const formContext = useFormContext()

  // Handle case where hook is used outside FormProvider
  if (!formContext) {
    return {
      hasError: false,
      isValid: false,
      isTouched: false,
      errorMessage: undefined,
      validateField: async () => {},
      clearFieldError: () => {}
    }
  }

  const {
    formState: { errors, touchedFields },
    trigger,
    clearErrors
  } = formContext

  const error = getNestedError(errors, fieldName)
  const isTouched = getNestedValue(touchedFields, fieldName)
  const hasError = !!error
  const isValid = isTouched && !hasError

  const validateField = useCallback(async () => {
    await trigger(fieldName as any)
  }, [fieldName, trigger])

  const clearFieldError = useCallback(() => {
    clearErrors(fieldName as any)
  }, [fieldName, clearErrors])

  return {
    hasError,
    isValid,
    isTouched,
    errorMessage: error?.message,
    validateField,
    clearFieldError
  }
}