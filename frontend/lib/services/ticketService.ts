import type {
  TicketFormData,
  CreateTicketResponse,
  UpdateTicketResponse,
  ValidationResult,
  ValidationError
} from "@/lib/types/form"

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