import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getStatusColor } from "@/lib/format"
import type { TicketDetail } from "@/lib/types"
import { ClockIcon, UserIcon, CpuIcon } from "lucide-react"

interface TimelineProps {
  auditLog: TicketDetail["audit_log"]
}

export function Timeline({ auditLog }: TimelineProps) {
  const getActorIcon = (actor: string) => {
    if (actor === "system") return <CpuIcon className="h-4 w-4" />
    if (actor.startsWith("user:")) return <UserIcon className="h-4 w-4" />
    return <ClockIcon className="h-4 w-4" />
  }

  const getActorLabel = (actor: string) => {
    if (actor === "system") return "System"
    if (actor.startsWith("user:")) return `User ${actor.split(":")[1]}`
    return actor
  }

  const sortedAuditLog = [...auditLog].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base font-semibold flex items-center space-x-2">
          <ClockIcon className="h-4 w-4" />
          <span>Status Timeline</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {auditLog.length === 0 ? (
          <p className="text-sm text-muted-foreground">No status changes recorded</p>
        ) : (
          <div className="max-h-[50vh] overflow-auto space-y-3">
            {sortedAuditLog.map((entry, index) => (
              <div key={index} className="flex space-x-3">
                <div className="flex-shrink-0 mt-1.5">
                  <div
                    className={`w-2 h-2 rounded-full ${getStatusColor(entry.to).replace("text-", "bg-").replace("-600", "-500")}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-muted-foreground" title={new Date(entry.ts).toISOString()}>
                      {new Date(entry.ts).toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <div className="flex items-center space-x-1">
                      {entry.from ? (
                        <span className="text-muted-foreground">
                          {entry.from} → {entry.to}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">→ {entry.to}</span>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      {getActorLabel(entry.actor)}
                    </Badge>
                  </div>
                  {entry.note && <p className="text-xs text-muted-foreground mt-1">{entry.note}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
