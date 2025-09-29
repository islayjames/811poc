"use client"

import React from "react"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, AlertTriangle, Clock, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface FormProgressIndicatorProps {
  completionPercentage: number
  requiredFieldsCompleted: number
  totalRequiredFields: number
  validationErrors: number
  className?: string
}

export function FormProgressIndicator({
  completionPercentage,
  requiredFieldsCompleted,
  totalRequiredFields,
  validationErrors,
  className
}: FormProgressIndicatorProps) {
  const getProgressColor = () => {
    if (validationErrors > 0) return "bg-destructive"
    if (completionPercentage === 100) return "bg-green-500"
    if (completionPercentage >= 75) return "bg-blue-500"
    if (completionPercentage >= 50) return "bg-yellow-500"
    return "bg-gray-400"
  }

  const getStatusIcon = () => {
    if (completionPercentage === 100 && validationErrors === 0) {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    }
    if (validationErrors > 0) {
      return <AlertTriangle className="h-4 w-4 text-destructive" />
    }
    if (completionPercentage >= 50) {
      return <Clock className="h-4 w-4 text-blue-500" />
    }
    return <HelpCircle className="h-4 w-4 text-muted-foreground" />
  }

  const getStatusText = () => {
    if (completionPercentage === 100 && validationErrors === 0) {
      return "Ready to submit"
    }
    if (validationErrors > 0) {
      return `${validationErrors} validation error${validationErrors > 1 ? 's' : ''}`
    }
    if (completionPercentage >= 75) {
      return "Almost complete"
    }
    if (completionPercentage >= 50) {
      return "Making progress"
    }
    return "Just getting started"
  }

  return (
    <Card className={cn("sticky top-4 z-10", className)}>
      <CardContent className="pt-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="text-sm font-medium">Form Completion</span>
            </div>
            <span className="text-sm text-muted-foreground font-mono">
              {completionPercentage}%
            </span>
          </div>

          <Progress
            value={completionPercentage}
            className="h-2"
            indicatorClassName={getProgressColor()}
          />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{getStatusText()}</span>
            <span>
              {requiredFieldsCompleted}/{totalRequiredFields} required fields
            </span>
          </div>

          {validationErrors > 0 && (
            <div className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Review highlighted fields below
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}