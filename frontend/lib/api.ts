import type { TicketListResponse, TicketDetail, TicketFilters } from "./types"
import { MOCK_TICKETS, MOCK_TICKET_BY_ID } from "./mock-data"

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new ApiError(response.status, errorText || `API request failed: ${response.statusText}`)
  }

  return response.json()
}

function mockListTickets(filters: TicketFilters = {}): Promise<TicketListResponse> {
  return new Promise((resolve) => {
    setTimeout(() => {
      let filteredTickets = [...MOCK_TICKETS]

      // Apply status filter
      if (filters.status?.length) {
        filteredTickets = filteredTickets.filter((ticket) => filters.status!.includes(ticket.status))
      }

      // Apply city filter
      if (filters.city) {
        filteredTickets = filteredTickets.filter((ticket) =>
          ticket.city.toLowerCase().includes(filters.city!.toLowerCase()),
        )
      }

      // Apply county filter
      if (filters.county) {
        filteredTickets = filteredTickets.filter((ticket) =>
          ticket.county.toLowerCase().includes(filters.county!.toLowerCase()),
        )
      }

      // Apply search filter
      if (filters.q) {
        const query = filters.q.toLowerCase()
        filteredTickets = filteredTickets.filter(
          (ticket) =>
            ticket.id.toLowerCase().includes(query) ||
            ticket.work_order_ref?.toLowerCase().includes(query) ||
            ticket.city.toLowerCase().includes(query) ||
            ticket.county.toLowerCase().includes(query),
        )
      }

      // Apply sorting
      if (filters.sort) {
        filteredTickets.sort((a, b) => {
          let aVal: any, bVal: any

          switch (filters.sort) {
            case "earliest_start":
              aVal = a.dates.earliest_lawful_start
              bVal = b.dates.earliest_lawful_start
              break
            case "expires":
              aVal = a.dates.expires_at
              bVal = b.dates.expires_at
              break
            case "status":
              aVal = a.status
              bVal = b.status
              break
            default:
              return 0
          }

          // Handle null values (put them at the end)
          if (aVal === null && bVal === null) return 0
          if (aVal === null) return 1
          if (bVal === null) return -1

          // Compare values
          if (aVal < bVal) return filters.dir === "desc" ? 1 : -1
          if (aVal > bVal) return filters.dir === "desc" ? -1 : 1
          return 0
        })
      }

      // Apply pagination
      const total = filteredTickets.length
      const page = filters.page || 1
      const pageSize = filters.pageSize || 25
      const offset = (page - 1) * pageSize
      const paginatedTickets = filteredTickets.slice(offset, offset + pageSize)

      resolve({
        tickets: paginatedTickets,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      })
    }, 200) // Simulate network delay
  })
}

function mockGetTicket(id: string): Promise<TicketDetail> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const ticket = MOCK_TICKET_BY_ID[id]
      if (ticket) {
        resolve(ticket)
      } else {
        // Synthesize detail from list item if not in detailed mock data
        const listItem = MOCK_TICKETS.find((t) => t.id === id)
        if (listItem) {
          const synthesized: TicketDetail = {
            id: listItem.id,
            status: listItem.status,
            ticket_type_hint: "Normal",
            requested_at: new Date().toISOString(),
            dates: {
              earliest_lawful_start: listItem.dates.earliest_lawful_start,
              positive_response_at: null,
              expires_at: listItem.dates.expires_at,
            },
            excavator: {
              company: "Demo Utilities LLC",
              contact_name: "Mock User",
              phone: "555-0100",
              email: null,
            },
            work: {
              work_for: "Mock work",
              type_of_work: "Synthesized ticket data",
              is_trenchless: false,
              is_blasting: false,
              depth_inches: 24,
              duration_days: 1,
            },
            site: {
              county: listItem.county,
              city: listItem.city,
              address: "Mock Address",
              cross_street: null,
              subdivision: null,
              lot_block: null,
              gps: { lat: null, lng: null },
              driving_directions: null,
              work_area_description: "Synthesized work area description",
              site_marked_white: false,
            },
            geom: {
              geometry_type: "Point",
              geojson: null,
              confidence: null,
              assumptions: null,
              warnings: null,
            },
            submit_packet: {},
            responses: [],
            audit_log: [],
          }
          resolve(synthesized)
        } else {
          reject(new ApiError(404, "Ticket not found"))
        }
      }
    }, 200)
  })
}

function mockStatusAction(id: string, action: string): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const ticket = MOCK_TICKETS.find((t) => t.id === id)
      if (ticket) {
        console.log(`[Mock] ${action} action performed on ticket ${id}`)
        resolve()
      } else {
        reject(new ApiError(404, "Ticket not found"))
      }
    }, 300)
  })
}

export const api = {
  // Get tickets with optional filters
  async getTickets(filters: TicketFilters = {}): Promise<TicketListResponse> {
    console.log("[v0] Mock mode check:", process.env.NEXT_PUBLIC_USE_MOCK)
    console.log("[v0] Using mock data:", process.env.NEXT_PUBLIC_USE_MOCK === "true")

    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
      console.log("[v0] Returning mock ticket data")
      return mockListTickets(filters)
    }

    console.log("[v0] Making real API call")
    const params = new URLSearchParams()

    if (filters.status?.length) {
      filters.status.forEach((status) => params.append("status", status))
    }
    if (filters.city) params.set("city", filters.city)
    if (filters.county) params.set("county", filters.county)
    if (filters.q) params.set("q", filters.q)
    if (filters.limit) params.set("limit", filters.limit.toString())
    if (filters.offset) params.set("offset", filters.offset.toString())

    const queryString = params.toString()
    const endpoint = `tickets${queryString ? `?${queryString}` : ""}`

    return apiRequest<TicketListResponse>(endpoint)
  },

  // Get single ticket detail
  async getTicket(id: string): Promise<TicketDetail> {
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
      return mockGetTicket(id)
    }

    return apiRequest<TicketDetail>(`tickets/${id}`)
  },

  // Confirm ticket (ValidPendingConfirm -> Ready)
  async confirmTicket(id: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
      return mockStatusAction(id, "confirm")
    }

    await apiRequest(`tickets/${id}/confirm`, { method: "POST" })
  },

  // Mark ticket as submitted (Ready -> Submitted)
  async markSubmitted(id: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
      return mockStatusAction(id, "mark-submitted")
    }

    await apiRequest(`tickets/${id}/mark-submitted`, { method: "POST" })
  },

  // Mark responses received (Submitted -> ResponsesIn)
  async markResponsesIn(id: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
      return mockStatusAction(id, "mark-responses-in")
    }

    await apiRequest(`tickets/${id}/mark-responses-in`, { method: "POST" })
  },

  // Cancel ticket (any status -> Cancelled)
  async cancelTicket(id: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
      return mockStatusAction(id, "cancel")
    }

    await apiRequest(`tickets/${id}/cancel`, { method: "POST" })
  },
}

export { ApiError }
