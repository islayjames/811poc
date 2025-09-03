export type TicketStatus =
  | "Draft"
  | "ValidPendingConfirm"
  | "Ready"
  | "Submitted"
  | "ResponsesIn"
  | "ReadyToDig"
  | "Expiring"
  | "Expired"
  | "Cancelled"

export type TicketType = "Normal" | "Emergency" | "SurveyDesign"

export type ResponseStatus =
  | "Located"
  | "Clear"
  | "InConflict"
  | "Delayed"
  | "CannotLocate"
  | "LocatedToMeter"
  | "Cancelled"
  | "Positive" // Additional status types from backend
  | "Negative"
  | "Caution"

export type GeometryType = "Point" | "Polygon" | "LineBuffer"

export interface TicketListItem {
  id: string
  work_order_ref: string | null
  city: string
  county: string
  status: TicketStatus
  dates: {
    earliest_lawful_start: string | null
    expires_at: string | null
  }
  gap_count: number
}

export interface UtilityResponse {
  utility: string
  status: ResponseStatus
  notes: string | null
  response_date?: string
}

export interface ExpectedUtilityMember {
  utility: string
  category: 'gas' | 'electric' | 'water' | 'telecom' | 'cable' | 'sewer' | 'other'
  priority: 'high' | 'medium' | 'low'
}

export interface TicketDetail {
  id: string
  status: TicketStatus
  ticket_type_hint: TicketType
  requested_at: string
  dates: {
    earliest_lawful_start: string | null
    positive_response_at: string | null
    expires_at: string | null
  }
  excavator: {
    company: string
    contact_name: string
    phone: string
    email: string | null
  }
  work: {
    work_for: string | null
    type_of_work: string
    is_trenchless: boolean
    is_blasting: boolean
    depth_inches: number | null
    duration_days: number | null
  }
  site: {
    county: string
    city: string
    address: string | null
    cross_street: string | null
    subdivision: string | null
    lot_block: string | null
    gps: { lat: number | null; lng: number | null }
    driving_directions: string | null
    marking_instructions: string | null
    remarks: string | null
    work_area_description: string
    site_marked_white: boolean
  }
  geom: {
    geometry_type: GeometryType
    geojson: any // GeoJSON object or null
    confidence: number | null
    assumptions: string[] | null
    warnings: string[] | null
  }
  submit_packet: {
    caller_excavator: any
    work: any
    location: any
    map_description: { geometry: any; work_area_description: string }
    dates: { earliest_lawful_start: string | null }
  }
  responses: UtilityResponse[]
  expected_utility_members?: ExpectedUtilityMember[]
  audit_log: Array<{
    ts: string
    actor: string
    from: TicketStatus | null
    to: TicketStatus
    note: string | null
  }>
}

export interface TicketFilters {
  status?: TicketStatus[]
  city?: string
  county?: string
  q?: string
  limit?: number
  offset?: number
}

export interface TicketListResponse {
  tickets: TicketListItem[]
  total: number
  limit: number
  offset: number
}
