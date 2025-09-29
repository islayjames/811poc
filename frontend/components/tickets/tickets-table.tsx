"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusPill } from "./status-pill"
import { formatRelativeTime, isExpiringWithin3Days, shouldShowPastStartWarning, formatTicketKey, formatWorkOrder, formatDate } from "@/lib/format"
import type { TicketListItem } from "@/lib/types"
import { ChevronUpIcon, ChevronDownIcon, Clock, ExternalLink } from "lucide-react"

interface TicketsTableProps {
  tickets: TicketListItem[]
  onRowClick: (ticketId: string) => void
  onSort: (column: "earliest_start" | "expires" | "status") => void
  sortBy: "earliest_start" | "expires" | "status"
  sortOrder: "asc" | "desc"
}

export function TicketsTable({ tickets, onRowClick, onSort, sortBy, sortOrder }: TicketsTableProps) {
  const SortIcon = ({ column }: { column: "earliest_start" | "expires" | "status" }) => {
    if (sortBy !== column) return null
    return sortOrder === "asc" ? (
      <ChevronUpIcon className="ml-1 h-4 w-4" />
    ) : (
      <ChevronDownIcon className="ml-1 h-4 w-4" />
    )
  }

  const handleGapsClick = (e: React.MouseEvent, ticketId: string) => {
    e.stopPropagation()
    window.location.href = `/tickets/${ticketId}#gaps`
  }

  const handleOpenInNewTab = (e: React.MouseEvent, ticketId: string) => {
    e.stopPropagation()
    window.open(`/tickets/${ticketId}`, "_blank")
  }

  const getRowClassName = (ticket: TicketListItem): string => {
    let className = "cursor-pointer hover:bg-muted/50"

    // Soft red background for expiring tickets
    if (ticket.status === "Expiring" || isExpiringWithin3Days(ticket.dates?.expires_at)) {
      className += " bg-red-50/50"
    }

    // Red left border for past start dates
    if (shouldShowPastStartWarning(ticket.status, ticket.dates?.earliest_lawful_start)) {
      className += " border-l-2 border-l-red-500"
    }

    return className
  }

  const getPastStartTooltip = (ticket: TicketListItem): string | undefined => {
    if (shouldShowPastStartWarning(ticket.status, ticket.dates?.earliest_lawful_start)) {
      return "Earliest lawful start is past; confirm dates."
    }
    return undefined
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">ID</TableHead>
          <TableHead>Work Order</TableHead>
          <TableHead>City</TableHead>
          <TableHead>County</TableHead>
          <TableHead>
            <Button variant="ghost" size="sm" className="h-auto p-0 font-medium" onClick={() => onSort("status")}>
              Status
              <SortIcon column="status" />
            </Button>
          </TableHead>
          <TableHead className="text-right">
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 font-medium"
              onClick={() => onSort("earliest_start")}
            >
              <Clock className="mr-1 h-3 w-3" />
              Earliest Start
              <SortIcon column="earliest_start" />
            </Button>
          </TableHead>
          <TableHead className="text-right">
            <Button variant="ghost" size="sm" className="h-auto p-0 font-medium" onClick={() => onSort("expires")}>
              <Clock className="mr-1 h-3 w-3" />
              Expires
              <SortIcon column="expires" />
            </Button>
          </TableHead>
          <TableHead className="w-20">Issues</TableHead>
          <TableHead className="w-12"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((ticket) => (
          <TableRow
            key={ticket.id}
            className={getRowClassName(ticket)}
            title={getPastStartTooltip(ticket)}
            onClick={() => {
              onRowClick(ticket.id)
            }}
          >
            <TableCell className="font-mono text-sm">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-mono text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  navigator.clipboard.writeText(ticket.id)
                }}
                title={`Copy full ID: ${ticket.id}`}
              >
                {formatTicketKey(ticket.id)}
              </Button>
            </TableCell>
            <TableCell>{formatWorkOrder(ticket.work_order_ref, ticket.id)}</TableCell>
            <TableCell>{ticket.city}</TableCell>
            <TableCell>{ticket.county}</TableCell>
            <TableCell>
              <StatusPill status={ticket.status} />
            </TableCell>
            <TableCell className="text-right">
              {ticket.dates?.earliest_lawful_start ? (
                <span title={ticket.dates.earliest_lawful_start}>
                  {formatDate(ticket.dates.earliest_lawful_start)}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              {ticket.dates?.expires_at ? (
                <span title={ticket.dates.expires_at}>{formatDate(ticket.dates.expires_at)}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="cursor-pointer" onClick={(e) => handleGapsClick(e, ticket.id)}>
              {ticket.gap_count > 0 ? (
                <Badge variant="destructive" className="text-xs" title={`${ticket.gap_count} field${ticket.gap_count !== 1 ? 's' : ''} need${ticket.gap_count === 1 ? 's' : ''} completion`}>
                  {ticket.gap_count}
                </Badge>
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
              )}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => handleOpenInNewTab(e, ticket.id)}
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
