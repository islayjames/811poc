"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { debounce, deepEqual } from "@/lib/utils"
import type { TicketFormData } from "@/lib/types/form"

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'

export interface AutoSaveConfig {
  interval: number // Auto-save interval in milliseconds (default: 30000)
  debounceDelay: number // Debounce delay for change detection (default: 1000)
  onAutoSave: (data: TicketFormData) => Promise<void>
  onError: (error: Error) => void
  enabled: boolean
  ticketId?: string
}

export interface AutoSaveState {
  status: AutoSaveStatus
  lastSaved: Date | null
  hasUnsavedChanges: boolean
  isSaving: boolean
  error: Error | null
}

const LOCAL_STORAGE_PREFIX = 'ticket-autosave-'

/**
 * Custom hook for auto-save functionality
 * Provides timer-based auto-save, change detection, and local storage backup
 */
export function useAutoSave(
  formData: TicketFormData,
  config: AutoSaveConfig
): AutoSaveState & {
  triggerAutoSave: () => Promise<void>
  clearAutoSave: () => void
  restoreFromLocalStorage: () => TicketFormData | null
  saveToLocalStorage: (data: TicketFormData) => void
  clearLocalStorage: () => void
} {
  const {
    interval = 30000, // 30 seconds
    debounceDelay = 1000, // 1 second
    onAutoSave,
    onError,
    enabled,
    ticketId
  } = config

  // State
  const [status, setStatus] = useState<AutoSaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Refs for tracking data and callbacks
  const previousDataRef = useRef<TicketFormData | null>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isManualSaveRef = useRef(false)
  const onAutoSaveRef = useRef(onAutoSave)
  const onErrorRef = useRef(onError)
  const ticketIdRef = useRef(ticketId)

  // Update refs when values change
  useEffect(() => {
    onAutoSaveRef.current = onAutoSave
  }, [onAutoSave])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    ticketIdRef.current = ticketId
  }, [ticketId])

  // Local storage key
  const localStorageKey = ticketId ? `${LOCAL_STORAGE_PREFIX}${ticketId}` : `${LOCAL_STORAGE_PREFIX}new`

  /**
   * Save data to localStorage as backup
   */
  const saveToLocalStorage = useCallback((data: TicketFormData) => {
    try {
      const storageKey = ticketIdRef.current ? `${LOCAL_STORAGE_PREFIX}${ticketIdRef.current}` : `${LOCAL_STORAGE_PREFIX}new`
      const backupData = {
        data,
        timestamp: Date.now(),
        ticketId: ticketIdRef.current || null
      }
      localStorage.setItem(storageKey, JSON.stringify(backupData))
    } catch (error) {
      console.warn('Failed to save auto-save backup to localStorage:', error)
    }
  }, [])

  /**
   * Restore data from localStorage
   */
  const restoreFromLocalStorage = useCallback((): TicketFormData | null => {
    try {
      const stored = localStorage.getItem(localStorageKey)
      if (!stored) return null

      const backup = JSON.parse(stored)

      // Check if backup is recent (within last hour)
      if (Date.now() - backup.timestamp > 3600000) {
        localStorage.removeItem(localStorageKey)
        return null
      }

      return backup.data
    } catch (error) {
      console.warn('Failed to restore auto-save backup from localStorage:', error)
      localStorage.removeItem(localStorageKey)
      return null
    }
  }, [localStorageKey])

  /**
   * Clear localStorage backup
   */
  const clearLocalStorage = useCallback(() => {
    localStorage.removeItem(localStorageKey)
  }, [localStorageKey])

  /**
   * Perform auto-save operation
   */
  const performAutoSave = useCallback(async (data: TicketFormData) => {
    if (!enabled || isManualSaveRef.current) {
      isManualSaveRef.current = false
      return
    }

    setIsSaving(true)
    setStatus('saving')
    setError(null)

    try {
      // Save to localStorage first as backup
      saveToLocalStorage(data)

      // Perform server auto-save using ref to avoid dependency
      await onAutoSaveRef.current(data)

      setStatus('saved')
      setLastSaved(new Date())
      setHasUnsavedChanges(false)

      // Auto-hide saved status after 2 seconds
      setTimeout(() => {
        setStatus(prev => prev === 'saved' ? 'idle' : prev)
      }, 2000)

    } catch (error) {
      console.error('Auto-save failed:', error)
      setStatus('error')
      setError(error instanceof Error ? error : new Error('Auto-save failed'))
      onErrorRef.current(error instanceof Error ? error : new Error('Auto-save failed'))

      // Auto-hide error status after 3 seconds
      setTimeout(() => {
        setStatus(prev => prev === 'error' ? 'idle' : prev)
      }, 3000)
    } finally {
      setIsSaving(false)
    }
  }, [enabled, saveToLocalStorage])

  /**
   * Manual trigger for auto-save
   */
  const triggerAutoSave = useCallback(async () => {
    if (hasUnsavedChanges && formData) {
      isManualSaveRef.current = true
      await performAutoSave(formData)
    }
  }, [hasUnsavedChanges, formData, performAutoSave])

  /**
   * Clear auto-save timer
   */
  const clearAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
  }, [])

  /**
   * Debounced change detection
   */
  const debouncedChangeDetection = useCallback(
    debounce((newData: TicketFormData) => {
      const hasChanges = !deepEqual(previousDataRef.current, newData)
      setHasUnsavedChanges(hasChanges)

      if (hasChanges) {
        previousDataRef.current = { ...newData }
      }
    }, debounceDelay),
    [debounceDelay]
  )

  /**
   * Effect to detect form changes
   */
  useEffect(() => {
    if (formData) {
      debouncedChangeDetection(formData)
    }
  }, [formData, debouncedChangeDetection])

  /**
   * Effect to set up auto-save timer
   */
  useEffect(() => {
    if (!enabled || !hasUnsavedChanges) {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
      return
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }

    // Set up new timer
    autoSaveTimerRef.current = setInterval(() => {
      if (hasUnsavedChanges && formData && !isSaving) {
        performAutoSave(formData)
      }
    }, interval)

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
    }
  }, [enabled, hasUnsavedChanges, formData, isSaving, interval, performAutoSave])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      clearAutoSave()
    }
  }, [clearAutoSave])

  return {
    status,
    lastSaved,
    hasUnsavedChanges,
    isSaving,
    error,
    triggerAutoSave,
    clearAutoSave,
    restoreFromLocalStorage,
    saveToLocalStorage,
    clearLocalStorage
  }
}

/**
 * Hook for auto-save status display
 */
export function useAutoSaveStatus(status: AutoSaveStatus, lastSaved: Date | null) {
  const getStatusText = useCallback(() => {
    switch (status) {
      case 'saving':
        return 'Saving...'
      case 'saved':
        return lastSaved
          ? `Saved at ${lastSaved.toLocaleTimeString()}`
          : 'Saved'
      case 'error':
        return 'Save failed - try again'
      case 'conflict':
        return 'Conflict detected'
      default:
        return ''
    }
  }, [status, lastSaved])

  const getStatusColor = useCallback(() => {
    switch (status) {
      case 'saving':
        return 'text-blue-600'
      case 'saved':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      case 'conflict':
        return 'text-orange-600'
      default:
        return 'text-muted-foreground'
    }
  }, [status])

  return {
    statusText: getStatusText(),
    statusColor: getStatusColor(),
    isVisible: status !== 'idle'
  }
}