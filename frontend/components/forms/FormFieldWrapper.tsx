"use client"

import React, { useCallback, useEffect, useState } from "react"
import { useFormContext } from "react-hook-form"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { AlertCircle, HelpCircle, Check, Loader2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface FormFieldWrapperProps {
  name: string
  label: string
  required?: boolean
  helpText?: string
  examples?: string[]
  validationDelay?: number
  showValidationStatus?: boolean
  className?: string
  children: React.ReactNode
}

export function FormFieldWrapper({
  name,
  label,
  required = false,
  helpText,
  examples = [],
  validationDelay = 300,
  showValidationStatus = true,
  className,
  children
}: FormFieldWrapperProps) {
  const formContext = useFormContext()

  // Handle case where component is used outside FormProvider
  if (!formContext) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-1">
          <Label
            htmlFor={name}
            className="text-sm font-medium leading-none"
          >
            {label}
            {required && (
              <span className="text-destructive ml-1" aria-label="required">
                *
              </span>
            )}
          </Label>
        </div>
        <div className="relative">
          {children}
        </div>
      </div>
    )
  }

  const {
    formState: { errors, touchedFields },
    watch,
    trigger
  } = formContext

  const [isValidating, setIsValidating] = useState(false)
  const [validationTimer, setValidationTimer] = useState<NodeJS.Timeout | null>(null)

  const watchedValue = watch(name)
  const error = getNestedError(errors, name)
  const isTouched = getNestedValue(touchedFields, name) || false
  const hasError = !!error
  const isValid = isTouched && !hasError && watchedValue

  // Real-time validation with debounce
  const validateField = useCallback(async () => {
    if (validationTimer) {
      clearTimeout(validationTimer)
    }

    const timer = setTimeout(async () => {
      if (watchedValue && String(watchedValue).trim().length > 0) {
        setIsValidating(true)
        try {
          await trigger(name as any)
        } finally {
          setIsValidating(false)
        }
      }
    }, validationDelay)

    setValidationTimer(timer)
  }, [watchedValue, name, trigger, validationDelay, validationTimer])

  // Trigger validation on value change (debounced)
  useEffect(() => {
    if (isTouched && watchedValue !== undefined) {
      validateField()
    }

    return () => {
      if (validationTimer) {
        clearTimeout(validationTimer)
      }
    }
  }, [watchedValue, isTouched, validateField])

  const getValidationIcon = () => {
    if (isValidating) {
      return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" aria-label="validating" />
    }
    if (hasError) {
      return <AlertCircle className="h-3 w-3 text-destructive" aria-label="error" />
    }
    if (isValid) {
      return <Check className="h-3 w-3 text-green-600" aria-label="valid" />
    }
    return null
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-1">
        <Label
          htmlFor={name}
          className={cn(
            "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
            hasError && "text-destructive",
            isValid && "text-green-600"
          )}
        >
          {label}
          {required && (
            <span className="text-destructive ml-1" aria-label="required">
              *
            </span>
          )}
        </Label>

        {(helpText || examples.length > 0) && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm">
                <div className="space-y-2">
                  {helpText && <p className="text-sm">{helpText}</p>}
                  {examples.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1">Examples:</p>
                      <ul className="text-xs space-y-1">
                        {examples.map((example, index) => (
                          <li key={index} className="text-muted-foreground">
                            • {example}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Real-time Validation Status Icons */}
        {showValidationStatus && getValidationIcon()}
      </div>

      <div className="relative">
        {React.cloneElement(children as React.ReactElement, {
          id: name,
          name: name,
          'aria-invalid': hasError ? 'true' : 'false',
          'aria-describedby': error ? `${name}-error` : helpText ? `${name}-help` : undefined,
          className: cn(
            (children as React.ReactElement).props.className,
            hasError && "border-destructive focus:border-destructive focus:ring-destructive",
            isValid && "border-green-500 focus:border-green-500 focus:ring-green-500/20"
          )
        })}
      </div>

      {/* Error Message */}
      {hasError && (
        <p
          id={`${name}-error`}
          className="text-sm text-destructive flex items-center gap-1"
          role="alert"
        >
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {error?.message as string}
        </p>
      )}

      {/* Help Text */}
      {helpText && !hasError && (
        <p
          id={`${name}-help`}
          className="text-sm text-muted-foreground"
        >
          {helpText}
        </p>
      )}

      {/* Examples */}
      {examples.length > 0 && !hasError && (
        <div className="text-xs text-muted-foreground space-y-1">
          <span className="font-medium">Examples:</span>
          <ul className="list-disc list-inside ml-2 space-y-0.5">
            {examples.slice(0, 2).map((example, index) => (
              <li key={index}>{example}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Helper functions for nested form paths
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

function getNestedError(errors: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], errors)
}