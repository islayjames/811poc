import { Badge } from "@/components/ui/badge"
import type { TicketStatus } from "@/lib/types"
import { getStatusColor, getStatusLabel } from "@/lib/format"

interface StatusPillProps {
  status: TicketStatus
  className?: string
}

export function StatusPill({ status, className }: StatusPillProps) {
  return (
    <Badge variant="outline" className={`${getStatusColor(status)} ${className || ""}`}>
      {getStatusLabel(status)}
    </Badge>
  )
}
