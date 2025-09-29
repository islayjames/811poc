"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronRight, CheckCircle, AlertCircle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface CollapsibleSectionProps {
  title: string
  description?: string
  children: React.ReactNode
  isOptional?: boolean
  completionStatus?: "complete" | "partial" | "empty" | "error"
  fieldCount?: number
  completedFields?: number
  errorCount?: number
  defaultOpen?: boolean
  className?: string
}

export function CollapsibleSection({
  title,
  description,
  children,
  isOptional = false,
  completionStatus = "empty",
  fieldCount,
  completedFields,
  errorCount = 0,
  defaultOpen = false,
  className
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const getStatusIcon = () => {
    switch (completionStatus) {
      case "complete":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />
      case "partial":
        return <Clock className="h-4 w-4 text-blue-500" />
      default:
        return null
    }
  }

  const getStatusBadge = () => {
    if (errorCount > 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          {errorCount} error{errorCount > 1 ? 's' : ''}
        </Badge>
      )
    }

    if (fieldCount && completedFields !== undefined) {
      if (completedFields === 0) {
        return isOptional ? (
          <Badge variant="secondary" className="text-xs">
            Optional
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            Not started
          </Badge>
        )
      }

      if (completedFields === fieldCount) {
        return (
          <Badge variant="default" className="text-xs bg-green-100 text-green-800">
            Complete ({completedFields}/{fieldCount})
          </Badge>
        )
      }

      return (
        <Badge variant="secondary" className="text-xs">
          {completedFields}/{fieldCount} fields
        </Badge>
      )
    }

    if (isOptional) {
      return (
        <Badge variant="secondary" className="text-xs">
          Optional
        </Badge>
      )
    }

    return null
  }

  const shouldShowError = errorCount > 0 && !isOpen

  return (
    <Card className={cn("transition-all duration-200", shouldShowError && "border-destructive", className)}>
      <CardHeader className="pb-2">
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start h-auto p-0 hover:bg-transparent"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
                )}
                {getStatusIcon()}
              </div>

              <div className="text-left">
                <h3 className="text-base font-semibold leading-tight">
                  {title}
                </h3>
                {description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {getStatusBadge()}
            </div>
          </div>
        </Button>

        {/* Error preview when collapsed */}
        {shouldShowError && (
          <div className="mt-2 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-3 w-3" />
            Click to expand and fix {errorCount} validation error{errorCount > 1 ? 's' : ''}
          </div>
        )}
      </CardHeader>

      {isOpen && (
        <CardContent className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  )
}

// Helper hook to calculate section completion stats
export function useSectionStats(fieldNames: string[], formValidationState: Record<string, any>) {
  const stats = React.useMemo(() => {
    let completedFields = 0
    let errorCount = 0
    let touchedFields = 0

    fieldNames.forEach(fieldName => {
      const fieldState = formValidationState[fieldName]
      if (fieldState) {
        if (fieldState.isTouched) touchedFields++
        if (fieldState.isValid) completedFields++
        if (fieldState.hasError) errorCount++
      }
    })

    let completionStatus: "complete" | "partial" | "empty" | "error"

    if (errorCount > 0) {
      completionStatus = "error"
    } else if (completedFields === fieldNames.length && fieldNames.length > 0) {
      completionStatus = "complete"
    } else if (touchedFields > 0) {
      completionStatus = "partial"
    } else {
      completionStatus = "empty"
    }

    return {
      completionStatus,
      fieldCount: fieldNames.length,
      completedFields,
      errorCount,
      touchedFields
    }
  }, [fieldNames, formValidationState])

  return stats
}