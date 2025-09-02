import { type NextRequest, NextResponse } from "next/server"
import { getMockTicketDetail } from "@/lib/mock-data"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Check if we should use mock data
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
      // Check if ticket exists in mock data
      const ticketData = getMockTicketDetail(id)
      if (!ticketData) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
      }

      // Simulate successful status update
      return NextResponse.json({ success: true })
    }

    // Use real backend
    const backendUrl = `${API_BASE_URL}/dashboard/tickets/${id}/mark-submitted`

    console.log(`[API] Marking ticket ${id} as submitted via: ${backendUrl}`)

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Authorization": "Bearer dashboard-admin-key",
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        submission_reference: `SUBMITTED-${Date.now()}`,
        notes: "Marked as submitted via dashboard"
      })
    })

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
      }
      console.error(`[API] Backend error: ${response.status} ${response.statusText}`)
      throw new Error(`Backend request failed: ${response.status}`)
    }

    const result = await response.json()
    console.log(`[API] Successfully marked ticket ${id} as submitted`)

    return NextResponse.json({ success: true, data: result })

  } catch (error) {
    console.error("Error marking ticket as submitted:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
