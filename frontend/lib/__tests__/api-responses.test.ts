import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { api, ApiError } from '../api'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('API Client - Responses Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment variables
    process.env.NEXT_PUBLIC_USE_MOCK = 'false'
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchTicketResponses', () => {
    const mockTicketId = 'test-ticket-123'

    it('should fetch responses successfully', async () => {
      const mockResponses = [
        {
          utility: 'CenterPoint Energy',
          status: 'Located',
          notes: 'Gas line located and marked'
        },
        {
          utility: 'Atmos Energy',
          status: 'Clear',
          notes: null
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ responses: mockResponses })
      })

      const result = await api.fetchTicketResponses(mockTicketId)

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/tickets/${mockTicketId}/responses`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      )
      expect(result).toEqual(mockResponses)
    })

    it('should handle 404 error for non-existent ticket', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Ticket not found'
      })

      await expect(api.fetchTicketResponses('nonexistent-ticket'))
        .rejects
        .toThrow(ApiError)

      await expect(api.fetchTicketResponses('nonexistent-ticket'))
        .rejects
        .toThrow('Ticket not found')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(api.fetchTicketResponses(mockTicketId))
        .rejects
        .toThrow('Network error')
    })

    it('should handle server errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error'
      })

      await expect(api.fetchTicketResponses(mockTicketId))
        .rejects
        .toThrow(ApiError)
    })

    it('should return empty array when responses is undefined', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ responses: undefined })
      })

      const result = await api.fetchTicketResponses(mockTicketId)
      expect(result).toEqual([])
    })

    it('should return empty array for mock mode', async () => {
      process.env.NEXT_PUBLIC_USE_MOCK = 'true'

      // Mock mode should not make fetch requests
      const result = await api.fetchTicketResponses(mockTicketId)

      expect(mockFetch).not.toHaveBeenCalled()
      expect(result).toEqual([])
    })

    it('should handle empty responses array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ responses: [] })
      })

      const result = await api.fetchTicketResponses(mockTicketId)
      expect(result).toEqual([])
    })

    it('should validate response structure', async () => {
      const invalidResponses = [
        { utility: 'Test Utility' }, // Missing status
        { status: 'Located' }, // Missing utility
        { utility: 'Test Utility', status: 'InvalidStatus', notes: 'Test' }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ responses: invalidResponses })
      })

      // Should handle malformed responses gracefully
      const result = await api.fetchTicketResponses(mockTicketId)
      expect(result).toEqual(invalidResponses)
    })
  })

  describe('getTicket with responses integration', () => {
    const mockTicketId = 'test-ticket-123'

    it('should fetch ticket detail and automatically load responses', async () => {
      const mockTicketDetail = {
        ticket_id: mockTicketId,
        status: 'ResponsesIn',
        // ... other ticket fields
      }

      const mockResponses = [
        {
          utility: 'CenterPoint Energy',
          status: 'Located',
          notes: 'Gas line located'
        }
      ]

      // Mock the ticket detail fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTicketDetail
      })

      const result = await api.getTicket(mockTicketId)

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/tickets/${mockTicketId}`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      )
      expect(result.responses).toBeDefined()
    })
  })
})
