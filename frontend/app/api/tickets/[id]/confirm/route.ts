import { type NextRequest, NextResponse } from "next/server"
import { getMockTicketDetail } from "@/lib/mock-data"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    // Check if ticket exists in mock data
    const ticketData = getMockTicketDetail(id)
    if (!ticketData) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    // Simulate successful confirmation
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error confirming ticket:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
