import { type NextRequest, NextResponse } from "next/server"
import { getMockTicketDetail } from "@/lib/mock-data"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Check if we should use mock data
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
      const data = getMockTicketDetail(id)

      if (!data) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
      }

      return NextResponse.json(data)
    }

    // Use real backend
    const backendUrl = `${API_BASE_URL}/dashboard/tickets/${id}`

    console.log(`[API] Fetching ticket detail from: ${backendUrl}`)

    const response = await fetch(backendUrl, {
      headers: {
        "Authorization": "Bearer dashboard-admin-key",
        "Accept": "application/json"
      }
    })

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
      }
      console.error(`[API] Backend error: ${response.status} ${response.statusText}`)
      throw new Error(`Backend request failed: ${response.status}`)
    }

    const backendData = await response.json()
    console.log(`[API] Retrieved ticket ${id} from backend`)

    // Transform backend response to frontend format
    const transformedTicket = {
      id: backendData.ticket_id,
      status: mapBackendStatus(backendData.status),
      ticket_type_hint: "Normal",
      requested_at: backendData.created_at,
      dates: {
        earliest_lawful_start: backendData.lawful_start_date,
        positive_response_at: backendData.submitted_at,
        expires_at: backendData.ticket_expires_date,
      },
      excavator: {
        company: backendData.excavator_company || backendData.caller_company || null,
        contact_name: backendData.caller_name || null,
        phone: backendData.excavator_phone || backendData.caller_phone || null,
        email: backendData.caller_email || null,
      },
      work: {
        work_for: backendData.caller_company || null,
        type_of_work: backendData.work_description || null,
        is_trenchless: backendData.boring_crossing || false,
        is_blasting: backendData.explosives_used || false,
        depth_inches: null, // Let frontend handle display
        duration_days: backendData.work_duration_days || null,
      },
      site: {
        county: backendData.county,
        city: backendData.city,
        address: backendData.address,
        cross_street: backendData.cross_street,
        subdivision: null,
        lot_block: null,
        gps: {
          lat: backendData.gps_lat,
          lng: backendData.gps_lng
        },
        driving_directions: backendData.driving_directions,
        marking_instructions: backendData.marking_instructions,
        remarks: backendData.remarks,
        work_area_description: backendData.work_description,
        site_marked_white: backendData.white_lining_complete || false,
      },
      geom: {
        geometry_type: backendData.geometry?.type || "Point",
        geojson: backendData.geometry,
        confidence: backendData.geometry?.confidence_score || null,
        assumptions: null,
        warnings: null,
      },
      submit_packet: backendData.submission_packet || {},
      responses: [], // Backend doesn't provide responses yet
      audit_log: [], // Backend doesn't provide audit log yet
    }

    return NextResponse.json(transformedTicket)

  } catch (error) {
    console.error("Error fetching ticket:", error)
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
