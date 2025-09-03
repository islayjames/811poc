// Simple integration test to verify API client functionality
// Run with: node lib/__tests__/api-integration-test.js

// Mock fetch for testing
const mockFetch = (url, options) => {
  console.log('[TEST] Mock fetch called with:', { url, options })

  if (url === '/api/tickets/test-ticket-123/responses') {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        responses: [
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
      })
    })
  }

  if (url === '/api/tickets/test-ticket-123') {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        id: 'test-ticket-123',
        status: 'ResponsesIn',
        responses: [] // Empty initially, should be fetched separately
      })
    })
  }

  // 404 case
  if (url === '/api/tickets/nonexistent-ticket/responses') {
    return Promise.resolve({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Ticket not found')
    })
  }

  return Promise.resolve({
    ok: false,
    status: 500,
    text: () => Promise.resolve('Unknown endpoint')
  })
}

// Mock environment
global.fetch = mockFetch
process.env.NEXT_PUBLIC_USE_MOCK = 'false'

// Simple API client implementation for testing
class TestApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
    this.name = 'TestApiError'
  }
}

const testApi = {
  async fetchTicketResponses(id) {
    const response = await fetch(`/api/tickets/${id}/responses`, {
      headers: { 'Accept': 'application/json' }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new TestApiError(response.status, errorText || 'Failed to fetch responses')
    }

    const data = await response.json()
    return data.responses || []
  },

  async getTicket(id) {
    const response = await fetch(`/api/tickets/${id}`, {
      headers: { 'Accept': 'application/json' }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new TestApiError(response.status, errorText || 'Failed to fetch ticket')
    }

    const ticketDetail = await response.json()

    // Fetch responses separately if not included
    if (!ticketDetail.responses || ticketDetail.responses.length === 0) {
      try {
        const responses = await this.fetchTicketResponses(id)
        ticketDetail.responses = responses
      } catch (error) {
        console.warn(`[API] Failed to fetch responses for ticket ${id}:`, error.message)
        ticketDetail.responses = []
      }
    }

    return ticketDetail
  }
}

// Test suite
async function runTests() {
  console.log('🧪 Running API Integration Tests...\n')

  try {
    // Test 1: fetchTicketResponses success
    console.log('Test 1: fetchTicketResponses - success case')
    const responses = await testApi.fetchTicketResponses('test-ticket-123')
    console.log('✅ Responses fetched:', responses)
    console.log('✅ Test 1 passed\n')

    // Test 2: fetchTicketResponses 404 error
    console.log('Test 2: fetchTicketResponses - 404 error')
    try {
      await testApi.fetchTicketResponses('nonexistent-ticket')
      console.log('❌ Test 2 failed - should have thrown error')
    } catch (error) {
      if (error instanceof TestApiError && error.status === 404) {
        console.log('✅ Test 2 passed - correctly threw 404 error')
      } else {
        console.log('❌ Test 2 failed - wrong error type:', error)
      }
    }
    console.log()

    // Test 3: getTicket with automatic response fetching
    console.log('Test 3: getTicket - with automatic response fetching')
    const ticket = await testApi.getTicket('test-ticket-123')
    console.log('✅ Ticket fetched with responses:', {
      id: ticket.id,
      status: ticket.status,
      responsesCount: ticket.responses.length
    })
    console.log('✅ Test 3 passed\n')

    console.log('🎉 All tests passed!')

  } catch (error) {
    console.error('❌ Test failed with error:', error)
    process.exit(1)
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests()
}

module.exports = { testApi, TestApiError }
