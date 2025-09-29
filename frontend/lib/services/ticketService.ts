import type {
  TicketFormData,
  CreateTicketResponse,
  UpdateTicketResponse,
  ValidationResult,
  ValidationError
} from "@/lib/types/form"

// Extended types for advanced update functionality
export interface OptimisticUpdateOptions {
  enableOptimistic?: boolean
  rollbackOnError?: boolean
  conflictResolution?: 'client' | 'server' | 'prompt'
}

export interface ConflictData {
  field: string
  clientValue: any
  serverValue: any
  lastModified: string
}

export interface UpdateResult {
  success: boolean
  ticket?: any
  conflicts?: ConflictData[]
  validationGaps?: ValidationError[]
  auditEntry?: {
    timestamp: string
    changes: Record<string, { from: any; to: any }>
    user: string
  }
}

export class TicketAPIError extends Error {
  constructor(
    public status: number,
    message: string,
    public validationGaps?: ValidationError[]
  ) {
    super(message)
    this.name = "TicketAPIError"
  }
}

export class TicketService {
  /**
   * Create a new ticket
   */
  static async createTicket(data: TicketFormData): Promise<CreateTicketResponse> {
    const response = await fetch('/api/tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new TicketAPIError(
        response.status,
        errorData.error || 'Failed to create ticket',
        errorData.validation_gaps
      )
    }

    return response.json()
  }

  /**
   * Update an existing ticket
   */
  static async updateTicket(
    ticketId: string,
    data: Partial<TicketFormData>
  ): Promise<UpdateTicketResponse> {
    const response = await fetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new TicketAPIError(
        response.status,
        errorData.error || 'Failed to update ticket',
        errorData.validation_gaps
      )
    }

    return response.json()
  }

  /**
   * Validate ticket data without saving
   */
  static async validateTicket(data: Partial<TicketFormData>): Promise<ValidationResult> {
    const response = await fetch('/api/tickets/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new TicketAPIError(
        response.status,
        errorData.error || 'Failed to validate ticket'
      )
    }

    return response.json()
  }

  /**
   * Save ticket as draft
   */
  static async saveDraft(data: Partial<TicketFormData>, ticketId?: string): Promise<void> {
    if (ticketId) {
      // Update existing draft
      await this.updateTicket(ticketId, data)
    } else {
      // For new tickets, save to localStorage (server drafts can be implemented later)
      localStorage.setItem('ticket-create-draft', JSON.stringify(data))
    }
  }

  /**
   * Auto-save ticket data (optimized for frequent saves)
   */
  static async autoSave(
    data: Partial<TicketFormData>,
    ticketId?: string,
    options: {
      debounce?: boolean
      silent?: boolean
    } = {}
  ): Promise<void> {
    const { debounce = true, silent = true } = options

    try {
      if (ticketId) {
        // For existing tickets, use the auto-save endpoint if available
        const response = await fetch(`/api/tickets/${ticketId}/autosave`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auto-Save': 'true'
          },
          body: JSON.stringify(data),
        })

        if (!response.ok) {
          // Fallback to regular update if auto-save endpoint doesn't exist
          if (response.status === 404) {
            await this.updateTicket(ticketId, data)
          } else {
            const errorData = await response.json().catch(() => ({}))
            throw new TicketAPIError(
              response.status,
              errorData.error || 'Auto-save failed'
            )
          }
        }
      } else {
        // For new tickets, save to localStorage with timestamp
        const autoSaveData = {
          data,
          timestamp: Date.now(),
          type: 'auto-save'
        }
        localStorage.setItem('ticket-create-autosave', JSON.stringify(autoSaveData))
      }
    } catch (error) {
      if (!silent) {
        throw error
      }
      // Silent failure - log but don't throw
      console.warn('Auto-save failed silently:', error)
    }
  }

  /**
   * Get auto-saved draft (includes both manual and auto-save)
   */
  static getAutoSavedDraft(): Partial<TicketFormData> | null {
    try {
      // Check for auto-save first (more recent)
      const autoSaved = localStorage.getItem('ticket-create-autosave')
      const manualSaved = localStorage.getItem('ticket-create-draft')

      let autoSaveData = null
      let manualSaveData = null

      if (autoSaved) {
        const parsed = JSON.parse(autoSaved)
        autoSaveData = { ...parsed, timestamp: parsed.timestamp || 0 }
      }

      if (manualSaved) {
        try {
          const parsed = JSON.parse(manualSaved)
          manualSaveData = {
            data: parsed,
            timestamp: 0 // Manual saves don't have timestamps in old format
          }
        } catch {
          // Old format, wrap in new structure
          manualSaveData = { data: JSON.parse(manualSaved), timestamp: 0 }
        }
      }

      // Return the most recent save
      if (autoSaveData && manualSaveData) {
        return autoSaveData.timestamp > manualSaveData.timestamp
          ? autoSaveData.data
          : manualSaveData.data
      }

      return autoSaveData?.data || manualSaveData?.data || null
    } catch (error) {
      console.error('Failed to parse auto-saved draft:', error)
      localStorage.removeItem('ticket-create-autosave')
      localStorage.removeItem('ticket-create-draft')
      return null
    }
  }

  /**
   * Clear all saved drafts
   */
  static clearAllSavedDrafts(): void {
    localStorage.removeItem('ticket-create-draft')
    localStorage.removeItem('ticket-create-autosave')
  }

  /**
   * Check if form data conflicts with server data
   */
  static async checkForConflicts(
    ticketId: string,
    localData: Partial<TicketFormData>,
    lastSyncTime: Date
  ): Promise<ConflictData[]> {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/check-conflicts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          localData,
          lastSyncTime: lastSyncTime.toISOString()
        }),
      })

      if (!response.ok) {
        // If endpoint doesn't exist, assume no conflicts
        if (response.status === 404) {
          return []
        }
        throw new Error('Failed to check for conflicts')
      }

      const result = await response.json()
      return result.conflicts || []
    } catch (error) {
      console.warn('Conflict check failed:', error)
      return [] // Assume no conflicts on error
    }
  }

  /**
   * Get saved draft
   */
  static getSavedDraft(): Partial<TicketFormData> | null {
    try {
      const saved = localStorage.getItem('ticket-create-draft')
      return saved ? JSON.parse(saved) : null
    } catch (error) {
      console.error('Failed to parse saved draft:', error)
      localStorage.removeItem('ticket-create-draft')
      return null
    }
  }

  /**
   * Clear saved draft
   */
  static clearSavedDraft(): void {
    localStorage.removeItem('ticket-create-draft')
  }

  /**
   * Handle form submission with proper error mapping
   */
  static async handleFormSubmit(
    data: TicketFormData,
    options: {
      isDraft?: boolean
      ticketId?: string
    } = {}
  ): Promise<CreateTicketResponse | UpdateTicketResponse> {
    try {
      if (options.isDraft) {
        await this.saveDraft(data, options.ticketId)
        // Return a mock response for draft saves
        return {
          ticket_id: options.ticketId || 'draft',
          status: 'draft',
          validation_gaps: [],
          created_at: new Date().toISOString()
        } as CreateTicketResponse
      }

      if (options.ticketId) {
        return await this.updateTicket(options.ticketId, data)
      } else {
        return await this.createTicket(data)
      }
    } catch (error) {
      if (error instanceof TicketAPIError) {
        throw error
      }

      // Handle network or other errors
      throw new TicketAPIError(
        500,
        error instanceof Error ? error.message : 'An unexpected error occurred'
      )
    }
  }

  /**
   * Enhanced update with optimistic updates and conflict resolution
   */
  static async updateTicketAdvanced(
    ticketId: string,
    data: Partial<TicketFormData>,
    originalData: Partial<TicketFormData>,
    options: OptimisticUpdateOptions = {}
  ): Promise<UpdateResult> {
    const {
      enableOptimistic = true,
      rollbackOnError = true,
      conflictResolution = 'prompt'
    } = options

    try {
      // Create audit trail entry
      const changes = this.createChangeAudit(originalData, data)
      const auditEntry = {
        timestamp: new Date().toISOString(),
        changes,
        user: 'dashboard-user' // In real app, get from auth context
      }

      const response = await fetch(`/api/tickets/${ticketId}/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Expected-Version': this.getDataVersion(originalData),
        },
        body: JSON.stringify({
          ...data,
          _audit: auditEntry
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // Handle conflict detection (409 Conflict)
        if (response.status === 409 && errorData.conflicts) {
          return {
            success: false,
            conflicts: errorData.conflicts,
            validationGaps: errorData.validation_gaps
          }
        }

        throw new TicketAPIError(
          response.status,
          errorData.error || 'Failed to update ticket',
          errorData.validation_gaps
        )
      }

      const result = await response.json()

      return {
        success: true,
        ticket: result.ticket,
        validationGaps: result.validation_gaps || [],
        auditEntry
      }

    } catch (error) {
      if (error instanceof TicketAPIError) {
        throw error
      }

      throw new TicketAPIError(
        500,
        error instanceof Error ? error.message : 'An unexpected error occurred'
      )
    }
  }

  /**
   * Create change audit comparing original and new data
   */
  private static createChangeAudit(
    original: Partial<TicketFormData>,
    updated: Partial<TicketFormData>
  ): Record<string, { from: any; to: any }> {
    const changes: Record<string, { from: any; to: any }> = {}

    const compareObjects = (originalObj: any, updatedObj: any, prefix = '') => {
      Object.keys(updatedObj || {}).forEach(key => {
        const fullKey = prefix ? `${prefix}.${key}` : key
        const originalValue = originalObj?.[key]
        const updatedValue = updatedObj[key]

        if (typeof updatedValue === 'object' && updatedValue !== null && !Array.isArray(updatedValue)) {
          compareObjects(originalValue, updatedValue, fullKey)
        } else if (originalValue !== updatedValue) {
          changes[fullKey] = {
            from: originalValue,
            to: updatedValue
          }
        }
      })
    }

    compareObjects(original, updated)
    return changes
  }

  /**
   * Get data version for conflict detection (simple hash of key fields)
   */
  private static getDataVersion(data: Partial<TicketFormData>): string {
    const keyFields = [
      data.site?.address,
      data.excavator?.company,
      data.work?.type_of_work,
      data.site?.gps?.lat,
      data.site?.gps?.lng
    ].filter(Boolean)

    return btoa(keyFields.join('|')).slice(0, 8)
  }

  /**
   * Resolve conflicts by merging client and server data
   */
  static async resolveConflicts(
    ticketId: string,
    conflicts: ConflictData[],
    resolution: 'client' | 'server' | Record<string, 'client' | 'server'>
  ): Promise<UpdateResult> {
    const resolutionData: any = {}

    conflicts.forEach(conflict => {
      const fieldResolution = typeof resolution === 'string'
        ? resolution
        : resolution[conflict.field] || 'client'

      resolutionData[conflict.field] = fieldResolution === 'client'
        ? conflict.clientValue
        : conflict.serverValue
    })

    const response = await fetch(`/api/tickets/${ticketId}/resolve-conflicts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resolutions: resolutionData,
        conflicts: conflicts.map(c => ({ field: c.field, lastModified: c.lastModified }))
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new TicketAPIError(
        response.status,
        errorData.error || 'Failed to resolve conflicts'
      )
    }

    const result = await response.json()
    return {
      success: true,
      ticket: result.ticket,
      validationGaps: result.validation_gaps || []
    }
  }

  /**
   * Highlight validation gaps in form fields
   */
  static highlightValidationGaps(gaps: ValidationError[]): Record<string, ValidationError[]> {
    const fieldErrors: Record<string, ValidationError[]> = {}

    gaps.forEach(gap => {
      const field = gap.field || 'general'
      if (!fieldErrors[field]) {
        fieldErrors[field] = []
      }
      fieldErrors[field].push(gap)
    })

    return fieldErrors
  }

  /**
   * Transform API validation gaps to form validation errors
   */
  static transformValidationGaps(gaps: any[]): ValidationError[] {
    return gaps.map(gap => ({
      field: gap.field || gap.path,
      message: gap.message || gap.error || 'Validation error',
      code: gap.code
    }))
  }
}