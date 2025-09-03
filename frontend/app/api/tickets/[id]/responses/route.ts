import { type NextRequest, NextResponse } from "next/server"
import { getMockTicketDetail } from "@/lib/mock-data"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    // Check if we should use mock data
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
      // Check if ticket exists in mock data
      const ticketData = getMockTicketDetail(id)
      if (!ticketData) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
      }

      // Simulate successful response marking
      return NextResponse.json({ success: true })
    }

    // Use real backend
    const backendUrl = `${API_BASE_URL}/dashboard/tickets/${id}/mark-responses-in`

    console.log(`[API] Marking responses received for ticket ${id} via: ${backendUrl}`)

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Authorization": "Bearer dashboard-admin-key",
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
      }
      console.error(`[API] Backend error: ${response.status} ${response.statusText}`)
      throw new Error(`Backend request failed: ${response.status}`)
    }

    const result = await response.json()
    console.log(`[API] Successfully marked responses received for ticket ${id}`)

    return NextResponse.json({ success: true, data: result })

  } catch (error) {
    console.error("Error marking responses received:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET endpoint for fetching responses
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Check if we should use mock data
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
      // Return empty responses for mock mode
      return NextResponse.json({ responses: [] })
    }

    // Use real backend - dashboard endpoint for responses
    const backendUrl = `${API_BASE_URL}/dashboard/tickets/${id}/responses`

    console.log(`[API] Fetching responses for ticket ${id} from: ${backendUrl}`)

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

    const data = await response.json()
    console.log(`[API] Retrieved ${data.responses?.length || 0} responses for ticket ${id}`)

    // Transform backend response format to match frontend expectations
    // Include all available fields from the response
    const transformedResponses = (data.responses || []).map((response: any) => ({
      utility: response.member_name || response.member_code,
      status: response.status,
      notes: response.comment || response.facilities || null,
      user_name: response.user_name || null,
      created_at: response.created_at || null,
      response_id: response.response_id || null,
      member_code: response.member_code || null
    }))

    return NextResponse.json({ responses: transformedResponses })

  } catch (error) {
    console.error("Error fetching responses:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
