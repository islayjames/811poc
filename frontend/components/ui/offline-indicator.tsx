"use client"

import React from 'react'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { WifiOff, Wifi, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from "@/lib/utils"
import { useOnlineStatus } from "@/hooks/use-online-status"

interface OfflineIndicatorProps {
  /** Show full alert when offline (default: true) */
  showAlert?: boolean

  /** Show compact badge indicator (default: false) */
  showBadge?: boolean

  /** Custom className */
  className?: string

  /** Show retry button in alert (default: true) */
  showRetryButton?: boolean

  /** Custom message when offline */
  offlineMessage?: string

  /** Custom message when back online */
  onlineMessage?: string

  /** Auto-hide online message after ms (default: 3000, 0 to disable) */
  autoHideOnlineMessage?: number
}

/**
 * Offline status indicator component
 *
 * Shows users when they are offline and provides options to retry connection.
 * Can be displayed as a full alert or compact badge.
 */
export function OfflineIndicator({
  showAlert = true,
  showBadge = false,
  className,
  showRetryButton = true,
  offlineMessage = "You're currently offline. Your work is being saved locally and will sync when connection is restored.",
  onlineMessage = "You're back online! All changes have been synchronized.",
  autoHideOnlineMessage = 3000
}: OfflineIndicatorProps) {
  const { isOnline, isChecking, lastChecked, checkConnectivity } = useOnlineStatus()
  const [showOnlineMessage, setShowOnlineMessage] = React.useState(false)
  const [wasOffline, setWasOffline] = React.useState(false)

  // Track when we go from offline to online to show "back online" message
  React.useEffect(() => {
    if (!wasOffline && !isOnline) {
      setWasOffline(true)
    }

    if (wasOffline && isOnline) {
      setShowOnlineMessage(true)
      setWasOffline(false)

      if (autoHideOnlineMessage > 0) {
        const timer = setTimeout(() => {
          setShowOnlineMessage(false)
        }, autoHideOnlineMessage)

        return () => clearTimeout(timer)
      }
    }
  }, [isOnline, wasOffline, autoHideOnlineMessage])

  const handleRetry = async () => {
    await checkConnectivity()
  }

  // Badge variant
  if (showBadge && !showAlert) {
    return (
      <Badge
        variant={isOnline ? "secondary" : "destructive"}
        className={cn("flex items-center gap-1", className)}
      >
        {isChecking ? (
          <RefreshCw className="h-3 w-3 animate-spin" />
        ) : isOnline ? (
          <Wifi className="h-3 w-3" />
        ) : (
          <WifiOff className="h-3 w-3" />
        )}
        {isOnline ? 'Online' : 'Offline'}
      </Badge>
    )
  }

  // Alert variant - show when offline or temporarily when back online
  const shouldShowAlert = showAlert && (!isOnline || showOnlineMessage)

  if (!shouldShowAlert) {
    return null
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Offline Alert */}
      {!isOnline && (
        <Alert variant="destructive" className="border-orange-200 bg-orange-50">
          <WifiOff className="h-4 w-4" />
          <AlertTitle className="flex items-center justify-between">
            <span>No Internet Connection</span>
            {isChecking && <RefreshCw className="h-4 w-4 animate-spin" />}
          </AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{offlineMessage}</p>

            {lastChecked && (
              <p className="text-xs text-muted-foreground">
                Last checked: {lastChecked.toLocaleTimeString()}
              </p>
            )}

            {showRetryButton && (
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  disabled={isChecking}
                  className="text-xs"
                >
                  {isChecking ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Try Again
                    </>
                  )}
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Back Online Alert */}
      {showOnlineMessage && isOnline && (
        <Alert variant="default" className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">
            Connection Restored
          </AlertTitle>
          <AlertDescription className="text-green-700">
            {onlineMessage}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

/**
 * Compact offline status badge for headers/toolbars
 */
export function OfflineBadge({ className }: { className?: string }) {
  return (
    <OfflineIndicator
      showAlert={false}
      showBadge={true}
      showRetryButton={false}
      className={className}
    />
  )
}

/**
 * Full offline alert for prominent display
 */
export function OfflineAlert({
  className,
  ...props
}: Omit<OfflineIndicatorProps, 'showAlert' | 'showBadge'> & { className?: string }) {
  return (
    <OfflineIndicator
      showAlert={true}
      showBadge={false}
      className={className}
      {...props}
    />
  )
}

export default OfflineIndicator