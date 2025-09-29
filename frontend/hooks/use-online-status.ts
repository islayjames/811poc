import { useState, useEffect, useRef, useCallback } from 'react'

interface OnlineStatusOptions {
  /**
   * How often to check connectivity when online (ms)
   * Default: 30000 (30 seconds)
   */
  checkInterval?: number

  /**
   * How often to check connectivity when offline (ms)
   * Default: 5000 (5 seconds)
   */
  offlineCheckInterval?: number

  /**
   * Timeout for network requests (ms)
   * Default: 5000 (5 seconds)
   */
  timeout?: number

  /**
   * URL to ping for connectivity check
   * Default: '/api/health' (fallback to online check)
   */
  pingUrl?: string
}

interface OnlineStatus {
  /** Current online status */
  isOnline: boolean

  /** Whether the hook is currently checking connectivity */
  isChecking: boolean

  /** Last time status was checked */
  lastChecked: Date | null

  /** Manually trigger a connectivity check */
  checkConnectivity: () => Promise<boolean>

  /** Whether the browser reports as online (may be unreliable) */
  browserOnline: boolean
}

/**
 * Hook to reliably detect online/offline status
 *
 * This hook goes beyond navigator.onLine by actually testing network connectivity
 * and provides more accurate offline detection for form auto-save and API retry logic.
 */
export function useOnlineStatus(options: OnlineStatusOptions = {}): OnlineStatus {
  const {
    checkInterval = 30000, // 30 seconds when online
    offlineCheckInterval = 5000, // 5 seconds when offline
    timeout = 5000,
    pingUrl = '/api/health'
  } = options

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [isChecking, setIsChecking] = useState<boolean>(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  /**
   * Perform actual connectivity check by making a network request
   */
  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    if (isChecking) {
      return isOnline // Return current state if already checking
    }

    setIsChecking(true)

    try {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()

      const response = await fetch(pingUrl, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: abortControllerRef.current.signal,
        timeout: timeout as any // TypeScript doesn't know about this property
      })

      const online = response.ok
      setIsOnline(online)
      setLastChecked(new Date())
      return online

    } catch (error: any) {
      // If the request was aborted, don't update state
      if (error.name === 'AbortError') {
        return isOnline
      }

      // Network error - we're offline
      setIsOnline(false)
      setLastChecked(new Date())
      return false

    } finally {
      setIsChecking(false)
      abortControllerRef.current = null
    }
  }, [isChecking, isOnline, pingUrl, timeout])

  /**
   * Schedule the next connectivity check
   */
  const scheduleNextCheck = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    const interval = isOnline ? checkInterval : offlineCheckInterval

    timeoutRef.current = setTimeout(() => {
      checkConnectivity()
    }, interval)
  }, [isOnline, checkInterval, offlineCheckInterval, checkConnectivity])

  /**
   * Handle browser online/offline events
   */
  useEffect(() => {
    const handleOnline = () => {
      setBrowserOnline(true)
      // Don't immediately trust navigator.onLine - verify with network request
      checkConnectivity()
    }

    const handleOffline = () => {
      setBrowserOnline(false)
      setIsOnline(false)
      setLastChecked(new Date())
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)

      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [checkConnectivity])

  /**
   * Initial connectivity check and periodic checking
   */
  useEffect(() => {
    // Initial check
    checkConnectivity()

    // Set up periodic checking
    scheduleNextCheck()

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [checkConnectivity, scheduleNextCheck])

  /**
   * Schedule next check when status changes
   */
  useEffect(() => {
    scheduleNextCheck()
  }, [scheduleNextCheck, isOnline])

  return {
    isOnline,
    isChecking,
    lastChecked,
    checkConnectivity,
    browserOnline
  }
}