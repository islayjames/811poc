import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusPill } from '@/components/tickets/status-pill'
import { useTicketResponses } from '@/hooks/use-ticket-responses'
import { CheckCircleIcon, AlertTriangleIcon, RefreshCwIcon, CopyIcon, ClockIcon } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { TicketDetail } from '@/lib/types'
import { getExpectedUtilityMembers } from '@/lib/utility-members'

interface ResponsesSectionProps {
  ticketId: string
  ticket?: TicketDetail
  initialResponses?: Array<{
    utility: string
    status: string
    notes: string | null
    user_name?: string | null
    created_at?: string | null
    response_id?: string | null
    member_code?: string | null
  }>
}

export function ResponsesSection({ ticketId, ticket, initialResponses }: ResponsesSectionProps) {
  const { responses, loading, error, refetch, hasResponses } = useTicketResponses(ticketId, initialResponses)
  const { toast } = useToast()

  // Get combined utility status (expected + actual responses)
  const combinedStatus = useMemo(() => {
    // If we have actual responses, show them directly
    if (responses && responses.length > 0) {
      return responses.map(response => ({
        ...response,
        hasResponse: true,
        expectedMember: null
      }))
    }

    // If we have ticket data but no responses, show expected members
    if (ticket) {
      const expectedMembers = getExpectedUtilityMembers(ticket)
      return expectedMembers.map(expected => ({
        utility: expected.utility,
        status: 'No Response',
        notes: null,
        expectedMember: expected,
        hasResponse: false
      }))
    }

    return []
  }, [ticket, responses])

  // Get response statistics
  const stats = useMemo(() => {
    const total = combinedStatus.length
    const responded = combinedStatus.filter(item => item.hasResponse).length
    const pending = total - responded
    const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0

    return { total, responded, pending, responseRate }
  }, [combinedStatus])

  const handleCopyResponses = async () => {
    if (combinedStatus.length === 0) return

    try {
      const summary = combinedStatus
        .map((item) => {
          const status = item.hasResponse ? item.status : 'No response yet'
          const notes = item.notes ? ` — ${item.notes}` : ''
          return `${item.utility}: ${status}${notes}`
        })
        .join("\n")

      await navigator.clipboard.writeText(summary)
      toast({
        title: "Copied",
        description: "Response summary copied to clipboard",
      })
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      })
    }
  }

  if (loading && (!initialResponses || initialResponses.length === 0)) {
    return (
      <Card id="responses" className="rounded-xl border p-4">
        <CardHeader className="p-0 pb-2">
          <CardTitle className="text-base font-semibold flex items-center space-x-2">
            <CheckCircleIcon className="h-4 w-4" />
            <span>Utility Responses</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card id="responses" className="rounded-xl border p-4">
        <CardHeader className="p-0 pb-2">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircleIcon className="h-4 w-4" />
              <span>Utility Responses</span>
            </div>
            <Button variant="ghost" size="sm" onClick={refetch} disabled={loading}>
              <RefreshCwIcon className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangleIcon className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Failed to Load Responses</AlertTitle>
            <AlertDescription className="text-red-700 mt-2">
              {error}
              <div className="flex items-center space-x-2 mt-3">
                <Button size="sm" onClick={refetch} variant="outline" disabled={loading}>
                  <RefreshCwIcon className="h-4 w-4 mr-2" />
                  {loading ? 'Retrying...' : 'Retry'}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card id="responses" className="rounded-xl border p-4">
      <CardHeader className="p-0 pb-2">
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircleIcon className="h-4 w-4" />
            <span>Utility Responses</span>
            {stats.total > 0 && (
              <Badge variant="secondary" className="text-xs">
                {stats.responded}/{stats.total} responded ({stats.responseRate}%)
              </Badge>
            )}
            {loading && <Skeleton className="h-4 w-4 rounded-full" />}
          </div>
          <div className="flex items-center space-x-2">
            {combinedStatus.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyResponses}
                className="text-xs"
              >
                <CopyIcon className="h-3 w-3 mr-1" />
                Copy summary
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={refetch} disabled={loading}>
              <RefreshCwIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {combinedStatus.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left text-sm font-medium text-muted-foreground py-2">Utility</th>
                  <th className="text-left text-sm font-medium text-muted-foreground py-2">Code</th>
                  <th className="text-left text-sm font-medium text-muted-foreground py-2">Status</th>
                  <th className="text-left text-sm font-medium text-muted-foreground py-2">Notes</th>
                  <th className="text-left text-sm font-medium text-muted-foreground py-2">Submitted By</th>
                  <th className="text-left text-sm font-medium text-muted-foreground py-2">Response Time</th>
                </tr>
              </thead>
              <tbody>
                {combinedStatus.map((item: any, index) => {
                  const isResponded = item.hasResponse
                  const responseDate = item.created_at ? new Date(item.created_at) : null
                  return (
                    <tr
                      key={`${item.utility}-${index}`}
                      className={`border-b last:border-b-0 ${!isResponded ? 'bg-muted/30' : ''}`}
                    >
                      <td className="py-3 text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <span>{item.utility}</span>
                          {!isResponded && (
                            <ClockIcon className="h-3 w-3 text-muted-foreground" title="Awaiting response" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-sm text-muted-foreground">
                        {item.member_code || '-'}
                      </td>
                      <td className="py-3">
                        {isResponded ? (
                          <StatusPill status={item.status} type="response" />
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground border-dashed">
                            No response yet
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 text-sm">
                        {item.notes ? (
                          <span
                            className="truncate block max-w-xs cursor-help"
                            title={item.notes}
                          >
                            {item.notes.length > 50
                              ? `${item.notes.substring(0, 50)}...`
                              : item.notes}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            {isResponded ? "-" : "Pending"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-sm text-muted-foreground">
                        {item.user_name || '-'}
                      </td>
                      <td className="py-3 text-sm text-muted-foreground">
                        {responseDate ? (
                          <span title={responseDate.toLocaleString()}>
                            {responseDate.toLocaleDateString()} {responseDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <h3 className="text-base font-semibold mb-2">No expected utility members found</h3>
            <p className="text-sm text-muted-foreground">
              Expected utility members will appear here based on the ticket location and work type.
            </p>
            {!loading && (
              <Button size="sm" variant="outline" onClick={refetch} className="mt-3">
                <RefreshCwIcon className="h-4 w-4 mr-2" />
                Check for responses
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
