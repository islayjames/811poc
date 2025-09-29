"use client"

import React from "react"
import { useFormContext } from "react-hook-form"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { AlertCircle, HelpCircle, Check } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface FormFieldWrapperProps {
  name: string
  label: string
  required?: boolean
  helpText?: string
  className?: string
  children: React.ReactNode
}

export function FormFieldWrapper({
  name,
  label,
  required = false,
  helpText,
  className,
  children
}: FormFieldWrapperProps) {
  const {
    formState: { errors, touchedFields }
  } = useFormContext()

  const error = errors[name]
  const isTouched = touchedFields[name]
  const hasError = !!error
  const isValid = isTouched && !hasError

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

        {helpText && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-sm">{helpText}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Validation Status Icons */}
        {hasError && (
          <AlertCircle className="h-3 w-3 text-destructive" aria-label="error" />
        )}
        {isValid && (
          <Check className="h-3 w-3 text-green-600" aria-label="valid" />
        )}
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
    </div>
  )
}