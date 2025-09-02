import { type NextRequest, NextResponse } from "next/server"
import { getMockTicketList } from "@/lib/mock-data"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export async function GET(request: NextRequest) {
  try {
    // Check if we should use mock data
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
      const { searchParams } = new URL(request.url)

      const statuses = searchParams.getAll("status")
      const city = searchParams.get("city")
      const county = searchParams.get("county")
      const q = searchParams.get("q")
      const page = searchParams.get("page") ? Number.parseInt(searchParams.get("page")!) : 1
      const pageSize = searchParams.get("pageSize") ? Number.parseInt(searchParams.get("pageSize")!) : 25
      const sort = searchParams.get("sort") || "earliest_start"
      const dir = searchParams.get("dir") || "asc"

      // Convert page-based to offset-based for internal use
      const limit = pageSize
      const offset = (page - 1) * pageSize

      const data = getMockTicketList({
        statuses: statuses.length > 0 ? statuses : undefined,
        city: city || undefined,
        county: county || undefined,
        q: q || undefined,
        sort,
        dir,
        limit,
        offset,
      })

      return NextResponse.json(data)
    }

    // Use real backend
    const { searchParams } = new URL(request.url)

    // Forward query parameters to backend
    const params = new URLSearchParams()

    const statuses = searchParams.getAll("status")
    if (statuses.length > 0) {
      // Backend expects single status filter
      params.set("status", statuses[0].toLowerCase())
    }

    const city = searchParams.get("city")
    if (city) params.set("city", city)

    const county = searchParams.get("county")
    if (county) params.set("county", county)

    const q = searchParams.get("q")
    if (q) params.set("q", q)

    const limit = searchParams.get("limit")
    if (limit) params.set("limit", limit)

    const offset = searchParams.get("offset")
    if (offset) params.set("offset", offset)

    const queryString = params.toString()
    const backendUrl = `${API_BASE_URL}/dashboard/tickets${queryString ? `?${queryString}` : ""}`

    console.log(`[API] Proxying to: ${backendUrl}`)

    const response = await fetch(backendUrl, {
      headers: {
        "Authorization": "Bearer dashboard-admin-key",
        "Accept": "application/json"
      }
    })

    if (!response.ok) {
      console.error(`[API] Backend error: ${response.status} ${response.statusText}`)
      throw new Error(`Backend request failed: ${response.status}`)
    }

    const backendData = await response.json()
    console.log(`[API] Received ${backendData.tickets?.length || 0} tickets from backend`)

    // Transform backend response to frontend format
    const transformedTickets = backendData.tickets.map((ticket: any) => ({
      id: ticket.ticket_id,
      work_order_ref: ticket.session_id, // Use session_id as work order reference
      city: ticket.city,
      county: ticket.county,
      status: mapBackendStatus(ticket.status),
      dates: {
        earliest_lawful_start: ticket.lawful_start_date,
        expires_at: ticket.ticket_expires_date,
      },
      gap_count: ticket.validation_gaps?.length || 0,
    }))

    return NextResponse.json({
      tickets: transformedTickets,
      total: transformedTickets.length,
      limit: 25,
      offset: 0,
    })

  } catch (error) {
    console.error("Error fetching tickets:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
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
