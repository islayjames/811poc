import type { TicketStatus } from "./types"

// Format dates for display
export function formatDate(dateString: string | null): string {
  if (!dateString) return "—"

  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

// Get full ISO string for tooltips
export function getFullDateString(dateString: string | null): string {
  if (!dateString) return ""
  return new Date(dateString).toISOString()
}

// Shorten ticket ID for display
export function formatTicketId(id: string | undefined): string {
  if (!id) return "—"
  return `…${id.slice(-6)}`
}

export function getStatusLabel(status: TicketStatus): string {
  switch (status) {
    case "Draft":
      return "Draft"
    case "ValidPendingConfirm":
      return "Needs Confirm"
    case "Ready":
      return "Ready"
    case "Submitted":
      return "Submitted"
    case "ResponsesIn":
      return "Positive Responses In"
    case "ReadyToDig":
      return "Ready to Dig"
    case "Expiring":
      return "Expiring Soon"
    case "Expired":
      return "Expired"
    case "Cancelled":
      return "Cancelled"
    default:
      return status
  }
}

// Get status color classes
export function getStatusColor(status: TicketStatus): string {
  switch (status) {
    case "Draft":
      return "bg-gray-100 text-gray-900 border-gray-300"
    case "ValidPendingConfirm":
      return "bg-indigo-100 text-indigo-900 border-indigo-300"
    case "Ready":
      return "bg-blue-100 text-blue-900 border-blue-300"
    case "Submitted":
      return "bg-amber-100 text-amber-900 border-amber-300"
    case "ResponsesIn":
      return "bg-purple-100 text-purple-900 border-purple-300"
    case "ReadyToDig":
      return "bg-green-100 text-green-900 border-green-300"
    case "Expiring":
      return "bg-orange-100 text-red-900 border-red-500"
    case "Expired":
      return "bg-red-100 text-red-900 border-red-300"
    case "Cancelled":
      return "bg-slate-100 text-slate-900 border-slate-300"
    default:
      return "bg-gray-100 text-gray-900 border-gray-300"
  }
}

// Check if status allows certain actions
export function canConfirm(status: TicketStatus): boolean {
  return status === "ValidPendingConfirm"
}

export function canMarkSubmitted(status: TicketStatus): boolean {
  return status === "Ready"
}

export function canMarkResponsesIn(status: TicketStatus): boolean {
  return status === "Submitted"
}

export function canCancel(status: TicketStatus): boolean {
  return !["Cancelled", "Expired"].includes(status)
}

export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "—"

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.round(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.round(diffMs / (1000 * 60))
      if (diffMinutes > 0) return `in ${diffMinutes}m`
      if (diffMinutes < 0) return `${Math.abs(diffMinutes)}m ago`
      return "now"
    }
    if (diffHours > 0) return `in ${diffHours}h`
    return `${Math.abs(diffHours)}h ago`
  }

  if (diffDays > 0) {
    if (diffDays === 1) return "tomorrow"
    return `in ${diffDays} days`
  } else {
    if (diffDays === -1) return "yesterday"
    return `${Math.abs(diffDays)} days ago`
  }
}

// Utility functions for conditional row styling
export function isExpiringWithin3Days(dateString: string | null): boolean {
  return isWithinDays(dateString, 3)
}

export function isDateInPast(dateString: string | null): boolean {
  if (!dateString) return false

  const date = new Date(dateString)
  const now = new Date()

  return date < now
}

export function shouldShowPastStartWarning(status: TicketStatus, earliestStart: string | null): boolean {
  if (!isDateInPast(earliestStart)) return false

  const excludedStatuses: TicketStatus[] = [
    "Submitted",
    "ResponsesIn",
    "ReadyToDig",
    "Expiring",
    "Expired",
    "Cancelled",
  ]

  return !excludedStatuses.includes(status)
}

export function isWithinDays(dateString: string | null, days: number): boolean {
  if (!dateString) return false

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  return diffDays <= days && diffDays >= 0
}
