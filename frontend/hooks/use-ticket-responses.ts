import { useState, useEffect } from 'react'
import { api, ApiError } from '@/lib/api'

interface UtilityResponse {
  utility: string
  status: string
  notes: string | null
  user_name?: string | null
  created_at?: string | null
  response_id?: string | null
  member_code?: string | null
}

export function useTicketResponses(ticketId: string, initialResponses?: UtilityResponse[]) {
  const [responses, setResponses] = useState<UtilityResponse[]>(initialResponses || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Only consider we have initial data if responses array has content
  // Empty array from the ticket API means we should still fetch
  const [hasInitialData] = useState(() => initialResponses !== undefined && initialResponses.length > 0)

  const fetchResponses = async () => {
    if (!ticketId) return

    try {
      setLoading(true)
      setError(null)
      const fetchedResponses = await api.fetchTicketResponses(ticketId)
      setResponses(fetchedResponses)
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : 'Failed to fetch responses'
      setError(errorMessage)
      console.error(`[useTicketResponses] Error fetching responses for ticket ${ticketId}:`, err)
    } finally {
      setLoading(false)
    }
  }

  const refetch = () => {
    fetchResponses()
  }

  // Only auto-fetch if initialResponses was not provided at all (undefined)
  // An empty array is a valid initial state and shouldn't trigger a fetch
  useEffect(() => {
    if (!hasInitialData) {
      fetchResponses()
    }
  }, [ticketId, hasInitialData]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    responses,
    loading,
    error,
    refetch,
    hasResponses: responses.length > 0
  }
}
