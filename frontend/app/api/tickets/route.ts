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

    // Handle pagination parameters - frontend sends pageSize and page, backend expects limit and offset
    const pageSize = searchParams.get("pageSize") || searchParams.get("limit") || "100"
    const page = searchParams.get("page") || "1"

    // Convert page-based pagination to offset-based for backend
    const limit = parseInt(pageSize, 10)
    const offset = (parseInt(page, 10) - 1) * limit

    params.set("limit", limit.toString())
    params.set("offset", offset.toString())

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
      limit: Number(limit),
      offset: Number(offset || 0),
    })

  } catch (error) {
    console.error("Error fetching tickets:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Check if we should use mock data
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
      // Mock ticket creation - simulate successful response
      const mockTicketId = `mock-${Date.now()}`
      return NextResponse.json({
        ticket_id: mockTicketId,
        status: "draft",
        validation_gaps: [],
        created_at: new Date().toISOString()
      }, { status: 201 })
    }

    // Transform frontend form data to backend format
    const backendPayload = transformFormDataToBackend(body)

    const response = await fetch(`${API_BASE_URL}/api/tickets/create`, {
      method: "POST",
      headers: {
        "Authorization": "Bearer dashboard-admin-key",
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(backendPayload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[API] Backend error: ${response.status} ${response.statusText}`, errorText)

      // Parse error response if possible
      try {
        const errorData = JSON.parse(errorText)
        return NextResponse.json(
          { error: errorData.detail || "Failed to create ticket", validation_gaps: errorData.validation_gaps || [] },
          { status: response.status }
        )
      } catch {
        return NextResponse.json(
          { error: "Failed to create ticket" },
          { status: response.status }
        )
      }
    }

    const backendData = await response.json()
    console.log(`[API] Ticket created: ${backendData.ticket_id}`)

    return NextResponse.json(backendData, { status: 201 })

  } catch (error) {
    console.error("Error creating ticket:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function transformFormDataToBackend(formData: any) {
  // Transform frontend form structure to backend API format
  return {
    // Excavator information
    caller_name: formData.excavator?.contact_name || "",
    caller_company: formData.excavator?.company || "",
    caller_phone: formData.excavator?.phone || "",
    caller_email: formData.excavator?.email || "",

    excavator_company: formData.excavator?.company || "",
    excavator_phone: formData.excavator?.phone || "",

    // Work details
    work_description: formData.work?.type_of_work || "",
    work_type: formData.work?.type_of_work || "",
    work_for: formData.work?.work_for || "",
    work_duration_days: formData.work?.duration_days || null,
    explosives_used: formData.work?.is_blasting || false,

    // Site information
    county: formData.site?.county || "",
    city: formData.site?.city || "",
    address: formData.site?.address || "",
    cross_street: formData.site?.cross_street || "",

    gps_lat: formData.site?.gps?.lat || null,
    gps_lng: formData.site?.gps?.lng || null,

    driving_directions: formData.site?.driving_directions || "",
    marking_instructions: formData.site?.marking_instructions || "",
    remarks: formData.site?.remarks || "",
    white_lining_complete: formData.site?.site_marked_white || false,

    // Additional details
    notes: formData.additional?.notes || "",
    reference_number: formData.additional?.reference_number || ""
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
