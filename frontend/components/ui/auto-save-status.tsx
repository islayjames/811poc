"use client"

import React from "react"
import { Loader2, Check, X, AlertTriangle, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { AutoSaveStatus } from "@/hooks/use-auto-save"

interface AutoSaveStatusProps {
  status: AutoSaveStatus
  lastSaved?: Date | null
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const statusConfig = {
  idle: {
    icon: null,
    text: '',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted'
  },
  saving: {
    icon: Loader2,
    text: 'Saving...',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  saved: {
    icon: Check,
    text: 'Saved',
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  error: {
    icon: X,
    text: 'Save failed',
    color: 'text-red-600',
    bgColor: 'bg-red-50'
  },
  conflict: {
    icon: AlertTriangle,
    text: 'Conflict detected',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50'
  }
} as const

/**
 * AutoSaveStatus component displays the current auto-save state
 * with appropriate icons, colors, and optional text
 */
export function AutoSaveStatus({
  status,
  lastSaved,
  className,
  showText = true,
  size = 'md'
}: AutoSaveStatusProps) {
  const config = statusConfig[status]
  const IconComponent = config.icon

  // Don't render anything for idle status
  if (status === 'idle') {
    return null
  }

  const sizeClasses = {
    sm: 'h-3 w-3 text-xs',
    md: 'h-4 w-4 text-sm',
    lg: 'h-5 w-5 text-base'
  }

  const getDisplayText = () => {
    if (!showText) return null

    if (status === 'saved' && lastSaved) {
      return `Saved at ${lastSaved.toLocaleTimeString()}`
    }
    return config.text
  }

  const content = (
    <div className={cn(
      "flex items-center space-x-1",
      config.color,
      className
    )}>
      {IconComponent && (
        <IconComponent
          className={cn(
            sizeClasses[size],
            status === 'saving' && 'animate-spin'
          )}
        />
      )}
      {showText && (
        <span className={cn(
          "font-medium",
          sizeClasses[size]
        )}>
          {getDisplayText()}
        </span>
      )}
    </div>
  )

  // Wrap in tooltip for additional information
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex">
            {content}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            {status === 'saved' && lastSaved && (
              <div>Last saved: {lastSaved.toLocaleString()}</div>
            )}
            {status === 'saving' && (
              <div>Auto-saving changes...</div>
            )}
            {status === 'error' && (
              <div>Auto-save failed. Changes saved locally.</div>
            )}
            {status === 'conflict' && (
              <div>Changes conflict with server version</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * AutoSaveStatusBadge component displays auto-save status as a badge
 */
export function AutoSaveStatusBadge({
  status,
  lastSaved,
  className
}: Pick<AutoSaveStatusProps, 'status' | 'lastSaved' | 'className'>) {
  const config = statusConfig[status]

  if (status === 'idle') {
    return null
  }

  const getVariant = () => {
    switch (status) {
      case 'saving':
        return 'secondary'
      case 'saved':
        return 'default'
      case 'error':
        return 'destructive'
      case 'conflict':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  return (
    <Badge
      variant={getVariant()}
      className={cn(
        "flex items-center space-x-1",
        config.color,
        className
      )}
    >
      {config.icon && (
        <config.icon
          className={cn(
            "h-3 w-3",
            status === 'saving' && 'animate-spin'
          )}
        />
      )}
      <span>
        {status === 'saved' && lastSaved
          ? `Saved ${lastSaved.toLocaleTimeString()}`
          : config.text
        }
      </span>
    </Badge>
  )
}

/**
 * AutoSaveIndicator component provides a minimal status indicator
 */
export function AutoSaveIndicator({
  status,
  className
}: Pick<AutoSaveStatusProps, 'status' | 'className'>) {
  const config = statusConfig[status]

  if (status === 'idle') {
    return (
      <div className={cn(
        "h-2 w-2 rounded-full bg-gray-300",
        className
      )} />
    )
  }

  return (
    <div className={cn(
      "h-2 w-2 rounded-full",
      {
        'bg-blue-500 animate-pulse': status === 'saving',
        'bg-green-500': status === 'saved',
        'bg-red-500': status === 'error',
        'bg-orange-500': status === 'conflict'
      },
      className
    )} />
  )
}