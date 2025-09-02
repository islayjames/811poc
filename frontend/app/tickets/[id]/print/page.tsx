"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { api, ApiError } from "@/lib/api"
import { formatTicketId } from "@/lib/format"
import type { TicketDetail } from "@/lib/types"
import { ArrowLeftIcon } from "lucide-react"
import { SubmitPacketView } from "@/components/packet/SubmitPacketView"

export default function TicketPrintPage() {
  const params = useParams()
  const ticketId = params.id as string
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.getTicket(ticketId)
        setTicket(response)

        setTimeout(() => {
          window.print()
        }, 600)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load ticket")
      } finally {
        setLoading(false)
      }
    }

    fetchTicket()
  }, [ticketId])

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">Loading ticket for printing...</div>
        </div>
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center text-red-600">{error || "Ticket not found"}</div>
          <div className="text-center mt-4 print:hidden">
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Ticket
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            @page {
              size: letter portrait;
              margin: 0.5in;
            }
            body {
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
            }
            .print\\:hidden {
              display: none !important;
            }
            /* Force monochrome in print */
            * {
              color: black !important;
              background: white !important;
              border-color: black !important;
            }
            /* Hide interactive elements */
            button, a, [title], [data-tooltip] {
              display: none !important;
            }
            /* Remove tooltips */
            [title]:after {
              display: none !important;
            }
          }
        `,
        }}
      />

      <div className="max-w-4xl mx-auto p-8">
        {/* Screen-only back button */}
        <div className="print:hidden mb-6">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Ticket
          </Button>
        </div>

        <div className="mb-8 pb-4 border-b-2 border-black">
          <h1 className="text-2xl font-bold">Texas811 Submission Packet</h1>
          <div className="mt-2 text-lg">
            <span className="font-semibold">Ticket ID:</span> {formatTicketId(ticket.id)}
          </div>
          <div className="text-sm text-gray-600 mt-1">Generated: {new Date().toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-2 italic">Not an official Texas811 document.</div>
        </div>

        <SubmitPacketView packet={ticket.submit_packet} mode="print" showDisclaimer={true} />
      </div>
    </div>
  )
}
