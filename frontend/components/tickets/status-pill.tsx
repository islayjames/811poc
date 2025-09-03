import { Badge } from "@/components/ui/badge"
import type { TicketStatus, ResponseStatus } from "@/lib/types"
import { getStatusColor, getStatusLabel, getResponseStatusColor, getResponseStatusLabel } from "@/lib/format"

interface StatusPillProps {
  status: TicketStatus | ResponseStatus | string
  type?: 'ticket' | 'response'
  className?: string
}

export function StatusPill({ status, type = 'ticket', className }: StatusPillProps) {
  if (type === 'response') {
    return (
      <Badge variant="outline" className={`${getResponseStatusColor(status)} ${className || ""}`}>
        {getResponseStatusLabel(status)}
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className={`${getStatusColor(status as TicketStatus)} ${className || ""}`}>
      {getStatusLabel(status as TicketStatus)}
    </Badge>
  )
}
