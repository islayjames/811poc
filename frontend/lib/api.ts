import type { TicketListResponse, TicketDetail, TicketFilters } from "./types"
import { MOCK_TICKETS, MOCK_TICKET_BY_ID } from "./mock-data"

// Backend API Response Types
interface BackendTicketModel {
  ticket_id: string
  session_id: string
  status: string
  county: string
  city: string
  address: string
  cross_street: string | null
  work_description: string
  caller_name: string | null
  caller_company: string | null
  caller_phone: string | null
  caller_email: string | null
  excavator_company: string | null
  excavator_address: string | null
  excavator_phone: string | null
  work_start_date: string | null
  work_duration_days: number | null
  work_type: string | null
  driving_directions: string | null
  marking_instructions: string | null
  remarks: string | null
  gps_lat: number | null
  gps_lng: number | null
  lawful_start_date: string | null
  ticket_expires_date: string | null
  marking_valid_until: string | null
  submitted_at: string | null
  created_at: string
  updated_at: string
  validation_gaps: any[]
  geometry: any
  white_lining_complete?: boolean | null
  explosives_used?: boolean | null
  submission_packet?: any
}

interface BackendTicketListResponse {
  tickets: BackendTicketModel[]
  total_count: number
  page: number
  page_size: number
}

interface BackendTicketDetailResponse extends BackendTicketModel {
  audit_history: any[]
  countdown_info: any
}

// Mapping functions
function mapBackendTicketToFrontend(backendTicket: BackendTicketModel) {
  return {
    id: backendTicket.ticket_id,
    work_order_ref: null, // Backend doesn't have this field
    city: backendTicket.city,
    county: backendTicket.county,
    status: mapBackendStatus(backendTicket.status),
    dates: {
      earliest_lawful_start: backendTicket.lawful_start_date,
      expires_at: backendTicket.ticket_expires_date,
    },
    gap_count: backendTicket.validation_gaps?.length || 0,
  }
}

function mapBackendDetailToFrontend(backendDetail: BackendTicketDetailResponse): TicketDetail {
  return {
    id: backendDetail.ticket_id,
    status: mapBackendStatus(backendDetail.status),
    ticket_type_hint: "Normal",
    requested_at: backendDetail.created_at,
    dates: {
      earliest_lawful_start: backendDetail.lawful_start_date,
      positive_response_at: null,
      expires_at: backendDetail.ticket_expires_date,
    },
    excavator: {
      company: backendDetail.excavator_company || "Unknown",
      contact_name: backendDetail.caller_name || "Unknown",
      phone: backendDetail.excavator_phone || backendDetail.caller_phone || "",
      email: backendDetail.caller_email,
    },
    work: {
      work_for: backendDetail.caller_company,
      type_of_work: backendDetail.work_description,
      is_trenchless: false,
      is_blasting: backendDetail.explosives_used || false,
      depth_inches: null,
      duration_days: backendDetail.work_duration_days,
    },
    site: {
      county: backendDetail.county,
      city: backendDetail.city,
      address: backendDetail.address,
      cross_street: backendDetail.cross_street,
      subdivision: null,
      lot_block: null,
      gps: { lat: backendDetail.gps_lat, lng: backendDetail.gps_lng },
      driving_directions: backendDetail.driving_directions,
      marking_instructions: backendDetail.marking_instructions,
      work_area_description: backendDetail.work_description,
      site_marked_white: backendDetail.white_lining_complete || false,
    },
    geom: {
      geometry_type: "Point",
      geojson: backendDetail.geometry,
      confidence: null,
      assumptions: null,
      warnings: null,
    },
    submit_packet: backendDetail.submission_packet || {},
    responses: [],
    audit_log: (backendDetail.audit_history || []).map((event: any) => ({
      ts: event.timestamp || event.created_at,
      actor: event.user_id || "system",
      from: null,
      to: event.action,
      note: event.details?.notes || null,
    })),
  }
}

function mapBackendStatus(backendStatus: string) {
  const statusMap: Record<string, string> = {
    "draft": "Draft",
    "validated": "ValidPendingConfirm",
    "ready": "Ready",
    "submitted": "Submitted",
    "responses_in": "ResponsesIn",
    "ready_to_dig": "ReadyToDig",
    "completed": "ReadyToDig",
    "cancelled": "Cancelled",
    "expired": "Expired",
  }
  return statusMap[backendStatus.toLowerCase()] || backendStatus
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer dashboard-admin-key",
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
              marking_instructions: null,
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
      // Backend expects single status filter, take first one
      params.set("status", filters.status[0].toLowerCase())
    }
    if (filters.city) params.set("city", filters.city)
    if (filters.county) params.set("county", filters.county)
    if (filters.q) params.set("q", filters.q)
    if (filters.limit) params.set("limit", filters.limit.toString())
    if (filters.offset) params.set("offset", filters.offset.toString())

    const queryString = params.toString()
    const endpoint = `dashboard/tickets${queryString ? `?${queryString}` : ""}`

    const backendResponse = await apiRequest<BackendTicketListResponse>(endpoint)

    // Map backend response to frontend format
    return {
      tickets: backendResponse.tickets.map(mapBackendTicketToFrontend),
      total: backendResponse.total_count,
      limit: backendResponse.page_size,
      offset: (backendResponse.page - 1) * backendResponse.page_size,
    }
  },

  // Get single ticket detail
  async getTicket(id: string): Promise<TicketDetail> {
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
      return mockGetTicket(id)
    }

    const backendResponse = await apiRequest<BackendTicketDetailResponse>(`dashboard/tickets/${id}`)
    return mapBackendDetailToFrontend(backendResponse)
  },

  // Confirm ticket (ValidPendingConfirm -> Ready)
  async confirmTicket(id: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
      return mockStatusAction(id, "confirm")
    }

    // Backend uses mark-submitted endpoint for confirm action
    await apiRequest(`dashboard/tickets/${id}/mark-submitted`, {
      method: "POST",
      body: JSON.stringify({ submission_reference: `CONFIRMED-${Date.now()}`, notes: "Confirmed via dashboard" })
    })
  },

  // Mark ticket as submitted (Ready -> Submitted)
  async markSubmitted(id: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
      return mockStatusAction(id, "mark-submitted")
    }

    await apiRequest(`dashboard/tickets/${id}/mark-submitted`, {
      method: "POST",
      body: JSON.stringify({ submission_reference: `SUBMITTED-${Date.now()}`, notes: "Marked as submitted via dashboard" })
    })
  },

  // Mark responses received (Submitted -> ResponsesIn)
  async markResponsesIn(id: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
      return mockStatusAction(id, "mark-responses-in")
    }

    await apiRequest(`dashboard/tickets/${id}/mark-responses-in`, {
      method: "POST",
      body: JSON.stringify({ response_count: 1, all_clear: true, notes: "Responses received via dashboard" })
    })
  },

  // Cancel ticket (any status -> Cancelled)
  async cancelTicket(id: string): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
      return mockStatusAction(id, "cancel")
    }

    await apiRequest(`dashboard/tickets/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ reason: "Cancelled via dashboard", confirm_deletion: false })
    })
  },
}

export { ApiError }
